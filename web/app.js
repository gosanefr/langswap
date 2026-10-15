// Interface LangSwap (tickets 003, 004, 005, 006) : modules ES, sans framework ni build.
import { lightNormalize } from './normalize.js';
import { t, posLabel, setUiLang, uiLang, applyStaticTexts, UI_LANGS } from './i18n.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CFG = await (await fetch('/api/config')).json();
const { langs: LANGS, names: NAMES, primary: PRIMARY, secondary: SECONDARY, nearCap: NEAR_CAP } = CFG;

// ---------- état (réglages persistés par navigateur) ----------
const readLocal = (k, d) => { try { const v = localStorage.getItem('langswap.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const writeLocal = (k, v) => { try { localStorage.setItem('langswap.' + k, JSON.stringify(v)); } catch { /* stockage indisponible */ } };
const oneOf = (v, list, d) => list.includes(v) ? v : d;   // valeurs stockées par une ancienne version : ignorées
const S = {
  src: readLocal('src', null),            // null = AUTO
  dst: readLocal('dst', 'en'),
  mode: oneOf(readLocal('mode', 'all'), ['all', 'one'], 'all'),
  showSecondary: readLocal('showSecondary', false),
  secondary: readLocal('secondary', SECONDARY),
  pivot: oneOf(readLocal('pivot', 'complement'), ['complement', 'fallback', 'off'], 'complement'),
  ui: readLocal('ui', null) ?? (navigator.languages || [navigator.language]).map(l => String(l).slice(0, 2).toLowerCase()).find(l => UI_LANGS.includes(l)) ?? 'fr',
  page: 'main',
};
const save = () => { for (const k of ['src', 'dst', 'mode', 'showSecondary', 'secondary', 'pivot']) writeLocal(k, S[k]); };
setUiLang(S.ui);
applyStaticTexts();
const configured = () => [...PRIMARY, ...SECONDARY.filter(l => S.secondary.includes(l))];
if (S.src && !configured().includes(S.src)) S.src = null;
if (!configured().includes(S.dst)) S.dst = 'en';

// ---------- toast ----------
let toastTimer;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 1200); }

// ---------- écran tactile (ticket 019) : une bulle d'actions remplace clic, double-clic et survol ----------
// Même test que les pastilles Alt+… masquées en CSS ; le poste ne change pas.
const touchQuery = matchMedia('(hover: none) and (pointer: coarse)');
const isTouch = () => touchQuery.matches;
const bubble = $('#bubble');
let bubbleActions = null;
function openBubble(anchor, actions, note = '') {
  bubbleActions = actions;
  bubble.innerHTML = `<div class="bubble-actions">${actions.map((a, i) => `<button role="menuitem" data-i="${i}" class="${a.danger ? 'danger' : ''}">${esc(a.label)}</button>`).join('')}</div>`
    + (note ? `<div class="bubble-note">${esc(note)}</div>` : '');
  bubble.hidden = false;
  // Au-dessus de l'élément ; en dessous s'il est trop près du haut de l'écran.
  const r = anchor.getBoundingClientRect(), b = bubble.getBoundingClientRect();
  bubble.style.left = Math.max(8, Math.min(r.left + r.width / 2 - b.width / 2, innerWidth - b.width - 8)) + 'px';
  bubble.style.top = (r.top - b.height - 8 >= 8 ? r.top - b.height - 8 : r.bottom + 8) + 'px';
}
function closeBubble() {
  if (bubble.hidden) return false;
  bubble.hidden = true; bubbleActions = null;
  return true;
}
bubble.addEventListener('click', e => {
  const b = e.target.closest('button[data-i]'); if (!b) return;
  const a = bubbleActions[b.dataset.i];
  closeBubble(); a.run();
});
// Fermée par un tap dehors (un tap sur un autre mot ouvre ensuite la sienne) ou par un défilement.
document.addEventListener('pointerdown', e => { if (!bubble.contains(e.target)) closeBubble(); }, true);
addEventListener('scroll', () => closeBubble(), true);

// ---------- pastilles ----------
function chips(sel, onClick, prefix, withAuto) {
  const p = (l, i, sec) => `<span class="chip ${sec ? 'sec' : ''} ${l === sel ? 'on' : ''}" data-l="${l}">${l.toUpperCase()}<span class="k">${prefix}${i + 1}</span></span>`;
  const sec = SECONDARY.filter(l => S.secondary.includes(l));
  return (withAuto ? `<span class="chip ${sel == null ? 'on' : ''}" data-l="auto">AUTO<span class="k">Alt+0</span></span><span class="sep wide"></span>` : '')
    + PRIMARY.map((l) => p(l, LANGS.indexOf(l))).join('')
    + (sec.length ? `<span class="sep"></span>` + sec.map(l => p(l, LANGS.indexOf(l), true)).join('') : '');
}
function renderBars() {
  $('#sources').innerHTML = chips(S.src, null, 'Alt+', true);
  $('#swap').disabled = S.src == null;
  $('#mode').textContent = t(S.mode === 'all' ? 'mode.all' : 'mode.one');
  $('#targets').innerHTML = S.mode === 'one'
    ? `<div class="lbl">${t('target')}</div><div class="chips">${chips(S.dst, null, `Alt+${t('shift')}+`, false)}</div>`
    : `<div class="lbl">${t('allLangs')}</div>`;
  const sec = SECONDARY.filter(l => S.secondary.includes(l));
  $('#secondary-toggle').hidden = S.mode !== 'all' || !sec.length;
  $('#secondary-names').textContent = sec.map(l => l.toUpperCase()).join('/');
  $('#show-secondary').checked = S.showSecondary;
}
$('#sources').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) chooseSource(c.dataset.l === 'auto' ? null : c.dataset.l); });
$('#targets').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) chooseTarget(c.dataset.l); });
$('#swap').addEventListener('click', () => swap());
$('#mode').addEventListener('click', () => toggleMode());
$('#show-secondary').addEventListener('change', e => { S.showSecondary = e.target.checked; save(); renderResult(); });

