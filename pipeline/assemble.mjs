// assemble : cache extrait → data/langswap.sqlite.tmp (ticket 010 §4, règles 012 et 013).
// Rapide et rejoué à chaque retouche de règle. Usage : node pipeline/assemble.mjs [--set=AAAA-MM-JJ]
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DB_TMP_PATH, DATA_DIR, ROOT } from '../shared/config.mjs';
import { LANGS, LANG_BIT, PIPELINE_VERSION } from '../shared/constants.mjs';
import { searchKey } from '../shared/normalize.mjs';
import { isPlaceholder, itPosLabel, gender, regions } from '../shared/lists.mjs';
import { pinnedDumpSet, cacheFile, readCache } from './common.mjs';
import { cleanWord, senseNumbers, reparsePt, resolve, glossWords } from './cleanup.mjs';
import { sizeByLang } from './sizes.mjs';

const start = Date.now();
const { name: dumpSet, manifest } = pinnedDumpSet(process.argv);
const log = (...a) => console.log(`[${((Date.now() - start) / 1000).toFixed(0).padStart(4)} s]`, ...a);

// ---------- état en mémoire ----------
const wordIds = new Map();               // lang \x01 text → id
const wordLang = [], wordText = [];
function wordId(lang, text) {
  const k = lang + '\x01' + text;
  let id = wordIds.get(k);
  if (id === undefined) { id = wordLang.length; wordIds.set(k, id); wordLang.push(lang); wordText.push(text); }
  return id;
}
const entries = [];                      // { word, pos, edition, rank }
const senses = [];                       // { entry, rankKey, gloss, anchor, trans: Map(word → [rank, gender, region]) }

const stats = Object.fromEntries(LANGS.map(ed => [ed, {
  tr6: 0, kept: 0, rejects: {}, fixed: 0, page_copies: 0, orphans: 0, multi_anchor: 0, placeholders: 0,
  it_pos_labels: 0, pt_reparsed: 0, en_gloss_entries: 0, en_gloss_links: 0,
}]));

// ---------- forme brute (résolue à la fin, quand on sait quels mots survivent) ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
for (const f of [DB_TMP_PATH, DB_TMP_PATH + '-journal']) fs.rmSync(f, { force: true });
const db = new DatabaseSync(DB_TMP_PATH);
db.exec(`PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA locking_mode=EXCLUSIVE; PRAGMA cache_size=-1000000; PRAGMA temp_store=FILE;`);
db.exec(fs.readFileSync(path.join(ROOT, 'shared/schema.sql'), 'utf8'));
db.exec(`CREATE TEMP TABLE raw_form (lang TEXT, lemma TEXT, form TEXT)`);
const insRawForm = db.prepare('INSERT INTO raw_form VALUES (?, ?, ?)');
db.exec('BEGIN');

// ---------- traitement d'une page (même mot, même langue, lignes consécutives) ----------
function entryNumbers(ed, e) {
  // num → { gloss, pos } ; pos = position du sens dans l'entrée (pour le rang).
  const m = new Map();
  const ss = e.s || [];
  if (ed === 'de' || ed === 'es') {
    ss.forEach((s, i) => { if (s.si && !m.has(s.si)) m.set(s.si, { gloss: s.g?.at(-1) ?? null, pos: i }); });
  } else if (ed === 'fr' || ed === 'pt') {
    let n = 0, prev = null;
    ss.forEach((s, i) => {
      const g0 = s.g?.[0];
      if (g0 == null || g0 === prev) return;
      prev = g0; n++;
      m.set(String(n), { gloss: g0, pos: i });
    });
  }
  return m;
}

