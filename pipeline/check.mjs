// check : rapport de build + blocage du remplacement (ticket 010 §6, 013 §2), puis renommage
// langswap.sqlite.tmp → langswap.sqlite seulement si rien ne bloque.
// Usage : node pipeline/check.mjs [--no-rename]
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DB_PATH, DB_TMP_PATH, REPORTS_DIR } from '../shared/config.mjs';
import { LANGS, BENCH_WORDS, PIVOT_CAP, SQLITE_PRAGMAS } from '../shared/constants.mjs';
import { createContext, search } from '../server/search.mjs';
import { wikdictDir } from './common.mjs';

const start = Date.now();
if (!fs.existsSync(DB_TMP_PATH)) throw new Error(`${DB_TMP_PATH} missing: run \`node pipeline/assemble.mjs\` first`);
const db = new DatabaseSync(DB_TMP_PATH);
db.exec(SQLITE_PRAGMAS);   // comme le serveur : le banc mesure ce que le serveur fera
const q = createContext(db);
const meta = q.meta;
const blockers = [], warnings = [];
const L = [];   // lignes du rapport
const pct = (a, b) => b ? (100 * a / b).toFixed(1) + ' %' : '—';

// Générateur pseudo-aléatoire à graine fixe (exemples reproductibles).
function seeded(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
const sample = (list, n, seed) => { const r = seeded(seed); const c = [...list]; for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c.slice(0, n); };

// ---------- tables vides ----------
const counts = {};
for (const t of ['word', 'entry', 'sense', 'translation', 'form']) {
  counts[t] = db.prepare(`SELECT count(*) AS n FROM ${t}`).get().n;
  if (!counts[t]) blockers.push(`table ${t} is empty`);
}

// ---------- liens directs, par paire, en texte ----------
const direct = {};   // 'a-b' → Map(texte a → Set(texte b)), lus dans les deux sens
for (const a of LANGS) for (const b of LANGS) if (a !== b) direct[`${a}-${b}`] = new Map();
for (const r of db.prepare(`SELECT wa.lang AS la, wa.text AS ta, wb.lang AS lb, wb.text AS tb
    FROM entry e JOIN sense s ON s.entry_id = e.id JOIN translation t ON t.sense_id = s.id
    JOIN word wa ON wa.id = e.word_id JOIN word wb ON wb.id = t.word_id`).iterate()) {
  if (r.la === r.lb) continue;
  for (const [x, tx, y, ty] of [[r.la, r.ta, r.lb, r.tb], [r.lb, r.tb, r.la, r.ta]]) {
    const m = direct[`${x}-${y}`]; let s = m.get(tx); if (!s) m.set(tx, s = new Set()); s.add(ty);
  }
}

// Pivot à 1 saut (même plafond que le serveur) : le mot b est-il un voisin ferme ou un voisin de voisin de a ?
const idOf = db.prepare('SELECT id FROM word WHERE lang = ? AND text = ?');
const neighbors = id => q.neighborsBatch.all(JSON.stringify([id])).map(r => r.id);
function reachedByPivot(la, ta, lb, tb) {
  const a = idOf.get(la, ta)?.id, b = idOf.get(lb, tb)?.id;
  if (!a || !b) return false;
  const weight = new Map();
  for (const v of neighbors(a)) if (v !== a) weight.set(v, (weight.get(v) || 0) + 1);
  if (weight.has(b)) return true;
  for (const [i] of [...weight].sort((x, y) => y[1] - x[1]).slice(0, PIVOT_CAP)) if (neighbors(i).includes(b)) return true;
  return false;
}

// ---------- couverture par paire orientée contre WikDict ----------
const wd = wikdictDir();
const coverage = {};
const examples = {};
L.push(`## Coverage by directed pair (against WikDict ${wd ? path.basename(wd).replace('wikdict-', '') : 'missing'})`, '');
L.push('WikDict includes pivot inference: the gap with it is structural and never blocks. "via pivot" is estimated on a sample of 200 missing pairs (fixed seed).', '');
L.push('| Pair | source words here | source words WikDict | `is_good` pairs | found as direct link | + via pivot (est.) |', '|---|---|---|---|---|---|');
for (const a of LANGS) for (const b of LANGS) {
  if (a === b) continue;
  const p = `${a}-${b}`;
  const ours = direct[p].size;
  let wWords = 0, good = 0, found = 0;
  const missing = [];
  const f = wd && path.join(wd, `${p}.sqlite3`);
  if (f && fs.existsSync(f)) {
    const w = new DatabaseSync(f, { readOnly: true });
    wWords = w.prepare('SELECT count(DISTINCT written_rep) AS n FROM translation').get().n;
    const seen = new Set();
    for (const r of w.prepare('SELECT written_rep, trans_list FROM translation WHERE is_good = 1').iterate()) {
      for (const t of r.trans_list.split(' | ')) {
        const k = r.written_rep + '\t' + t;
        if (seen.has(k)) continue;
        seen.add(k); good++;
        if (direct[p].get(r.written_rep)?.has(t)) found++; else missing.push([r.written_rep, t]);
      }
    }
    w.close();
  }
  const smp = sample(missing, 200, p);
  const viaPivot = smp.filter(([x, y]) => reachedByPivot(a, x, b, y)).length;
  const pivotEstimate = missing.length ? Math.round(viaPivot / smp.length * missing.length) : 0;
  coverage[p] = { words: ours, wikdict_words: wWords, is_good: good, direct: found, pivot_estimate: pivotEstimate };
  examples[p] = sample(missing, 20, p + ':ex');
  L.push(`| ${p} | ${ours} | ${wWords} | ${good} | ${pct(found, good)} | ${pct(pivotEstimate, good)} |`);
}

// ---------- écart avec le build précédent ----------
L.push('', '## Change from the previous build', '');
let previous = null;
if (fs.existsSync(DB_PATH)) {
  try {
    const d = new DatabaseSync(DB_PATH, { readOnly: true });
    const m = Object.fromEntries(d.prepare('SELECT name, value FROM meta').all().map(r => [r.name, r.value]));
    previous = m.coverage ? { coverage: JSON.parse(m.coverage), built_at: m.built_at } : null;
    d.close();
  } catch { /* base précédente illisible : traité comme premier build */ }
}
if (!previous) L.push('First build (or previous build without coverage): only the bench blocks, read the report by hand.');
else {
  L.push(`Previous build: ${previous.built_at}`, '', '| Pair | words before | words now | change |', '|---|---|---|---|');
  for (const [p, c] of Object.entries(coverage)) {
    const before = previous.coverage[p]?.words ?? 0;
    const change = before ? (c.words - before) / before : 0;
    L.push(`| ${p} | ${before} | ${c.words} | ${(change * 100).toFixed(1)} % |`);
    if (change < -0.10) blockers.push(`pair ${p}: coverage ${(change * 100).toFixed(1)} % compared with the previous build`);
  }
}

// ---------- santé ----------
const cnt = JSON.parse(meta.counters);
L.push('', '## Health counters', '', `Tables: ${Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(' · ')} · removed words (no firm link): ${cnt.removed_words}`, '');
L.push('| Edition | translations (tr6) | kept | rejected | fixed | page copies | orphan `sense_index` | multi-anchor | placeholders |', '|---|---|---|---|---|---|---|---|---|');
for (const [ed, s] of Object.entries(cnt.editions)) {
  const rej = Object.values(s.rejects).reduce((a, b) => a + b, 0);
  L.push(`| ${ed} | ${s.tr6} | ${s.kept} | ${rej} (${Object.entries(s.rejects).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}) | ${s.fixed} | ${s.page_copies} | ${s.orphans} | ${s.multi_anchor} | ${s.placeholders} |`);
}
L.push('', `en edition, foreign entries: ${cnt.editions.en.en_gloss_entries} entries → ${cnt.editions.en.en_gloss_links} X→en links taken from glosses. it: ${cnt.editions.it.it_pos_labels} POS labels. pt: ${cnt.editions.pt.pt_reparsed} ranges reparsed.`);

// ---------- banc des mots tests ----------
L.push('', '## Bench words', '', 'Server query time (3 passes, pivot included, all destinations). Target < 50 ms at p95; blocks above 1 s.', '', '| Source | Word | passes (ms) | groups |', '|---|---|---|---|');
const times = [];
for (const [src, word] of BENCH_WORDS) {
  const t = []; let r;
  for (let i = 0; i < 3; i++) { const a = performance.now(); r = search(q, { input: word, source: src, langs: LANGS }); t.push(performance.now() - a); }
  times.push(...t.slice(1));
  L.push(`| ${src ?? 'AUTO'} | ${word} | ${t.map(x => x.toFixed(0)).join(' / ')} | ${r.groups.length} |`);
  if (Math.max(...t) > 1000) blockers.push(`bench word ${src ?? 'AUTO'}:${word}: ${Math.max(...t).toFixed(0)} ms > 1 s`);
}
times.sort((a, b) => a - b);
const p95 = times[Math.floor(times.length * 0.95)];
L.push('', `p95 (warm passes): ${p95.toFixed(0)} ms`);
if (p95 > 50) warnings.push(`bench p95 ${p95.toFixed(0)} ms > 50 ms`);

// ---------- gloses fréquentes (repérer un nouveau placeholder, sans blocage) ----------
L.push('', '## 50 most frequent glosses per edition', '');
for (const [ed, list] of Object.entries(JSON.parse(meta.frequent_glosses))) {
  L.push(`<details><summary>${ed}</summary>`, '', list.map(([g, n]) => `- ${n} × ${g.replace(/\n/g, ' ').slice(0, 100)}`).join('\n'), '', '</details>', '');
}

// ---------- exemples de manques ----------
L.push('## Missing examples (20 per pair, fixed seed)', '');
for (const [p, ex] of Object.entries(examples)) L.push(`- **${p}**: ${ex.map(([a, b]) => `${a} → ${b}`).join(' · ') || '—'}`);

// ---------- écriture du rapport, meta, renommage ----------
db.prepare('INSERT OR REPLACE INTO meta VALUES (?, ?)').run('coverage', JSON.stringify(coverage));
db.close();
const first = !previous;
// Au premier build, seul le banc bloque.
const blocking = first ? blockers.filter(b => b.startsWith('bench word')) : blockers;
const day = new Date().toISOString().slice(0, 10);
const header = [
  `# LangSwap build report — ${day}`, '',
  `Database: built ${meta.built_at}, pipeline ${meta.pipeline_version}, dump set ${meta.dump_set}, ${(Number(meta.size_bytes) / 1e6).toFixed(0)} MB, assemble ${meta.assemble_seconds} s.`, '',
  blocking.length ? `**BLOCKED** — the database is not replaced:\n${blocking.map(b => `- ${b}`).join('\n')}` : '**OK** — nothing blocks.',
  blockers.length > blocking.length ? `\nFirst build, reported without blocking:\n${blockers.filter(b => !blocking.includes(b)).map(b => `- ${b}`).join('\n')}` : '',
  warnings.length ? `\nWarnings (non-blocking):\n${warnings.map(a => `- ${a}`).join('\n')}` : '', '',
];
fs.mkdirSync(REPORTS_DIR, { recursive: true });
const file = path.join(REPORTS_DIR, `${day}.md`);
fs.writeFileSync(file, [...header, ...L, ''].join('\n'));
console.log(`Report: ${file} (${((Date.now() - start) / 1000).toFixed(0)} s)`);
for (const a of warnings) console.log(`  warning: ${a}`);
if (blocking.length) {
  for (const b of blocking) console.log(`  BLOCKED: ${b}`);
  process.exit(2);
}
if (!process.argv.includes('--no-rename')) {
  fs.renameSync(DB_TMP_PATH, DB_PATH);
  console.log(`OK: ${DB_PATH} replaced. Restart the LangSwap server to use it.`);
}