function chooseSource(l) {
  if (l === S.src) { if (l == null) return; }
  if (l && l === S.dst) S.dst = S.src ?? LANGS.find(x => x !== l && configured().includes(x));
  S.src = l; save(); renderBars(); rerun();
}
function chooseTarget(l) {
  if (l === S.src) S.src = S.dst;
  S.dst = l; save(); renderBars(); rerun();
}
function swap() {
  if (S.src == null) return;
  [S.src, S.dst] = [S.dst, S.src]; save(); renderBars(); rerun();
}
function toggleMode() { S.mode = S.mode === 'all' ? 'one' : 'all'; save(); renderBars(); rerun(); }

// ---------- recherche : en direct 250 ms après la dernière frappe, tout de suite sur Entrée ----------
const field = $('#input');
let timer = null, seq = 0;
let R = null;                 // dernier résultat affiché (non vide)
let current = null;           // { input, res, entryId, confirmed, parentId }
let lastTimed = null;         // dernière entrée créée par le seul délai : { id, t }
let fieldEmpty = true;

// Bouton « effacer » : visible dès qu'il y a du texte ; garde le focus (et le clavier du téléphone) dans le champ.
const clearButton = $('#clear-input');
const syncClear = () => { clearButton.hidden = !field.value; };
clearButton.addEventListener('pointerdown', e => e.preventDefault());
clearButton.addEventListener('click', () => {
  field.value = '';
  field.dispatchEvent(new Event('input'));
  field.focus();
});

field.addEventListener('input', () => {
  syncClear();
  clearTimeout(timer); clearTimeout(historyTimer);
  if (!field.value.trim()) { fieldEmpty = true; lastTimed = null; }
  timer = setTimeout(() => lookUp(field.value, { live: true }), 250);
});
field.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.altKey) { e.preventDefault(); clearTimeout(timer); lookUp(field.value, { enter: true }); }
  if (e.key === 'ArrowDown') { const w = document.querySelector('#result .word'); if (w) { e.preventDefault(); w.focus(); } }
});

function rerun() { if (field.value.trim()) lookUp(field.value, { setting: true }); else renderResult(); }

async function lookUp(input, { live = false, enter = false, setting = false, parentId = null, historyEntry = null } = {}) {
  syncClear();
  const n = ++seq;
  if (!input.trim()) { R = null; current = null; renderResult(); return; }
  const p = new URLSearchParams({ q: input, langs: configured().join(','), pivot: S.pivot });
  if (S.src) p.set('src', S.src);
  if (S.mode === 'one') p.set('dst', S.dst);
  let res;
  try { res = await (await fetch('/api/search?' + p)).json(); } catch { return; }
  if (n !== seq || lightNormalize(field.value) !== lightNormalize(input)) return;      // réponse périmée : jamais affichée
  if (res.error) { $('#result').innerHTML = `<div class="empty">${esc(res.error)}</div>`; return; }

  if (!res.groups.length) {
    // Mot partiel sans rien : le résultat précédent reste affiché en grisé ; sur Entrée, état vide explicite.
    if (R && live && !enter) { $('#result').classList.add('stale'); return; }
    R = null; current = null;
    $('#result').classList.remove('stale');
    $('#result').innerHTML = `<div class="empty">${t('noResults', esc(input), configured().length)}</div>`;
    return;
  }
  const sameSearch = current && current.input === input && setting;
  R = res;
  if (!sameSearch) {
    current = { input, res, entryId: historyEntry, confirmed: !!historyEntry, parentId };
    fieldEmpty = false;
  } else current.res = res;
  renderResult();
  if (historyEntry) return;
  if (parentId != null || enter) logSearch('confirmed');
  else if (!sameSearch) armTimer();
}

// ---------- rendu du résultat ----------
const wordHtml = (w, lang, extra = '') => `<span class="word" tabindex="0" data-lang="${lang}" data-text="${esc(w.text)}" ${extra}>${esc(w.text)}${w.gender ? `<span class="gender">${esc(w.gender)}</span>` : ''}</span>`;
const nearHtml = (list, lang, key) => {
  if (!list?.length) return '';
  const open = opened.has(key);
  const shown = open ? list : list.slice(0, NEAR_CAP);
  const title = p => `${t('via')} ${p.via.join(', ')} (${p.paths})`;
  return shown.map(p => `<span class="word" tabindex="0" data-lang="${lang}" data-text="${esc(p.text)}" data-via="${esc(p.via.join(', '))}" data-paths="${p.paths}" title="${esc(title(p))}" aria-label="${esc(p.text + ', ' + title(p))}">${esc(p.text)}${p.paths > 1 ? `<sup class="paths">${p.paths}</sup>` : ''}</span>`).join('')
    + (!open && list.length > NEAR_CAP ? `<span class="more" data-toggle="${esc(key)}">+${list.length - NEAR_CAP}</span>` : '');
};
const opened = new Set();       // colonnes « Proches » dépliées, groupes aux sens cachés dépliés

