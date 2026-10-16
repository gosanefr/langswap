// Routes /api/* de server/server.mjs, servies dans la page (WebView Android) : remplace window.fetch pour
// les URL /api/, avant qu'app.js ne s'exécute. Recherche : server/search.mjs tel quel ; SQL : pont Kotlin
// (window.Android, Bridge.kt) vers SQLite embarqué. Dictionnaire en packs (server/pack-queries.mjs).
// Historique : même schéma que le poste (shared/history.sql) ; le filtre searchKey() se fait en JS, faute de
// fonction SQL personnalisée côté Android.
import { search, preview } from '../js/server/search.mjs';
import { packQueries } from '../js/server/pack-queries.mjs';
import { searchKey } from '../js/shared/normalize.mjs';
import { LANGS, LANG_NAMES, PRIMARY_LANGS, SECONDARY_LANGS, NEAR_CAP, PIVOT_CAP, SOURCE_URL, CODE_LICENSE, DATA_LICENSE } from '../js/shared/constants.mjs';

const bridge = window.Android;
const read = s => { const r = JSON.parse(s); if (r && !Array.isArray(r) && r.error) throw new Error(r.error); return r; };
const prepare = (db, sql) => {
  const id = Number(read(bridge.prepare(db, sql)));
  return { all: (...a) => read(bridge.all(id, JSON.stringify(a))), run: (...a) => read(bridge.run(id, JSON.stringify(a))) };
};

// ---------- dictionnaire ----------
let q = null, dbError = null, installed = [];
try {
  const d = read(bridge.openDictionary());
  installed = LANGS.filter(l => d.langs.includes(l));
  const sql = packQueries(installed.map(l => `p_${l}`), 'base.word');
  q = Object.fromEntries(Object.entries(sql).map(([k, s]) => [k, prepare('dict', s)]));
  // Comme createContext() (server/search.mjs) : q.meta = valeurs de la table meta, q.ranges = plages d'ids.
  q.meta = Object.fromEntries(q.meta.all().map(r => [r.name, r.value]));
  q.ranges = JSON.parse(q.meta.word_ranges);
} catch (e) {
  q = null;
  dbError = `Dictionary missing or unreadable: ${e.message}. Download language packs in the settings.`;
  console.error(dbError);
}
const langList = s => { const l = String(s || '').split(',').filter(x => installed.includes(x)); return l.length ? l : installed; };

// ---------- historique (server/history.mjs) ----------
const H = {
  insert: prepare('history', 'INSERT INTO search (input, lemma, langs, timestamp, parent_id) VALUES (?, ?, ?, ?, ?)'),
  replace: prepare('history', 'UPDATE search SET input = ?, lemma = ?, langs = ?, timestamp = ? WHERE id = ?'),
  remove: prepare('history', 'DELETE FROM search WHERE id = ?'),
  clear: prepare('history', 'DELETE FROM search'),
  page: prepare('history', 'SELECT * FROM search WHERE id < ? ORDER BY id DESC LIMIT ?'),
  byId: prepare('history', 'SELECT * FROM search WHERE id = ?'),
};
const history = {
  add: ({ input, lemma, langs, parentId = null }) => H.insert.run(input, lemma ?? null, langs.join(','), new Date().toISOString(), parentId).id,
  replace(id, { input, lemma, langs }) { H.replace.run(input, lemma ?? null, langs.join(','), new Date().toISOString(), id); return id; },
  remove: id => { H.remove.run(id); },
  clear: () => { H.clear.run(); },
  /** Comme sur le poste (instr(search_key(…), searchKey(filter)) > 0), mais filtré en JS, par pages de 200. */
  list({ before = Number.MAX_SAFE_INTEGER, limit = 100, filter = '' }) {
    const k = searchKey(filter);
    let rows = [];
    if (!k) rows = H.page.all(before, limit);
    else for (let cursor = before; rows.length < limit;) {
      const batch = H.page.all(cursor, 200);
      rows.push(...batch.filter(r => searchKey(r.input).includes(k) || searchKey(r.lemma ?? '').includes(k)));
      if (batch.length < 200) break;
      cursor = batch.at(-1).id;
    }
    return rows.slice(0, limit).map(({ parent_id: parentId, ...r }) => ({ ...r, parentId, langs: r.langs.split(',').filter(Boolean),
      parent: parentId ? (H.byId.all(parentId)[0]?.input ?? null) : null }));
  },
};

