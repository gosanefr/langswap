// Construction d'un résultat de recherche (tickets 002, 003, 004, 012) à partir des requêtes SQL.
import { searchKey, lightNormalize } from '../shared/normalize.mjs';
import { LANGS, PIVOT_CAP, INVERSE_SENSE_CAP } from '../shared/constants.mjs';
import { POS_LABELS_FR } from '../shared/lists.mjs';

import { prepareAll } from './queries.mjs';

const GROUP_CAP = 12;   // garde-fou de latence : au-delà, « N autres correspondances »
const hasAccents = s => /\p{M}/u.test(s.normalize('NFD'));

/**
 * @param {object} q requêtes préparées (queries.mjs)
 * @param {{ input: string, source: string|null, langs: string[], pivot: 'complement'|'fallback'|'off', destination?: string|null }} opts
 *   source null = AUTO ; destination non nulle = mode 1 langue (le pivot « fallback » ne regarde que cette colonne).
 */
export function search(q, { input, source = null, langs = LANGS, pivot = 'complement', destination = null }) {
  const start = performance.now();
  const k = searchKey(input);
  const res = { input, key: k, source, fallback: false, groups: [], more: 0, ms: 0 };
  if (!k) return res;
  const configured = new Set(langs);
  if (source && !configured.has(source)) configured.add(source);

  let rows = q.forms.all(k).filter(r => configured.has(r.lang));
  if (source) {
    const inSource = rows.filter(r => r.lang === source);
    if (inSource.length) rows = inSource;
    else { res.fallback = rows.length > 0; rows = rows.filter(r => r.lang !== source); }
  }
  if (!rows.length) { res.ms = performance.now() - start; return res; }

  // Groupes : layer 'word' (entrées) puis layer 'inflection' (un groupe par lemme) ; exact au caractère près en tête.
  const exactInput = lightNormalize(input);
  const groups = new Map();
  for (const r of rows) {
    const groupKey = r.layer + ':' + r.word_id;
    let g = groups.get(groupKey);
    if (!g) groups.set(groupKey, g = { layer: r.layer, word: { id: r.word_id, lang: r.lang, text: r.text, volume: r.volume }, forms: [], exact: false });
    if (!g.forms.includes(r.orig_form)) g.forms.push(r.orig_form);
    if (lightNormalize(r.orig_form) === exactInput) g.exact = true;
  }
  const alreadyWord = new Set([...groups.values()].filter(g => g.layer === 'word').map(g => g.word.id));
  let list = [...groups.values()].filter(g => g.layer === 'word' || !alreadyWord.has(g.word.id));
  const order = (a, b) => (a.layer === b.layer ? 0 : a.layer === 'word' ? -1 : 1) || (b.exact - a.exact) || (b.word.volume - a.word.volume);
  list.sort(order);

  // « aussi : péché, pêché » : variantes d'accent ou de casse de la même layer et de la même langue.
  for (const g of list) {
    if (!g.exact) continue;
    g.also = list.filter(v => v !== g && !v.exact && v.layer === g.layer && v.word.lang === g.word.lang).map(v => v.layer === 'word' ? v.word.text : v.forms[0]);
  }
  res.inputWithoutAccent = !hasAccents(input);
  res.more = Math.max(0, list.length - GROUP_CAP);
  list = list.slice(0, GROUP_CAP);

  const memo = new Map();   // voisins par id, partagés entre groupes d'une même requête
  for (const g of list) {
    Object.assign(g, senseTable(q, g.word, configured));
    g.near = pivot === 'off' ? {} : near(q, g.word, g, configured, pivot, destination, memo);
    delete g.firmWords;
  }
  res.groups = list;
  res.ms = performance.now() - start;
  return res;
}

/** Requêtes préparées + plages d'ids par langue, pour une connexion au dictionnaire. */
export function createContext(db) {
  const q = prepareAll(db);
  const meta = Object.fromEntries(q.meta.all().map(r => [r.name, r.value]));
  q.ranges = JSON.parse(meta.word_ranges);
  q.meta = meta;
  return q;
}