function glossHtml(row) {
  const label = row.label ? `<div><span class="tag">${esc(row.label)}</span></div>` : '';
  if (row.type === 'none') return `<span class="no-sense">${t('noSense')}</span>`;
  return `<div class="gloss-text" title="${esc(row.gloss)}">${esc(row.gloss)}</div>${label}`;
}

function groupHead(g, showLang) {
  const from = showLang ? t('from', NAMES[g.word.lang]) : '';
  const form = g.layer === 'inflection'
    ? ` <span class="form-of"><i>${esc(g.forms[0])}</i> → ${t('formOf')} <b>${esc(g.word.text)}</b></span>`
    : (!g.exact || showLang ? ` <span class="form-of"><b>${esc(g.word.text)}</b></span>` : '');
  const also = g.also?.length ? `<span class="also">${t('also')} : ${g.also.map(a => `<i>${esc(a)}</i>`).join(', ')}</span>` : '';
  return from || form.trim() || also ? `<div class="from">${from}${form}${also}</div>` : '';
}

function renderResult() {
  const div = $('#result');
  closeBubble();
  div.classList.remove('stale');
  if (!R) { div.innerHTML = field.value.trim() ? '' : `<div class="empty">${CFG.packs && !configured().length ? t('packs.none') : t('typeWord', S.src ? NAMES[S.src] : null)}</div>`; return; }
  const showLang = S.src == null || R.fallback;
  const fallback = R.fallback ? `<div class="fallback">${t('fallback', NAMES[S.src])}</div>` : '';
  const more = R.more ? `<div class="help">${t('moreMatches', R.more)}</div>` : '';
  div.innerHTML = fallback + (S.mode === 'one' ? renderOne(showLang) : renderAll(showLang)) + more;
}

function renderAll(showLang) {
  const shownLangs = [...PRIMARY, ...SECONDARY.filter(l => S.secondary.includes(l) && S.showSecondary)];
  const single = R.groups.length === 1 && !showLang;
  const cols = single ? shownLangs.filter(l => l !== R.groups[0].word.lang) : shownLangs;
  const width = (72 / cols.length).toFixed(2) + '%';
  let h = `<table class="grid"><colgroup><col style="width:28%">${cols.map(() => `<col style="width:${width}">`).join('')}</colgroup>`
    + `<tr><th>${t('sense')}</th>${cols.map(l => `<th>${l.toUpperCase()}</th>`).join('')}</tr>`;
  R.groups.forEach((g, gi) => {
    const head = groupHead(g, showLang);
    if (head) h += `<tr class="group-head"><td colspan="${cols.length + 1}">${head}</td></tr>`;
    const severalPos = g.pos.length > 1;
    const showHidden = opened.has('hidden:' + gi);
    h += `<tbody class="${showHidden ? 'show-collapsed' : ''}">`;
    for (const p of g.pos) {
      const full = p.rows.filter(l => cols.some(c => c !== g.word.lang && l.cells[c]?.length));
      if (!full.length) continue;
      if (severalPos) h += `<tr class="pos ${full.every(l => l.hidden) ? 'collapsed' : ''}"><td colspan="${cols.length + 1}">${esc(posLabel(p.pos, p.label))}</td></tr>`;
      for (const l of p.rows) {
        if (!cols.some(c => c !== g.word.lang && l.cells[c]?.length)) continue;   // rien dans les colonnes affichées
        h += `<tr class="${l.hidden ? 'collapsed' : ''}"><td class="gloss">${glossHtml(l)}</td>`
          + cols.map(c => c === g.word.lang
            ? `<td class="origin">${esc(g.word.text)}</td>`
            : `<td class="words">${(l.cells[c] || []).map(w => wordHtml(w, c)).join('')}</td>`).join('') + `</tr>`;
      }
    }
    if (g.hiddenSenses) h += `<tr class="more-row"><td colspan="${cols.length + 1}"><button class="link" data-toggle="hidden:${gi}">${showHidden ? t('hideSenses') : t('moreSenses', g.hiddenSenses)}</button></td></tr>`;
    const nearCols = cols.filter(c => c !== g.word.lang && g.near[c]?.length);
    if (nearCols.length) {
      h += `<tr class="near"><td class="gloss"><span class="no-sense">${t('near')}</span></td>`
        + cols.map(c => c === g.word.lang ? `<td class="origin"></td>` : `<td class="words">${nearHtml(g.near[c], c, `near:${gi}:${c}`)}</td>`).join('') + `</tr>`;
    }
    h += `</tbody>`;
  });
  return h + `</table>`;
}