function processPage(ed, page) {
  const lang = page[0].l, headword = page[0].w;
  const st = stats[ed];
  const formOf = page.map(e => !!(e.s?.length && e.s.every(s => s.fo)));
  const nums = page.map(e => entryNumbers(ed, e));
  const firstNonFormOf = formOf.indexOf(false);

  // Formes : tables forms[] (→ lemme = ce mot) et sens form_of (→ lemme cible).
  for (const e of page) {
    for (const f of e.f || []) insRawForm.run(lang, headword, f);
    for (const s of e.s || []) for (const lemma of s.fo || []) if (lemma !== headword) insRawForm.run(lang, lemma, headword);
  }

  // Sens locaux, créés à la demande ; l'entrée n'existe en base que si elle porte au moins un sens.
  const locals = page.map(() => null);
  const localEntry = i => {
    if (!locals[i]) {
      const id = entries.length;
      entries.push({ word: wordId(lang, headword), pos: page[i].p, edition: ed, rank: i });
      locals[i] = { id, senses: new Map(), order: 0 };
    }
    return locals[i];
  };
  const localSense = (i, senseKey, gloss, anchor, rankKey, alias) => {
    const loc = localEntry(i);
    let s = loc.senses.get(senseKey);
    if (!s) {
      s = { entry: loc.id, rankKey: rankKey ?? 10000 + loc.order++, gloss, anchor, trans: new Map() };
      senses.push(s);
      loc.senses.set(senseKey, s);
    }
    if (alias && !loc.senses.has(alias)) loc.senses.set(alias, s);
    return s;
  };
  const noSense = i => localSense(i, '∅', null, false, 1e9);
  let transRank = 0;
  const add = (s, targetLang, text, g, r) => {
    const id = wordId(targetLang, text);
    if (!s.trans.has(id)) s.trans.set(id, [transRank, g, r]);
  };

  // Entrées étrangères de l'édition en : gloses anglaises → liens X→en (ticket 012).
  if (ed === 'en' && lang !== 'en') {
    page.forEach((e, i) => {
      if (formOf[i]) return;
      let k = 0, counted = false;
      for (const s of e.s || []) {
        if (s.fo || !s.g?.length) continue;
        const gloss = s.g.at(-1);
        const words = glossWords(gloss, s.lk);
        if (!words.length) continue;
        const sl = localSense(i, 'en:' + k, gloss, false, k++);
        for (const w of words) { add(sl, 'en', w, null, ''); transRank++; st.en_gloss_links++; }
        counted = true;
      }
      if (counted) st.en_gloss_entries++;
    });
  }

  // Blocs translations : une seule copie par page (013 §1).
  const items = new Map();
  page.forEach((e, i) => {
    for (const t of e.t || []) {
      const k = `${t.l}\x01${t.w}\x01${t.s ?? ''}\x01${t.si ?? ''}`;
      const it = items.get(k);
      if (it) { it.origins.push(i); st.page_copies++; } else items.set(k, { t, origins: [i] });
    }
  });
  if (!items.size) return;

  // es : numérotation continue sur la page → num → entrée qui le possède.
  let pageNums = null;
  if (ed === 'es') {
    pageNums = new Map();
    nums.forEach((m, i) => { for (const [n, v] of m) if (!pageNums.has(n)) pageNums.set(n, { i, ...v }); });
  }
  const target = origins => {
    if (origins.length === 1) return origins[0];
    const nf = origins.find(i => !formOf[i]);
    return nf ?? (firstNonFormOf >= 0 ? firstNonFormOf : origins[0]);
  };

  for (const { t, origins } of items.values()) {
    st.tr6++;
    const cleaned = cleanWord(t.w, { edition: ed, entryLang: lang, targetLang: t.l, headword, tags: t.tg || [] });
    if (cleaned.fixed) st.fixed++;
    if (!cleaned.pieces.length) { st.rejects[cleaned.reject] = (st.rejects[cleaned.reject] || 0) + 1; continue; }
    st.kept++;
    const g = gender(t.tg, t.rt), r = regions(t.tg, t.rt);

    for (const m of cleaned.pieces) {
      const si = m.si ?? t.si;
      let label = t.s && !isPlaceholder(t.s) ? t.s : null;
      if (t.s && !label) st.placeholders++;
      let ns = senseNumbers(si);
      if (ed === 'pt' && ns && t.s) {
        const { extra, gloss } = reparsePt(si, t.s);
        if (extra.length) { ns = [...new Set([...ns, ...extra])]; label = gloss && !isPlaceholder(gloss) ? gloss : null; st.pt_reparsed++; }
      }

      // Ancrage par numéro (013 §3), validé après le rattachement de la page.
      let anchors = null;
      if (ns) {
        if (pageNums) {
          const ok = resolve(ns, new Set(pageNums.keys()));
          if (ok.length) anchors = ok.map(n => ({ i: pageNums.get(n).i, n, ...pageNums.get(n) }));
        } else {
          for (const o of origins) {
            const ok = resolve(ns, new Set(nums[o].keys()));
            if (ok.length) { anchors = ok.map(n => ({ i: o, n, ...nums[o].get(n) })); break; }
          }
        }
        if (!anchors) st.orphans++;
        else if (anchors.length > 1) st.multi_anchor++;
      }

      if (anchors) {
        for (const a of anchors) {
          const gloss = anchors.length === 1 && label ? label : (a.gloss ?? label);
          const s = localSense(a.i, 'n:' + a.n, gloss, true, a.pos, anchors.length === 1 && label ? 'g:' + label : null);
          add(s, t.l, m.w, g, r);
        }
      } else if (label && !ns) {
        const pos = ed === 'it' ? itPosLabel(label) : null;
        if (pos) {
          st.it_pos_labels++;
          let i = page.findIndex((e, j) => e.p === pos && !formOf[j]);
          if (i < 0) i = page.findIndex(e => e.p === pos);
          add(noSense(i >= 0 ? i : target(origins)), t.l, m.w, g, r);
        } else {
          add(localSense(target(origins), 'g:' + label, label, true), t.l, m.w, g, r);
        }
      } else {
        add(noSense(target(origins)), t.l, m.w, g, r);
      }
    }
    transRank++;
  }
}

