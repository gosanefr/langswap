// Règles de nettoyage et de rattachement aux sens (ticket 013), appliquées par `assemble`.
import { searchKey } from '../shared/normalize.mjs';
import { GENDER_ONLY, DIALECTS, COUNTRY_KEYS } from '../shared/lists.mjs';

const LATIN = /\p{Script=Latin}/u;

/**
 * Texte brut d'une traduction → morceaux gardés `{ w, si? }` (si = sous-sens propre à un morceau), ou rejet.
 * @returns {{ pieces: {w:string, si?:string}[], reject?: string, fixed?: boolean }}
 */
export function cleanWord(raw, { edition, entryLang, targetLang, headword, tags = [] }) {
  let w = String(raw ?? '').trim();
  if (!w) return { pieces: [], reject: 'empty' };
  if (targetLang === entryLang) return { pieces: [], reject: 'entry-lang' };
  if (tags.some(t => DIALECTS.has(t))) return { pieces: [], reject: 'dialect' };

  let fixed = false;
  // en : préfixe `[n] ^((please verify))`, crochets de rection en tête ou en fin.
  if (edition === 'en') {
    const before = w;
    w = w.replace(/^\[\d+\]\s*\^\(\(please verify\)\)\s*/i, '')
      .replace(/^\[[^\]]*\]\s+/, '')
      .replace(/\s+\[[^\]]*\]$/, '')
      .trim();
    if (w !== before) fixed = true;
  }

  // de : `x ; [2] y` → morceaux avec leur sous-sens.
  let pieces = [{ w }];
  if (edition === 'de' && / ; \[/.test(w)) {
    pieces = w.split(/ ; (?=\[)/).map((p, i) => {
      const m = /^\[([^\]]+)\]\s*(.*)$/.exec(p);
      return i > 0 && m ? { w: m[2], si: m[1].replace(/\s+/g, '') } : { w: p };
    });
  }
  // de : `x ( ), y ( )` → découpage sur `, ` puis retrait du `( )` final.
  if (edition === 'de') {
    pieces = pieces.flatMap(m => /\(\s*\)/.test(m.w) && /, /.test(m.w)
      ? m.w.split(/, /).map(p => ({ ...m, w: p })) : [m]);
    pieces = pieces.map(m => ({ ...m, w: m.w.replace(/\s*\(\s*\)\s*$/, '') }));
  }
  // ` / ` → variantes de même rang.
  pieces = pieces.flatMap(m => / \/ /.test(m.w) ? m.w.split(/ \/ /).map(p => ({ ...m, w: p })) : [m]);

  const kept = [];
  let reject = null;
  for (const m of pieces) {
    let x = m.w.trim();
    // Ponctuation de bord et crochet isolé.
    const before = x;
    x = x.replace(/^[\s,;:/]+|[\s,;:/]+$/g, '');
    if (/^[[(]/.test(x) && !/[\])]/.test(x)) x = x.slice(1);
    if (/[\])]$/.test(x) && !/[[(]/.test(x)) x = x.slice(0, -1);
    x = x.trim();
    if (x !== before) fixed = true;

    if (!x) { reject = 'empty'; continue; }
    if (GENDER_ONLY.has(x)) { reject = 'gender-only'; continue; }
    if (!LATIN.test(x)) { reject = 'non-latin'; continue; }
    if (edition === 'de' && /\(\s*\)/.test(x)) { reject = 'empty-parens'; continue; }
    if (edition === 'it' && targetLang === 'es' && COUNTRY_KEYS.has(searchKey(x)) && !COUNTRY_KEYS.has(searchKey(headword))) { reject = 'country'; continue; }
    kept.push({ ...m, w: x });
  }
  return { pieces: kept, reject: kept.length ? null : (reject || 'empty'), fixed };
}

/** `sense_index` → numéros (`'2'`, `'2a'`…), ou null pour « sans sens précis » (de `*`/`?`, fr/pt `0`). */
export function senseNumbers(si) {
  if (si == null) return null;
  const s = String(si).trim();
  if (!s || s === '*' || s === '?' || s === '0') return null;
  const out = [];
  for (const part of s.split(/\s*(?:[,;/]|\be\b|\by\b|\bund\b)\s*/)) {
    if (!part) continue;
    const r = /^(\d+)\s*[-–—]\s*(\d+)$/.exec(part);
    if (r) { const [a, b] = [Number(r[1]), Number(r[2])]; if (b >= a && b - a < 60) for (let i = a; i <= b; i++) out.push(String(i)); continue; }
    const n = /^(\d+[a-zα-ω]?)\.?$/.exec(part);
    if (n) out.push(n[1]);
  }
  return out.length ? [...new Set(out)] : null;
}

/** pt : plage tronquée (`{{tradini|De 1 e 2…}}`) → numéros supplémentaires repris dans `sense` + glose nettoyée. */
export function reparsePt(si, sense) {
  if (!sense) return { extra: [], gloss: sense };
  const m = /^\s*((?:(?:e|,|–|-|a|até)\s*\d+\s*)+)(.*)$/.exec(sense);
  if (!m) return { extra: [], gloss: sense };
  const extra = [];
  let prev = Number(si);
  for (const t of m[1].matchAll(/(e|,|–|-|a|até)\s*(\d+)/g)) {
    const n = Number(t[2]);
    if ((t[1] === '–' || t[1] === '-' || t[1] === 'a' || t[1] === 'até') && n > prev && n - prev < 40) for (let i = prev + 1; i <= n; i++) extra.push(String(i));
    else extra.push(String(n));
    prev = n;
  }
  const gloss = m[2].replace(/^[\s(:,–-]+|[\s)]+$/g, '').trim();
  return { extra, gloss: gloss || null };
}

/** Résout des numéros contre l'ensemble des numéros d'une entrée (de/es : `2a` → `2a` sinon `2` ; `2` → ses sous-sections). */
export function resolve(nums, available) {
  const ok = [];
  for (const n of nums) {
    if (available.has(n)) { ok.push(n); continue; }
    const base = /^(\d+)[a-zα-ω]$/.exec(n);
    if (base && available.has(base[1])) { ok.push(base[1]); continue; }
    if (/^\d+$/.test(n)) {
      const subs = [...available].filter(d => d.startsWith(n) && /^[a-zα-ω]$/.test(d.slice(n.length)));
      ok.push(...subs);
    }
  }
  return [...new Set(ok)];
}

/** Gloses anglaises d'une entrée étrangère de l'édition en → mots anglais (ticket 012 §2). */
export function glossWords(gloss, links) {
  const targets = new Set();
  for (const [text, target] of links || []) if (target && !target.includes('#') && text) targets.add(text.trim());
  const words = [];
  for (let el of gloss.split(/[,;]/)) {
    el = el.replace(/\([^)]*\)/g, ' ').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim()
      .replace(/^to\s+/i, '').replace(/^(?:a|an|the)\s+/i, '').replace(/[.:!?]+$/, '').trim();
    if (!el || el.split(' ').length > 3) continue;
    if (targets.has(el) && !words.includes(el)) words.push(el);
  }
  return words;
}