function renderOne(showLang) {
  const d = S.dst;
  let h = '', nothing = true;
  R.groups.forEach((g, gi) => {
    if (g.word.lang === d) return;
    let body = '';
    const severalPos = g.pos.filter(p => p.rows.some(l => l.cells[d]?.length)).length > 1;
    const showHidden = opened.has('hidden:' + gi);
    let hidden = 0;
    for (const p of g.pos) {
      const rows = p.rows.filter(l => l.cells[d]?.length);
      if (!rows.length) continue;
      if (severalPos && (showHidden || rows.some(l => !l.hidden))) body += `<div class="pos-title">${esc(posLabel(p.pos, p.label))}</div>`;
      for (const l of rows) {
        if (l.hidden) { hidden++; if (!showHidden) continue; }
        body += `<div class="sense-row"><div class="gloss">${glossHtml(l)}</div><div class="words">${l.cells[d].map(w => wordHtml(w, d)).join('')}</div></div>`;
      }
    }
    if (hidden) body += `<div><button class="link" data-toggle="hidden:${gi}">${showHidden ? t('hideSenses') : t('moreSenses', hidden)}</button></div>`;
    if (g.near[d]?.length) body += `<div class="sense-row near"><div class="gloss"><span class="no-sense">${t('near')}</span></div><div class="words">${nearHtml(g.near[d], d, `near:${gi}:${d}`)}</div></div>`;
    if (!body) return;
    nothing = false;
    h += groupHead(g, showLang) + body;
  });
  return nothing ? `<div class="empty">${t('noEquivalent', NAMES[d])}</div>` : h;
}

// ---------- interaction sur les mots : clic = copier, double-clic = nouvelle recherche ; tactile : tap = bulle ----------
$('#result').addEventListener('click', e => {
  const o = e.target.closest('[data-toggle]');
  if (o) { const k = o.dataset.toggle; opened.has(k) ? opened.delete(k) : opened.add(k); renderResult(); return; }
  const w = e.target.closest('.word');
  if (w) isTouch() ? wordBubble(w) : copy(w);
});
$('#result').addEventListener('dblclick', e => { if (isTouch()) return; const w = e.target.closest('.word'); if (w) { window.getSelection()?.removeAllRanges(); bounce(w); } });
$('#result').addEventListener('keydown', e => {
  const w = e.target.closest('.word');
  if (!w) return;
  if (e.key === 'Enter' && e.altKey) { e.preventDefault(); bounce(w); }
  else if (e.key === 'Enter') { e.preventDefault(); copy(w); }
  else if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
    const all = [...document.querySelectorAll('#result .word')].filter(x => x.offsetParent);
    const i = all.indexOf(w);
    const j = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? i + 1 : i - 1;
    if (j < 0) field.focus(); else all[Math.min(j, all.length - 1)]?.focus();
  }
});

// Bulle du mot : mêmes actions que le poste ; « via … » en lecture seule, sur les mots du pivot seulement.
function wordBubble(w) {
  const note = w.dataset.via ? t('bubble.via', w.dataset.via, Number(w.dataset.paths)) : '';
  openBubble(w, [{ label: t('bubble.copy'), run: () => copy(w) }, { label: t('bubble.search'), run: () => bounce(w) }], note);
}

async function copy(w) {
  const text = w.dataset.text;
  try { await navigator.clipboard.writeText(text); } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text }); document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  w.classList.add('copied'); setTimeout(() => w.classList.remove('copied'), 400);
  toast(t('copied', text));
  logSearch('confirmed');
}

async function bounce(w) {
  // Langue du mot en source fixée, destination inchangée ; l'entrée créée est liée à son parent.
  const parent = await logSearch('confirmed');
  const lang = w.dataset.lang;
  if (S.dst === lang) S.dst = S.src ?? (current?.res.groups[0]?.word.lang) ?? S.dst;
  if (S.dst === lang) S.dst = LANGS.find(l => l !== lang);
  S.src = lang; save(); renderBars();
  field.value = w.dataset.text;
  if (isTouch()) field.blur(); else field.focus();   // tactile : pas de clavier, le résultat reste visible
  clearTimeout(timer);
  lastTimed = null;
  lookUp(field.value, { parentId: parent ?? null });
}

// ---------- historique : création des entrées (ticket 006 §1–3) ----------
let historyTimer = null;
function armTimer() {
  clearTimeout(historyTimer);
  historyTimer = setTimeout(() => logSearch('timer'), 2000);
}
function entryData(c) {
  const langs = [...new Set(c.res.groups.map(g => g.word.lang))];
  return { input: c.input, lemma: c.res.groups[0].word.text, langs: S.src && !c.res.fallback ? [S.src] : langs };
}
let logQueue = Promise.resolve();
function logSearch(trigger) {
  logQueue = logQueue.then(() => logSearchNow(trigger)).catch(() => null);
  return logQueue;
}
async function logSearchNow(trigger) {
  const c = current;
  if (!c || !c.res?.groups.length) return null;
  if (c.entryId) { if (trigger === 'confirmed') { c.confirmed = true; if (lastTimed?.id === c.entryId) lastTimed = null; } return c.entryId; }
  clearTimeout(historyTimer);
  const d = entryData(c);
  if (c.parentId) d.parentId = c.parentId;
  // Une entrée créée par le seul délai est remplacée si la saisie la prolonge ou la corrige dans les 10 s.
  if (trigger === 'timer' && lastTimed && !fieldEmpty && Date.now() - lastTimed.t < 10000 && !c.parentId) {
    await fetch('/api/history/' + lastTimed.id, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) });
    c.entryId = lastTimed.id;
    lastTimed.t = Date.now();
    return c.entryId;
  }
  const r = await (await fetch('/api/history', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) })).json();
  c.entryId = r.id;
  c.confirmed = trigger === 'confirmed';
  lastTimed = trigger === 'timer' ? { id: r.id, t: Date.now() } : null;
  return r.id;
}