// ---------- routes (mêmes réponses que server.mjs) ----------
const httpError = (code, message) => Object.assign(new Error(message), { code });
const routes = {
  'GET /api/ping': () => ({ langswap: true, pid: 0 }),
  'GET /api/config': () => ({ packs: true, langs: LANGS, names: LANG_NAMES, primary: PRIMARY_LANGS.filter(l => installed.includes(l)),
    secondary: SECONDARY_LANGS.filter(l => installed.includes(l)), nearCap: NEAR_CAP, pivotCap: PIVOT_CAP,
    about: { source: SOURCE_URL, codeLicense: CODE_LICENSE, dataLicense: DATA_LICENSE, app: read(bridge.appInfo()) } }),
  'GET /api/meta': () => {
    if (!q) return { error: dbError };
    const m = q.meta;
    const dumps = Object.fromEntries(Object.entries(JSON.parse(m.dumps || '{}')).map(([ed, d]) => [ed, { serverDate: d.server_date, sha256: d.sha256 }]));
    return { pipelineVersion: m.pipeline_version, builtAt: m.built_at, dumpSet: m.dump_set, dumps, sizeBytes: Number(m.size_bytes || 0), sizeByLang: JSON.parse(m.size_by_lang || 'null') };
  },
  'GET /api/search': u => {
    if (!q) throw httpError(503, dbError);
    const p = u.searchParams, src = p.get('src');
    return search(q, {
      input: p.get('q') || '',
      source: src && installed.includes(src) ? src : null,
      langs: langList(p.get('langs')),
      pivot: ['complement', 'fallback', 'off'].includes(p.get('pivot')) ? p.get('pivot') : 'complement',
      destination: installed.includes(p.get('dst')) ? p.get('dst') : null,
    });
  },
  'POST /api/previews': (u, body) => {
    if (!q) return [];
    const { items = [], langs, dst } = body;
    return items.map(it => preview(q, { input: it.input, source: it.langs?.length === 1 ? it.langs[0] : null, langs: langList(langs), destination: installed.includes(dst) ? dst : null }));
  },
  'GET /api/history': u => {
    const p = u.searchParams;
    return history.list({ before: Number(p.get('before')) || Number.MAX_SAFE_INTEGER, limit: Math.min(500, Number(p.get('limit')) || 100), filter: p.get('filter') || '' });
  },
  'POST /api/history': (u, b) => {
    if (!b.input || !Array.isArray(b.langs)) throw httpError(400, 'input and langs required');
    return { id: history.add(b) };
  },
  'DELETE /api/history': () => { history.clear(); return { ok: true }; },
  // Packs de langue (Packs.kt) : état, relecture du manifeste du serveur, choix du serveur, installation d'un jeu de langues.
  'GET /api/packs': () => read(bridge.packsState()),
  'POST /api/packs/refresh': () => { read(bridge.packsRefresh()); return { ok: true }; },
  // url vide : serveur par défaut de l'appli ; erreur (400) si l'URL est refusée (HTTPS exigé hors debug).
  'POST /api/packs/server': (u, b) => {
    try { read(bridge.packsSetServer(String(b.url ?? ''))); } catch (e) { throw httpError(400, e.message); }
    return { ok: true };
  },
  'POST /api/packs': (u, b) => {
    if (!Array.isArray(b.langs)) throw httpError(400, 'langs required');   // [] : tout désinstaller
    read(bridge.packsApply(JSON.stringify(b.langs))); return { ok: true };
  },
};

function serve(method, u, body) {
  const route = routes[`${method} ${u.pathname}`];
  if (route) return route(u, body);
  const m = /^\/api\/history\/(\d+)$/.exec(u.pathname);
  if (m && method === 'PUT') return { id: history.replace(Number(m[1]), body) };
  if (m && method === 'DELETE') { history.remove(Number(m[1])); return { ok: true }; }
  throw httpError(404, 'unknown route');
}

const networkFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const u = new URL(input instanceof Request ? input.url : String(input), location.href);
  if (u.origin !== location.origin || !u.pathname.startsWith('/api/')) return networkFetch(input, init);
  const method = (init.method || 'GET').toUpperCase();
  let code = 200, body;
  try { body = serve(method, u, init.body ? JSON.parse(init.body) : {}); }
  catch (e) { code = e.code || 500; body = { error: e.message }; console.error(`${method} ${u.pathname}`, e); }
  return new Response(JSON.stringify(body), { status: code, headers: { 'content-type': 'application/json; charset=utf-8' } });
};