/** Tableau sens × langues d'un mot (ticket 003, 012). */
function senseTable(q, word, configured) {
  const rows = [];
  const bySense = new Map();
  const addCell = (row, lang, w) => {
    if (lang === word.lang || !configured.has(lang)) return;
    const c = row.cells[lang] ||= [];
    if (!c.some(x => x.text === w.text)) c.push(w);
  };

  // 1. Sens des entrées du mot : édition native d'abord, puis les autres éditions (`en ·`, `de ·`).
  for (const r of q.wordSenses.all(word.id)) {
    let row = bySense.get(r.sense_id);
    if (!row) {
      const native = r.edition === word.lang;
      row = {
        id: r.sense_id, pos: r.pos, gloss: r.gloss, anchor: !!r.anchor, cells: {},
        type: r.gloss == null ? 'none' : native ? 'native' : 'edition',
        label: native || r.gloss == null ? null : `${r.edition} ·`,
        order: [native ? 0 : 1 + LANGS.indexOf(r.edition), r.entry_rank, r.sense_rank],
      };
      bySense.set(r.sense_id, row); rows.push(row);
    }
    addCell(row, r.lang, { id: r.word_id, text: r.text, gender: r.gender });
  }

  // 2. Sens inverses : sens d'autres entrées qui listent le mot ; frères seulement si ancre vraie.
  const siblings = new Map();
  for (const f of q.siblings.all(word.id)) {
    let l = siblings.get(f.sense_id); if (!l) siblings.set(f.sense_id, l = []); l.push(f);
  }
  const noneByPos = new Map();
  for (const r of q.inverseSenses.all(word.id)) {
    if (r.gloss == null) {
      // Pas de glose, pas d'ancre : seul le lien direct compte → ligne « sans sens précis » de la POS.
      noneByPos.set(r.pos, [...(noneByPos.get(r.pos) || []), { id: r.origin_id, lang: r.origin_lang, text: r.origin_text, gender: null }]);
      continue;
    }
    const row = {
      id: r.sense_id, pos: r.pos, gloss: r.gloss, anchor: !!r.anchor, cells: {}, type: 'inverse',
      label: `${r.origin_lang} · ${r.origin_text}`, originRank: r.sense_rank, originVolume: r.origin_volume,
    };
    addCell(row, r.origin_lang, { id: r.origin_id, text: r.origin_text, gender: null });
    for (const f of (r.anchor && siblings.get(r.sense_id)) || []) addCell(row, f.lang, { id: f.word_id, text: f.text, gender: f.gender });
    row.coverage = Object.keys(row.cells).length;
    rows.push(row);
  }

  // « sans sens précis » : une ligne par POS (natives sans sens + liens directs entrants sans glose).
  const none = new Map();
  for (const l of rows.filter(x => x.type === 'none')) {
    const s = none.get(l.pos);
    if (!s) { none.set(l.pos, l); l.label = null; continue; }
    for (const [lang, ws] of Object.entries(l.cells)) for (const w of ws) addCell(s, lang, w);
    l.merged = true;
  }
  for (const [pos, ws] of noneByPos) {
    let s = none.get(pos);
    if (!s) { s = { id: `none-${pos}`, pos, gloss: null, anchor: false, cells: {}, type: 'none', label: null, order: [9, 0, 0] }; none.set(pos, s); rows.push(s); }
    for (const w of ws) addCell(s, w.lang, w);
  }
  const visible = rows.filter(l => !l.merged && Object.keys(l.cells).length);

  // Groupes POS : ordre de l'entrée native, sinon volume de traductions.
  const groups = new Map();
  for (const l of visible) {
    let g = groups.get(l.pos);
    if (!g) groups.set(l.pos, g = { pos: l.pos, label: POS_LABELS_FR[l.pos] || l.pos, rows: [], nativeOrder: Infinity, volume: 0 });
    g.rows.push(l);
    if (l.order && l.type !== 'none') g.nativeOrder = Math.min(g.nativeOrder, l.order[0] * 1e6 + l.order[1]);
    g.volume += Object.values(l.cells).reduce((s, c) => s + c.length, 0);
  }
  const typeRank = { native: 0, edition: 1, inverse: 2, none: 3 };
  const cmpOrder = (a, b) => a.order[0] - b.order[0] || a.order[1] - b.order[1] || a.order[2] - b.order[2];
  for (const g of groups.values()) {
    g.rows.sort((a, b) => typeRank[a.type] - typeRank[b.type]
      || (a.type === 'inverse' ? (b.coverage - a.coverage) || (a.originRank - b.originRank) || (b.originVolume - a.originVolume) : cmpOrder(a, b)));
    // Masquage (012 §4) : ligne `en ·` dont tous les mots en figurent déjà dans la colonne en d'une autre ligne du groupe.
    const enElsewhere = l => new Set(g.rows.filter(x => x !== l && x.type !== 'edition').flatMap(x => (x.cells.en || []).map(w => w.text)));
    g.rows = g.rows.filter(l => !(l.type === 'edition' && l.label === 'en ·' && !l.anchor
      && Object.keys(l.cells).every(k => k === 'en') && (l.cells.en || []).every(w => enElsewhere(l).has(w.text))));
  }
  const pos = [...groups.values()].sort((a, b) => a.nativeOrder - b.nativeOrder || b.volume - a.volume);

  // Plafond : sens natifs + 6 premiers sens inverses, puis « N autres sens ».
  let inverses = 0;
  for (const g of pos) for (const l of g.rows) if (l.type === 'inverse' && ++inverses > INVERSE_SENSE_CAP) l.hidden = true;
  const firmWords = new Set();
  for (const g of pos) for (const l of g.rows) for (const c of Object.values(l.cells)) for (const w of c) firmWords.add(w.id);
  for (const g of pos) for (const l of g.rows) { delete l.order; delete l.originVolume; delete l.originRank; delete l.coverage; delete l.merged; }
  for (const g of pos) { delete g.nativeOrder; delete g.volume; }

  return { pos, hiddenSenses: Math.max(0, inverses - INVERSE_SENSE_CAP), firmWords };
}