// ---------- page Historique ----------
const H = { rows: [], end: false, loading: false, filter: '' };
const historyList = $('#history-list');
let filterTimer;
$('#filter').addEventListener('input', () => { clearTimeout(filterTimer); filterTimer = setTimeout(() => { H.filter = $('#filter').value; loadHistory(true); }, 150); });
$('#filter').addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); historyList.querySelector('.entry')?.focus(); } });

async function loadHistory(reset) {
  if (reset) { H.rows = []; H.end = false; }
  if (H.end || H.loading) return;
  H.loading = true;
  const before = H.rows.at(-1)?.id ?? '';
  const p = new URLSearchParams({ before, limit: 100, filter: H.filter });
  const batch = await (await fetch('/api/history?' + p)).json();
  H.loading = false;
  if (batch.length < 100) H.end = true;
  H.rows.push(...batch);
  renderHistory();
  // Aperçus recalculés à l'affichage.
  const r = await fetch('/api/previews', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: batch.map(({ input, langs }) => ({ input, langs })), langs: configured().join(','), dst: S.mode === 'one' ? S.dst : null }) });
  const previews = await r.json();
  batch.forEach((l, i) => { l.preview = previews[i]; });
  renderHistory();
}

const dayOf = iso => {
  const d = new Date(iso), today = new Date();
  const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(today) - day(d)) / 864e5);
  return diff === 0 ? t('today') : diff === 1 ? t('yesterday') : d.toLocaleDateString(t('locale'), { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};
function renderHistory() {
  const focusId = document.activeElement?.closest?.('.entry')?.dataset.id;
  // Blocs : une entrée + ses rebonds qui la suivent directement (en retrait, sous elle).
  const chrono = [...H.rows].reverse();
  const blocks = [];
  chrono.forEach((l, i) => {
    const prev = chrono[i - 1];
    if (l.parentId && prev && blocks.length && blocks.at(-1).some(x => x.id === l.parentId) && blocks.at(-1).at(-1) === prev) blocks.at(-1).push(l);
    else blocks.push([l]);
  });
  blocks.reverse();
  let h = '', day = null;
  for (const b of blocks) {
    const d = dayOf(b[0].timestamp);
    if (d !== day) { h += `<div class="day">${esc(d)}</div>`; day = d; }
    b.forEach((l, k) => {
      const time = new Date(l.timestamp).toLocaleTimeString(t('locale'), { hour: '2-digit', minute: '2-digit' });
      const lemma = l.lemma && l.lemma !== l.input ? ` <span class="lemma">→ <i>${esc(l.lemma)}</i></span>` : '';
      const from = l.parentId && l.parent ? `<span class="entry-from">↳ ${t('fromParent')} <i>${esc(l.parent)}</i></span>` : '';
      const preview = l.preview?.length ? `<span class="preview">${l.preview.map(a => esc(a.text)).join(', ')}</span>` : '';
      h += `<div class="entry ${k > 0 ? 'bounce' : ''}" tabindex="0" data-id="${l.id}">
        <span class="time">${time}</span>
        <span><span class="entry-input">${esc(l.input)}</span>${lemma}${l.langs.map(x => `<span class="badge">${x.toUpperCase()}</span>`).join('')}${from}${preview}</span>
        <button class="delete" title="${t('delete')}" tabindex="-1">×</button></div>`;
    });
  }
  historyList.innerHTML = h || `<div class="empty">${t(H.filter ? 'noMatchingEntry' : 'historyEmpty')}</div>`;
  $('#history-end').textContent = H.end ? '' : t('loadMore');
  if (focusId) historyList.querySelector(`.entry[data-id="${focusId}"]`)?.focus();
}
const entryOf = el => H.rows.find(l => String(l.id) === el.dataset.id);
// Tactile : appui long sur une entrée = bulle « Supprimer » (sélection de texte et menu natif bloqués en CSS).
let pressTimer = null, pressStart = null, longPressed = false;
historyList.addEventListener('pointerdown', e => {
  const el = e.target.closest('.entry'); if (!el || !isTouch()) return;
  longPressed = false; pressStart = { x: e.clientX, y: e.clientY };
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    longPressed = true;
    openBubble(el, [{ label: t('bubble.delete'), danger: true, run: () => deleteEntry(el) }]);
  }, 500);
});
historyList.addEventListener('pointermove', e => { if (pressStart && Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > 10) clearTimeout(pressTimer); });
for (const type of ['pointerup', 'pointercancel']) historyList.addEventListener(type, () => { clearTimeout(pressTimer); pressStart = null; });
historyList.addEventListener('contextmenu', e => { if (isTouch() && e.target.closest('.entry')) e.preventDefault(); });
historyList.addEventListener('click', e => {
  const el = e.target.closest('.entry'); if (!el) return;
  if (longPressed) { longPressed = false; return; }   // fin d'un appui long : la bulle est ouverte, l'entrée ne s'ouvre pas
  if (e.target.closest('.delete')) deleteEntry(el); else reopen(entryOf(el));
});
historyList.addEventListener('keydown', e => {
  const el = e.target.closest('.entry'); if (!el) return;
  const all = [...historyList.querySelectorAll('.entry')];
  const i = all.indexOf(el);
  if (e.key === 'ArrowDown') { e.preventDefault(); all[i + 1]?.focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); (all[i - 1] ?? $('#filter')).focus(); }
  else if (e.key === 'Enter') { e.preventDefault(); reopen(entryOf(el)); }
  else if (e.key === 'Delete') { e.preventDefault(); const next = all[i + 1] ?? all[i - 1]; deleteEntry(el).then(() => next && historyList.querySelector(`.entry[data-id="${next.dataset.id}"]`)?.focus()); }
});
async function deleteEntry(el) {
  await fetch('/api/history/' + el.dataset.id, { method: 'DELETE' });
  H.rows = H.rows.filter(l => String(l.id) !== el.dataset.id);
  renderHistory();
}
function reopen(l) {
  // Relance la recherche sans créer d'entrée ; source = langue d'origine, AUTO si plusieurs.
  if (!l) return;
  S.src = l.langs.length === 1 && configured().includes(l.langs[0]) ? l.langs[0] : null;
  if (S.src && S.src === S.dst) S.dst = LANGS.find(x => x !== S.src);
  save(); renderBars();
  field.value = l.input;
  lastTimed = null;
  goTo('main');
  lookUp(l.input, { historyEntry: l.id });
}
new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && S.page === 'history') loadHistory(false); })
  .observe($('#history-end'));