// ---------- lecture des éditions ----------
// Éditions natives d'abord : à POS égale, l'entrée de l'édition native a les rangs les plus bas.
for (const ed of ['fr', 'de', 'es', 'it', 'pt', 'en']) {
  const file = cacheFile(manifest, ed);
  if (!fs.existsSync(file)) throw new Error(`No cache for ${ed}: run \`node pipeline/extract.mjs\``);
  let page = [], n = 0;
  for await (const e of readCache(file)) {
    n++;
    if (page.length && (e.w !== page[0].w || e.l !== page[0].l)) { processPage(ed, page); page = []; }
    page.push(e);
  }
  if (page.length) processPage(ed, page);
  log(`${ed}: ${n} entries, ${stats[ed].tr6} translations (${stats[ed].kept} kept); total ${wordLang.length} words, ${senses.length} senses`);
}
db.exec('COMMIT');

// ---------- agrégats : volume, suppression des mots sans lien ferme ----------
const volume = new Uint32Array(wordLang.length);
{
  const pairs = new Set();
  for (const s of senses) {
    const a = entries[s.entry].word;
    for (const b of s.trans.keys()) {
      if (a === b) continue;
      const k = a < b ? a * 2 ** 26 + b : b * 2 ** 26 + a;
      if (!pairs.has(k)) { pairs.add(k); volume[a]++; volume[b]++; }
    }
    if (s.anchor && s.trans.size > 1) for (const b of s.trans.keys()) volume[b] += s.trans.size - 1;
  }
  log(`${pairs.size} distinct direct links`);
}
const newId = new Int32Array(wordLang.length).fill(-1);
// Ids contigus par langue (ordre LANGS) : le serveur déduit la langue d'un id sans jointure (pivot).
let nWords = 0;
const ranges = {};
for (const lang of LANGS) {
  const min = nWords + 1;
  for (let i = 0; i < wordLang.length; i++) if (volume[i] > 0 && wordLang[i] === lang) newId[i] = ++nWords;
  ranges[lang] = [min, nWords];
}
const removedWords = wordLang.length - nWords;

// ---------- écriture ----------
db.exec('BEGIN');
{
  const ins = db.prepare('INSERT INTO word VALUES (?, ?, ?, ?)');
  const byId = new Int32Array(nWords + 1);
  for (let i = 0; i < wordLang.length; i++) if (newId[i] > 0) byId[newId[i]] = i;
  for (let n = 1; n <= nWords; n++) { const i = byId[n]; ins.run(n, wordLang[i], wordText[i], volume[i]); }
}
{
  const insE = db.prepare('INSERT INTO entry VALUES (?, ?, ?, ?, ?)');
  entries.forEach((e, i) => insE.run(i + 1, newId[e.word], e.pos, e.edition, e.rank));
  // Rangs des sens dans leur entrée (ordre de la source), puis sens et traductions.
  const byEntry = new Map();
  senses.forEach(s => { let l = byEntry.get(s.entry); if (!l) byEntry.set(s.entry, l = []); l.push(s); });
  const insS = db.prepare('INSERT INTO sense VALUES (?, ?, ?, ?, ?, ?)');
  const insT = db.prepare('INSERT INTO translation VALUES (?, ?, ?, ?, ?)');
  let sid = 0;
  for (const [eid, list] of [...byEntry].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => a.rankKey - b.rankKey);
    list.forEach((s, rank) => {
      sid++;
      let langs = 0;
      for (const m of s.trans.keys()) langs |= LANG_BIT[wordLang[m]];
      insS.run(sid, eid + 1, rank + 1, s.gloss, s.anchor ? 1 : 0, langs);
      const trans = [...s.trans].sort((a, b) => a[1][0] - b[1][0]);
      trans.forEach(([m, [, g, r]], k) => insT.run(sid, newId[m], k + 1, g, r || null));
    });
  }
  log(`written: ${nWords} words, ${entries.length} entries, ${sid} senses`);
}
db.exec('COMMIT');

