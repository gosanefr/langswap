// Enregistre les appels SQL que fait search() pour chaque mot test, par configuration,
// pour les rejouer à l'identique sur téléphone (android/bench).
// node prototypes/packs/trace.mjs <packs_dir> <out.json> [source.sqlite]   (source par défaut : DB_PATH)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DB_PATH } from '../../shared/config.mjs';
import { LANGS, BENCH_WORDS } from '../../shared/constants.mjs';
import { SQL } from '../../server/queries.mjs';
import { search } from '../../server/search.mjs';
import { packQueries } from '../../server/pack-queries.mjs';

const [packsDir, out, sourceArg] = process.argv.slice(2);
if (!packsDir || !out) throw new Error('usage: node prototypes/packs/trace.mjs <packs_dir> <out.json> [source.sqlite]');
const source = sourceArg || DB_PATH;
const L3 = ['fr', 'en', 'es'];

// Échantillon de qualité (même tirage que bench.mjs), limité à 300 mots pour la durée sur téléphone.
const mono = new DatabaseSync(source, { readOnly: true });
const sample = mono.prepare(`SELECT lang, text FROM word WHERE lang IN ('fr','en','es') AND volume >= 3 ORDER BY (id * 2654435761) % 4294967296 LIMIT 300`).all();

// Monolithe : fichier `langswap.sqlite` (sur le téléphone, à côté des packs).
const configs = {
  'mono-6': { files: { main: 'langswap.sqlite' }, sql: SQL, langs: LANGS },
  'packs-6': { files: packFiles(LANGS), sql: packQueries(LANGS.map(l => `p_${l}`), 'base.word'), langs: LANGS },
  'mono-3': { files: { main: 'langswap.sqlite' }, sql: SQL, langs: L3 },
  'packs-3': { files: packFiles(L3), sql: packQueries(L3.map(l => `p_${l}`), 'base.word'), langs: L3 },
};
function packFiles(langs) {
  return { base: 'base.sqlite', ...Object.fromEntries(langs.map(l => [`p_${l}`, `pack-${l}.sqlite`])) };
}

const result = {};
for (const [name, c] of Object.entries(configs)) {
  const db = new DatabaseSync(':memory:');
  for (const [alias, f] of Object.entries(c.files)) db.exec(`ATTACH '${f === 'langswap.sqlite' ? source : path.join(packsDir, f)}' AS ${alias === 'main' ? 'm' : alias}`);
  // Monolithe : tables non qualifiées → attachée sous « m », résolue par nom (main est vide).
  let log = null;
  const q = {};
  for (const [k, s] of Object.entries(c.sql)) {
    const st = db.prepare(s);
    q[k] = { all: (...a) => { log?.push([k, a]); return st.all(...a); } };
  }
  const meta = Object.fromEntries(q.meta.all().map(r => [r.name, r.value]));
  q.ranges = JSON.parse(meta.word_ranges);
  const searches = [];
  const tests = BENCH_WORDS.filter(([s]) => s === null || c.langs.includes(s)).map(([src, word]) => ({ source: src, word, bench: true }))
    .concat(c.langs.length === 3 ? sample.map(r => ({ source: r.lang, word: r.text, bench: false })) : []);
  for (const t of tests) {
    log = [];
    const r = search(q, { input: t.word, source: t.source, langs: c.langs });
    // Empreinte du résultat (sans `ms`) : le téléphone vérifie qu'il obtient exactement le même.
    const hash = crypto.createHash('sha1').update(JSON.stringify(r, (k, v) => (k === 'ms' ? undefined : v))).digest('hex');
    searches.push({ ...t, calls: log, groups: r.groups.length, hash });
  }
  result[name] = { files: c.files, sql: c.sql, langs: c.langs, searches };
  const n = searches.reduce((s, r) => s + r.calls.length, 0);
  console.log(name, searches.length, 'searches,', n, 'SQL calls');
}
fs.writeFileSync(out, JSON.stringify(result));
console.log(out, (fs.statSync(out).size / 1e6).toFixed(1), 'MB');