// ---------- page Config ----------
function renderConfig() {
  $('#cfg-langs').innerHTML = SECONDARY.map(l => `<label class="chip ${S.secondary.includes(l) ? 'on' : ''}" data-l="${l}">${l.toUpperCase()} · ${NAMES[l]}</label>`).join('');
  $('#cfg-pivot').innerHTML = ['complement', 'fallback', 'off'].map(v => `<label><input type="radio" name="pivot" value="${v}" ${S.pivot === v ? 'checked' : ''}> ${t('pivot.' + v)}</label>${v !== 'off' ? `<div class="help">${t('pivot.' + v + 'Help')}</div>` : ''}`).join('');
  $('#cfg-clear').innerHTML = `<button class="btn danger" id="clear">${t('clearAll')}</button>`;
  if (CFG.packs) renderPacks();
}

// ---------- packs de langue (appli Android seulement : /api/config → packs) ----------
// État lu sur /api/packs (Packs.kt) ; relu toutes les 500 ms tant qu'un téléchargement ou une lecture du manifeste est
// en cours. Fin d'installation : l'appli recharge elle-même la page (MainActivity), qui rouvre le dictionnaire.
const P = { state: null, choice: null, timer: null };
async function loadPacks() {
  try { P.state = await (await fetch('/api/packs')).json(); } catch { return; }
  renderPacks();
  clearTimeout(P.timer);
  const busy = ['loading', 'downloading', 'installing'].includes(P.state.status?.state);
  const waiting = P.state.server && !P.state.manifest && !P.state.manifestError;
  if (busy || waiting) P.timer = setTimeout(loadPacks, 500);
}
function renderPacks() {
  const box = $('#cfg-packs'), s = P.state;
  if (!s) return;
  renderServer();
  if (!s.server) { box.innerHTML = `<div class="help">${t('packs.noServer')}</div>`; return; }
  const m = s.manifest;
  if (!m) {
    box.innerHTML = s.manifestError
      ? `<div class="help">${esc(t('packs.unreachable', s.server, s.manifestError))}</div><div class="packs-actions"><button class="btn" id="packs-retry">${t('packs.retry')}</button></div>`
      : `<div class="help">${t('packs.loading')}</div>`;
    return;
  }
  const installed = s.installed?.langs ?? m.langs.filter(l => s.present.includes('pack-' + l));
  P.choice ??= installed.length ? [...installed] : m.langs.filter(l => ['fr', 'en', 'es'].includes(l));
  const st = s.status ?? {}, busy = ['downloading', 'installing'].includes(st.state);
  const sameBuild = s.installed?.build === m.build;
  const update = installed.length > 0 && !sameBuild;
  // Fichiers voulus pour ce choix (comme Packs.kt) : base + packs cochés.
  const wanted = ['base', ...P.choice.map(l => 'pack-' + l)];
  const mb = b => Math.round(b / 1e6);
  const download = wanted.filter(n => !sameBuild || !s.present.includes(n)).reduce((a, n) => a + m.files[n].bytes, 0);
  const disk = wanted.reduce((a, n) => a + m.files[n].sqliteBytes, 0);
  const changed = update || download > 0 || [...P.choice].sort().join() !== [...installed].sort().join();
  const rows = m.langs.map(l => `<label class="pack-row"><input type="checkbox" data-l="${l}" ${P.choice.includes(l) ? 'checked' : ''} ${busy ? 'disabled' : ''}>`
    + `<b>${l.toUpperCase()}</b> ${esc(NAMES[l])} ${installed.includes(l) ? `<span class="tag">${t('packs.installed')}</span>` : ''}`
    + `<span class="size">${mb(m.files['pack-' + l].bytes)} ${t('packs.mb')}</span></label>`).join('');
  let status = '';
  if (busy) status = `${esc(st.state === 'installing' ? t('packs.installing', st.file) : t('packs.downloading', st.file, mb(st.done), mb(st.total)))}<progress value="${st.done}" max="${st.total}"></progress>`;
  else if (st.state === 'error') status = esc(t('packs.error', st.error));
  else if (update) status = esc(t('packs.update', new Date(m.build).toLocaleDateString(t('locale'))));
  const tooFew = P.choice.length < 2;
  box.innerHTML = rows + (status ? `<div class="packs-status">${status}</div>` : '')
    + (tooFew ? `<div class="help">${t('packs.tooFew')}</div>` : '')
    + `<div class="packs-actions"><button class="btn" id="packs-apply" ${busy || tooFew || !changed ? 'disabled' : ''}>${t('packs.apply', mb(download), mb(disk))}</button></div>`;
}
$('#cfg-packs').addEventListener('change', e => {
  const l = e.target.dataset.l; if (!l) return;
  P.choice = e.target.checked ? [...P.choice, l] : P.choice.filter(x => x !== l);
  renderPacks();
});
$('#cfg-packs').addEventListener('click', async e => {
  if (e.target.id === 'packs-apply') {
    e.target.disabled = true;
    const r = await (await fetch('/api/packs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ langs: P.choice }) })).json();
    if (r.error) { P.state.status = { state: 'error', error: r.error }; renderPacks(); return; }
    loadPacks();
  }
  if (e.target.id === 'packs-retry') { await fetch('/api/packs/refresh', { method: 'POST' }); loadPacks(); }
});
$('#cfg-langs').addEventListener('click', e => {
  const c = e.target.closest('[data-l]'); if (!c) return;
  const l = c.dataset.l;
  S.secondary = S.secondary.includes(l) ? S.secondary.filter(x => x !== l) : SECONDARY.filter(x => x === l || S.secondary.includes(x));
  if (S.src && !configured().includes(S.src)) S.src = null;
  if (!configured().includes(S.dst)) S.dst = 'en';
  save(); renderConfig(); renderBars(); R = null;
});
$('#cfg-pivot').addEventListener('change', e => { S.pivot = e.target.value; save(); R = null; });
$('#cfg-clear').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'clear') {
    $('#cfg-clear').innerHTML = `<span>${t('confirmClear')}</span> <button class="btn danger" id="confirm">${t('confirm')}</button> <button class="btn" id="cancel">${t('cancel')}</button>`;
    $('#confirm').focus();
  } else if (b.id === 'confirm') {
    await fetch('/api/history', { method: 'DELETE' });
    H.rows = []; current && (current.entryId = null); lastTimed = null;
    $('#cfg-clear').innerHTML = `<span class="help">${t('cleared')}</span>`;
    setTimeout(renderConfig, 1500);
  } else renderConfig();
});
async function renderMeta() {
  const m = await (await fetch('/api/meta')).json();
  if (m.error) { $('#cfg-meta').textContent = m.error; return; }
  const mb = t('locale') === 'fr-FR' ? 'Mo' : 'MB';
  $('#cfg-meta').textContent = t('metaDb', new Date(m.builtAt).toLocaleString(t('locale')), m.pipelineVersion, (m.sizeBytes / 1e6).toFixed(0)) + '\n'
    + t('metaDumpSet', m.dumpSet) + '\n' + Object.entries(m.dumps).map(([ed, d]) => `  ${ed}  ${new Date(d.serverDate).toLocaleDateString(t('locale'))}  sha256 ${d.sha256.slice(0, 16)}…`).join('\n')
    + (m.sizeByLang ? `\n\n${t('metaSizes')}\n`
      + LANGS.filter(l => m.sizeByLang[l]).map(l => { const s = m.sizeByLang[l];
        return `  ${l}  ${String(Math.round(s.bytes / 1e6)).padStart(4)} ${mb}  ${t('metaForms')} ${String(Math.round(s.forms / 1e6)).padStart(4)} ${mb}`; }).join('\n')
      + `\n  ${t('metaNote')}` : '');
}