/** Pivot en chaîne à 1 saut (ticket 002) : mots nouveaux, triés par nombre de chemins (intermédiaires distincts). */
function near(q, word, group, configured, mode, destination, memo) {
  const firm = group.firmWords;
  // Langues à compléter : toutes (complément) ou seulement celles sans lien ferme (fallback).
  const firmLangs = new Set();
  for (const g of group.pos) for (const l of g.rows) for (const lang of Object.keys(l.cells)) firmLangs.add(lang);
  let targets = [...configured].filter(l => l !== word.lang);
  if (destination) targets = targets.filter(l => l === destination);
  if (mode === 'fallback') targets = targets.filter(l => !firmLangs.has(l));
  if (!targets.length) return {};
  const ranges = targets.map(l => q.ranges[l]);
  const isTarget = id => ranges.some(([a, b]) => id >= a && id <= b);
  // Voisins par lot : un appel pour tous les ids absents du mémo (≈ 70 → ≈ 15 appels SQL par recherche riche).
  const loadNeighbors = ids => {
    const missing = ids.filter(id => !memo.has(id));
    if (!missing.length) return;
    for (const id of missing) memo.set(id, []);
    for (const r of q.neighborsBatch.all(JSON.stringify(missing))) memo.get(r.source).push(r.id);
  };
  const neighbors = id => memo.get(id);

  // Intermédiaires : voisins fermes dans les langues de la recherche (configurées sur le poste, installées sur
  // Android : jamais « via » une langue hors du choix), les plus riches en chemins vers le mot d'abord, plafonnés.
  const scope = [...configured].map(l => q.ranges[l]);
  const inScope = id => scope.some(([a, b]) => id >= a && id <= b);
  const weight = new Map();
  loadNeighbors([word.id]);
  for (const id of neighbors(word.id)) if (id !== word.id && inScope(id)) weight.set(id, (weight.get(id) || 0) + 1);
  const intermediates = [...weight].sort((a, b) => b[1] - a[1]).slice(0, PIVOT_CAP).map(([id]) => id);

  const paths = new Map();   // candidat → Set(intermédiaire)
  loadNeighbors(intermediates);
  for (const i of intermediates) {
    for (const id of neighbors(i)) {
      if (id === word.id || weight.has(id) || firm.has(id) || !isTarget(id)) continue;
      let s = paths.get(id); if (!s) paths.set(id, s = new Set()); s.add(i);
    }
  }
  if (!paths.size) return {};
  // Ne nommer que ce qui sera envoyé : les 50 meilleurs candidats par langue (tri provisoire par chemins).
  const byLang = {};
  for (const [id, via] of paths) { const l = langOf(q, id); (byLang[l] ||= []).push([id, via]); }
  const kept = Object.values(byLang).flatMap(l => l.sort((a, b) => b[1].size - a[1].size).slice(0, 50));
  const info = new Map(q.wordsByIds.all(JSON.stringify([...kept.map(g => g[0]), ...intermediates])).map(r => [r.id, r]));
  const out = {};
  for (const [id, via] of kept) {
    const w = info.get(id);
    (out[w.lang] ||= []).push({ id, text: w.text, paths: via.size, volume: w.volume,
      via: [...via].map(v => info.get(v)).map(v => `${v.lang}:${v.text}`) });
  }
  for (const l of Object.keys(out)) out[l] = out[l].sort((a, b) => b.paths - a.paths || b.volume - a.volume).map(({ volume, ...x }) => x);
  return out;
}

function langOf(q, id) {
  for (const [l, [a, b]] of Object.entries(q.ranges)) if (id >= a && id <= b) return l;
  return null;
}

/** 2–3 premiers équivalents fermes d'une recherche (aperçu de l'historique, recalculé à l'affichage). */
export function preview(q, { input, source, langs, destination }) {
  const r = search(q, { input, source, langs, pivot: 'off' });
  const g = r.groups[0];
  if (!g) return [];
  const out = [];
  const order = destination ? [destination] : langs.filter(l => l !== g.word.lang);
  for (const p of g.pos) for (const l of p.rows) for (const lang of order) for (const w of l.cells[lang] || []) {
    if (out.length < 3 && !out.some(x => x.text === w.text)) out.push({ lang, text: w.text });
  }
  return out;
}
