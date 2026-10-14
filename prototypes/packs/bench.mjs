// Prototype : packs attachés (requêtes pack par pack), comparés à la base monolithique.
// node prototypes/packs/bench.mjs <packs_dir> [source.sqlite]   (source par défaut : DB_PATH)
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { DB_PATH } from '../../shared/config.mjs';
import { LANGS, BENCH_WORDS } from '../../shared/constants.mjs';
import { createContext, search } from '../../server/search.mjs';
import { packQueries } from '../../server/pack-queries.mjs';

const packsDir = process.argv[2];
const source = process.argv[3] || DB_PATH;
if (!packsDir) throw new Error('usage: node prototypes/packs/bench.mjs <packs_dir> [source.sqlite]');

/** Connexion « packs » : base (meta + mots) + un fichier par pack, attachés ; requêtes pack par pack. */
function openPacks(installed) {
  const db = new DatabaseSync(':memory:');
  db.exec(`ATTACH '${path.join(packsDir, 'base.sqlite')}' AS base`);
  for (const L of installed) db.exec(`ATTACH '${path.join(packsDir, `pack-${L}.sqlite`)}' AS p_${L}`);
  const sql = packQueries(installed.map(L => `p_${L}`), 'base.word');
  const q = Object.fromEntries(Object.entries(sql).map(([k, s]) => [k, db.prepare(s)]));
  const meta = Object.fromEntries(q.meta.all().map(r => [r.name, r.value]));
  q.ranges = JSON.parse(meta.word_ranges);
  q.meta = meta;
  return q;
}

const mono = createContext(new DatabaseSync(source, { readOnly: true }));
const withoutMs = r => JSON.parse(JSON.stringify(r, (k, v) => (k === 'ms' ? undefined : v)));

/** Chemin de la première différence entre deux valeurs JSON (diagnostic). */
function firstDiff(a, b, at = '') {
  if (isDeepStrictEqual(a, b)) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return `${at}: ${JSON.stringify(a)?.slice(0, 80)} ≠ ${JSON.stringify(b)?.slice(0, 80)}`;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = firstDiff(a[k], b[k], `${at}.${k}`); if (d) return d; }
}

function bench(name, q, langs) {
  const words = BENCH_WORDS.filter(([s]) => s === null || langs.includes(s));
  const warm = [], cold = [];
  for (const [src, word] of words) for (let i = 0; i < 3; i++) {
    const a = performance.now(); search(q, { input: word, source: src, langs }); const t = performance.now() - a;
    (i ? warm : cold).push(t);
  }
  warm.sort((a, b) => a - b);
  const p95 = warm[Math.floor(warm.length * 0.95)];
  console.log(`${name.padEnd(28)} p50 ${warm[warm.length >> 1].toFixed(1).padStart(5)} ms  p95 ${p95.toFixed(1).padStart(5)} ms  max ${warm.at(-1).toFixed(1).padStart(5)} ms  1st pass max ${Math.max(...cold).toFixed(0)} ms  (${words.length} words)`);
}

// 1. Exactitude : 6 packs attachés vs monolithe. Les requêtes sans ORDER BY (forms, inverseSenses, siblings,
// neighborsBatch) rendent leurs lignes dans un autre ordre : on compare au caractère près, puis à l'ordre des tableaux près.
const canon = v => Array.isArray(v) ? v.map(canon).map(x => [JSON.stringify(x), x]).sort((a, b) => a[0] < b[0] ? -1 : 1).map(x => x[1])
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, canon(x)])) : v;
const p6 = openPacks(LANGS);
for (const pivot of ['off', 'complement']) {
  let exact = 0, sameUpToOrder = 0;
  for (const [src, word] of BENCH_WORDS) {
    const a = withoutMs(search(mono, { input: word, source: src, pivot })), b = withoutMs(search(p6, { input: word, source: src, pivot }));
    if (isDeepStrictEqual(a, b)) exact++;
    else if (isDeepStrictEqual(canon(a), canon(b))) sameUpToOrder++;
    else console.log(`  DIFF (pivot ${pivot})`, src, word, firstDiff(canon(a), canon(b)));
  }
  console.log(`6 packs vs monolith, pivot ${pivot}: ${exact} identical, ${sameUpToOrder} identical up to order, ${BENCH_WORDS.length - exact - sameUpToOrder} different (of ${BENCH_WORDS.length})`);
}
if (process.argv.includes('--correctness-only')) process.exit(0);
console.log();

// 2. Latence (même banc que check : 3 passes, p95 sur les passes chaudes).
const L3 = ['fr', 'en', 'es'];
const p3 = openPacks(L3);
bench('monolith, 6 langs', mono, LANGS);
bench('6 attached packs', p6, LANGS);
bench('monolith, fr/en/es', mono, L3);
bench('3 packs', p3, L3);

// 3. Qualité fr/en/es sur un échantillon : mots fermes et proches (pivot) par rapport au monolithe.
const db = new DatabaseSync(source, { readOnly: true });
const sample = db.prepare(`SELECT lang, text FROM word WHERE lang IN ('fr','en','es') AND volume >= 3 ORDER BY (id * 2654435761) % 4294967296 LIMIT 600`).all()
  .concat(db.prepare(`SELECT lang, text FROM (SELECT lang, text, row_number() OVER (PARTITION BY lang ORDER BY volume DESC) r FROM word WHERE lang IN ('fr','en','es')) WHERE r <= 100`).all());
function measure(q) {
  const s = { firm: 0, near: 0, siblings: 0, ms: 0 };
  for (const { lang, text } of sample) {
    const r = search(q, { input: text, source: lang, langs: L3 });
    s.ms += r.ms;
    for (const g of r.groups) {
      for (const p of g.pos) for (const row of p.rows) for (const [lg, c] of Object.entries(row.cells)) {
        s.firm += c.length;
        if (row.type === 'inverse' && lg !== row.label.split(' · ')[0]) s.siblings += c.length;
      }
      for (const c of Object.values(g.near)) s.near += c.length;
    }
  }
  return s;
}
const ref = measure(mono);
console.log(`\nQuality fr/en/es, ${sample.length} words (600 random with volume ≥ 3 + 100 richest per language):`);
console.log('                              firm words   of which siblings  near (pivot)  mean time');
for (const [name, q] of [['monolith (reference)', mono], ['3 packs', p3]]) {
  const s = q === mono ? ref : measure(q);
  const pc = (a, b) => `${a} (${(100 * a / b).toFixed(0)} %)`.padStart(13);
  console.log(`${name.padEnd(28)} ${pc(s.firm, ref.firm)} ${pc(s.siblings, ref.siblings)}    ${pc(s.near, ref.near)}   ${(s.ms / sample.length).toFixed(1)} ms`);
}