// ---------- à propos (attribution CC BY-SA 4.0 des données, licence de l'appli : ticket 017) ----------
async function renderAbout() {
  const A = CFG.about, link = (url, text) => `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text ?? url.replace(/^https:\/\//, ''))}</a>`;
  let m = {};
  try { m = await (await fetch('/api/meta')).json(); } catch { /* sans dictionnaire : pas de dates */ }
  const wikt = `https://${['fr', 'en', 'es'].includes(uiLang()) ? uiLang() : 'en'}.wiktionary.org/`;
  $('#cfg-about').innerHTML = [
    t('about.data', link(wikt, t('about.wikt')), link(A.dataLicense.url, A.dataLicense.name)),
    t('about.modified', link('https://github.com/tatuylonen/wiktextract', 'wiktextract'), link('https://kaikki.org/', 'kaikki.org')),
    m.builtAt ? esc(t('about.build', m.dumpSet, new Date(m.builtAt).toLocaleDateString(t('locale')))) : '',
    t('about.app', esc(A.app?.version ?? ''), link(A.codeLicense.url, A.codeLicense.name), link(A.source)),
    t('about.packs', link(A.source + '/releases')),
    A.app ? t('about.privacy', link(A.source + '/blob/main/PRIVACY.md', 'PRIVACY.md')) : '',
    A.app ? esc(t('about.thirdParty')) : '',
  ].filter(Boolean).map(p => `<p>${p}</p>`).join('');
}

