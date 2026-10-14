// Serveur local LangSwap (ticket 009) : Node 22 + node:sqlite, zéro dépendance, localhost uniquement.
// Ouvre langswap.sqlite en lecture seule et history.sqlite en lecture-écriture, sert l'interface et les routes.
// Lancé directement (bin/langswap) : écoute sur HOST:PORT. Importé : createServer() pour d'autres chemins (tests).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { DB_PATH, HISTORY_PATH, PORT, ROOT } from '../shared/config.mjs';
import { HOST, LANGS, LANG_NAMES, PRIMARY_LANGS, SECONDARY_LANGS, NEAR_CAP, PIVOT_CAP, SQLITE_PRAGMAS, SOURCE_URL, CODE_LICENSE, DATA_LICENSE } from '../shared/constants.mjs';
import { createContext, search, preview } from './search.mjs';
import { openHistory } from './history.mjs';

const WEB = path.join(ROOT, 'web');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

const langList = s => { const l = String(s || '').split(',').filter(x => LANGS.includes(x)); return l.length ? l : LANGS; };
const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
const readBody = req => new Promise((ok, ko) => { let d = ''; req.on('data', c => { d += c; if (d.length > 1e6) req.destroy(); }); req.on('end', () => { try { ok(d ? JSON.parse(d) : {}); } catch (e) { ko(e); } }); });

export function createServer({ dbPath = DB_PATH, historyPath = HISTORY_PATH } = {}) {
  let q = null, dbError = null;
  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    db.exec(SQLITE_PRAGMAS);
    q = createContext(db);
  } catch (e) {
    dbError = `Dictionary missing or unreadable (${dbPath}): run the build (see README). ${e.message}`;
    console.error(dbError);
  }
  const history = openHistory(historyPath);

  const routes = {
    'GET /api/ping': () => ({ langswap: true, pid: process.pid }),
    'GET /api/config': () => ({ langs: LANGS, names: LANG_NAMES, primary: PRIMARY_LANGS, secondary: SECONDARY_LANGS, nearCap: NEAR_CAP, pivotCap: PIVOT_CAP,
      about: { source: SOURCE_URL, codeLicense: CODE_LICENSE, dataLicense: DATA_LICENSE, app: null } }),
    'GET /api/meta': () => {
      if (!q) return { error: dbError };
      const m = q.meta;
      const dumps = Object.fromEntries(Object.entries(JSON.parse(m.dumps || '{}')).map(([ed, d]) => [ed, { serverDate: d.server_date, sha256: d.sha256 }]));
      return { pipelineVersion: m.pipeline_version, builtAt: m.built_at, dumpSet: m.dump_set, dumps, sizeBytes: Number(m.size_bytes || 0), sizeByLang: JSON.parse(m.size_by_lang || 'null') };
    },
    'GET /api/search': (u) => {
      if (!q) throw Object.assign(new Error(dbError), { code: 503 });
      const p = u.searchParams;
      const src = p.get('src');
      return search(q, {
        input: p.get('q') || '',
        source: src && LANGS.includes(src) ? src : null,
        langs: langList(p.get('langs')),
        pivot: ['complement', 'fallback', 'off'].includes(p.get('pivot')) ? p.get('pivot') : 'complement',
        destination: LANGS.includes(p.get('dst')) ? p.get('dst') : null,
      });
    },
    'POST /api/previews': async (u, req) => {
      if (!q) return [];
      const { items = [], langs, dst } = await readBody(req);
      return items.map(it => preview(q, { input: it.input, source: it.langs?.length === 1 ? it.langs[0] : null, langs: langList(langs), destination: LANGS.includes(dst) ? dst : null }));
    },
    'GET /api/history': (u) => {
      const p = u.searchParams;
      return history.list({ before: Number(p.get('before')) || Number.MAX_SAFE_INTEGER, limit: Math.min(500, Number(p.get('limit')) || 100), filter: p.get('filter') || '' });
    },
    'POST /api/history': async (u, req) => {
      const b = await readBody(req);
      if (!b.input || !Array.isArray(b.langs)) throw Object.assign(new Error('input and langs required'), { code: 400 });
      return { id: history.add(b) };
    },
    'DELETE /api/history': () => { history.clear(); return { ok: true }; },
  };

  async function serve(req, res) {
    const u = new URL(req.url, `http://${HOST}`);
    const route = routes[`${req.method} ${u.pathname}`];
    if (route) return json(res, 200, await route(u, req));

    const m = /^\/api\/history\/(\d+)$/.exec(u.pathname);
    if (m && req.method === 'PUT') { const b = await readBody(req); return json(res, 200, { id: history.replace(Number(m[1]), b) }); }
    if (m && req.method === 'DELETE') { history.remove(Number(m[1])); return json(res, 200, { ok: true }); }
    if (u.pathname.startsWith('/api/')) return json(res, 404, { error: 'unknown route' });

    // Fichiers statiques de web/ ; /normalize.js = le module de normalisation partagé (une seule définition).
    const rel = u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname.slice(1));
    const f = rel === 'normalize.js' ? path.join(ROOT, 'shared', 'normalize.mjs') : path.join(WEB, rel);
    if (rel !== 'normalize.js' && !f.startsWith(WEB + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(f).pipe(res);
  }

  return http.createServer((req, res) => {
    serve(req, res).catch(e => json(res, e.code || 500, { error: e.message }));
  });
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createServer();
  server.on('error', e => {
    if (e.code === 'EADDRINUSE') { console.error(`Port ${PORT} already in use (a LangSwap server may already be running).`); process.exit(3); }
    throw e;
  });
  server.listen(PORT, HOST, () => console.log(`LangSwap ready: http://localhost:${PORT}/`));
}