// ---------- formes : lemme (layer word) + flexions (ticket 010 §4.4, 012 §5) ----------
db.exec('BEGIN');
{
  const ins = db.prepare('INSERT OR IGNORE INTO form VALUES (?, ?, ?, ?)');
  for (let i = 0; i < wordLang.length; i++) if (newId[i] > 0) ins.run(searchKey(wordText[i]), newId[i], wordText[i], 'word');
  let n = 0, kept = 0;
  for (const { lang, lemma, form } of db.prepare('SELECT lang, lemma, form FROM raw_form').iterate()) {
    n++;
    const id = wordIds.get(lang + '\x01' + lemma);
    if (id === undefined || newId[id] < 0) continue;
    const k = searchKey(form);
    if (!k) continue;
    ins.run(k, newId[id], form, 'inflection');
    kept++;
  }
  log(`forms: ${n} raw, ${kept} attached to a searchable word`);
}
db.exec('COMMIT');
db.exec('DROP TABLE raw_form');

// ---------- index, meta, ANALYZE, VACUUM ----------
db.exec(fs.readFileSync(path.join(ROOT, 'shared/index.sql'), 'utf8'));
log('indexes created');

const frequentGlosses = {};
{
  const count = Object.fromEntries(LANGS.map(l => [l, new Map()]));
  for (const s of senses) if (s.gloss) { const m = count[entries[s.entry].edition]; m.set(s.gloss, (m.get(s.gloss) || 0) + 1); }
  for (const l of LANGS) frequentGlosses[l] = [...count[l]].sort((a, b) => b[1] - a[1]).slice(0, 50);
}
const meta = {
  pipeline_version: PIPELINE_VERSION,
  built_at: new Date().toISOString(),
  dump_set: dumpSet,
  dumps: JSON.stringify(Object.fromEntries(Object.entries(manifest.files).map(([ed, f]) => [ed, { server_date: f.server_date, sha256: f.sha256 }]))),
  counters: JSON.stringify({ editions: stats, removed_words: removedWords }),
  frequent_glosses: JSON.stringify(frequentGlosses),
  word_ranges: JSON.stringify(ranges),
  assemble_seconds: String(Math.round((Date.now() - start) / 1000)),
};
const insM = db.prepare('INSERT OR REPLACE INTO meta VALUES (?, ?)');
for (const [k, v] of Object.entries(meta)) insM.run(k, v);
db.exec('ANALYZE');
db.exec('VACUUM');
db.close();
const size = fs.statSync(DB_TMP_PATH).size;
{
  const d = new DatabaseSync(DB_TMP_PATH);
  d.prepare('INSERT OR REPLACE INTO meta VALUES (?, ?)').run('size_bytes', String(size));
  d.prepare('INSERT OR REPLACE INTO meta VALUES (?, ?)').run('size_by_lang', JSON.stringify(sizeByLang(d)));
  d.close();
}
const min = (Date.now() - start) / 60000;
log(`done: ${DB_TMP_PATH} (${(size / 1e6).toFixed(0)} MB) in ${min.toFixed(1)} min${min > 15 ? ' — WARNING: 15 min cap exceeded' : min > 5 ? ' — WARNING: 5 min budget exceeded' : ''}`);
console.log(JSON.stringify({ removed_words: removedWords, ...Object.fromEntries(LANGS.map(l => [l, { tr6: stats[l].tr6, kept: stats[l].kept, rejects: stats[l].rejects, orphans: stats[l].orphans }])) }, null, 1));