// ---------- serveur des packs (appli Android : Config → Avancé) ----------
function renderServer() {
  const s = P.state; if (!s) return;
  const box = $('#packs-url');
  if (document.activeElement !== box) box.value = s.custom ? s.server : '';
  box.placeholder = s.defaultServer;
}
async function setServer(url) {
  const r = await (await fetch('/api/packs/server', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }) })).json();
  $('#server-status').textContent = r.error ? t('server.error', r.error) : t('server.saved');
  if (!r.error) { $('#packs-url').blur(); P.choice = null; loadPacks(); }
}
$('#server-save').addEventListener('click', () => setServer($('#packs-url').value));
$('#server-reset').addEventListener('click', () => { $('#packs-url').value = ''; setServer(''); });
$('#packs-url').addEventListener('keydown', e => { if (e.key === 'Enter') setServer(e.target.value); });

// ---------- navigation ----------
function goTo(page) {
  S.page = page;
  closeBubble();
  if (isTouch() && page !== 'main') document.activeElement?.blur();   // le clavier ne suit pas sur l'autre page
  for (const p of ['main', 'history', 'config']) $('#page-' + p).hidden = p !== page;
  // Seulement les boutons de page : les boutons FR/EN/ES de la même barre gardent leur surlignage.
  document.querySelectorAll('.nav button[data-page]').forEach(b => { b.classList.toggle('on', b.dataset.page === page); b.setAttribute('aria-current', b.dataset.page === page ? 'page' : 'false'); });
  // Tactile : pas de focus qui ferait monter le clavier sur l'historique ou sur un résultat ; seulement si le champ est vide.
  if (page === 'history') { loadHistory(true); if (!isTouch()) $('#filter').focus(); }
  if (page === 'config') { renderConfig(); renderMeta(); renderAbout(); $('#server-status').textContent = ''; if (CFG.packs) loadPacks(); }
  if (page === 'main') { if (!R && field.value.trim()) rerun(); if (!isTouch() || !field.value.trim()) field.focus(); }
}

// Bouton retour d'Android (MainActivity) : bulle ouverte, puis Historique ou Config → page principale.
// false : rien à faire dans la page, l'appli passe en arrière-plan. Jamais de retour aux recherches précédentes.
window.langswapBack = () => {
  if (closeBubble()) return true;
  if (S.page !== 'main') { goTo('main'); return true; }
  return false;
};
document.querySelector('.nav').addEventListener('click', e => { const b = e.target.closest('button[data-page]'); if (b) goTo(b.dataset.page); });

// Langue de l'interface : 3 boutons dans la barre du bas.
function renderUiLangs() {
  $('#nav-ui').innerHTML = UI_LANGS.map(l => `<button data-ui="${l}" class="${l === uiLang() ? 'on' : ''}" title="${NAMES[l]}" aria-pressed="${l === uiLang()}">${l.toUpperCase()}</button>`).join('');
}
$('#nav-ui').addEventListener('click', e => {
  const b = e.target.closest('[data-ui]'); if (!b) return;
  S.ui = b.dataset.ui; writeLocal('ui', S.ui); setUiLang(S.ui); applyStaticTexts();
  renderUiLangs(); renderBars(); renderResult();
  if (S.page === 'config') { renderConfig(); renderMeta(); renderAbout(); }
  if (S.page === 'history') renderHistory();
});
renderUiLangs();

// ---------- raccourcis clavier (Linux : Alt, jamais de glyphes Apple) ----------
document.addEventListener('keydown', e => {
  if (!e.altKey || e.ctrlKey || e.metaKey) return;
  const m = /^Digit([0-6])$/.exec(e.code);
  if (m) {
    e.preventDefault();
    if (S.page !== 'main') goTo('main');
    const n = Number(m[1]);
    if (n === 0) { if (!e.shiftKey) chooseSource(null); return; }
    const l = LANGS[n - 1];
    if (!configured().includes(l)) return;
    if (e.shiftKey) { if (S.mode !== 'one') { S.mode = 'one'; } chooseTarget(l); } else chooseSource(l);
    return;
  }
  if (e.code === 'KeyS') { e.preventDefault(); swap(); }
  else if (e.code === 'KeyM') { e.preventDefault(); toggleMode(); }
  else if (e.code === 'KeyH') { e.preventDefault(); goTo('history'); }
});

// Appli sans aucune langue installée (premier lancement) : directement aux réglages, panneau des packs.
if (CFG.packs) $('#panel-packs').hidden = $('#panel-advanced').hidden = false;
renderBars();
renderResult();
goTo(CFG.packs && !configured().length ? 'config' : 'main');
