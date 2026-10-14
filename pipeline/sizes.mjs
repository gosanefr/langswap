// Taille approximative de la base par langue (pour viser une app Android légère, téléchargement par langue).
// Chaque table et index mesuré par dbstat est réparti entre langues au prorata d'un poids par ligne.
// Rattachement : word et form → langue du mot ; entry, sense, translation → langue du mot de l'entrée
// (un lien entre deux langues est compté du côté de l'entrée qui le porte).
// Usage autonome : node pipeline/sizes.mjs [fichier.sqlite]  → écrit meta.size_by_lang
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { DB_PATH } from '../shared/config.mjs';

// Poids par langue de chaque table : octets approximatifs de contenu (texte + entiers).
const WEIGHTS = {
  word: `SELECT lang, sum(length(text) + 12) AS w FROM word GROUP BY lang`,
  form: `SELECT m.lang, sum(length(f.search_key) + length(f.orig_form) + 12) AS w FROM form f JOIN word m ON m.id = f.word_id GROUP BY m.lang`,
  entry: `SELECT m.lang, count(*) * 16 AS w FROM entry e JOIN word m ON m.id = e.word_id GROUP BY m.lang`,
  sense: `SELECT m.lang, sum(coalesce(length(s.gloss), 0) + 16) AS w FROM sense s JOIN entry e ON e.id = s.entry_id JOIN word m ON m.id = e.word_id GROUP BY m.lang`,
  translation: `SELECT m.lang, count(*) * 16 AS w FROM translation t JOIN sense s ON s.id = t.sense_id JOIN entry e ON e.id = s.entry_id JOIN word m ON m.id = e.word_id GROUP BY m.lang`,
};
// Les index suivent la répartition de leur table.
const TABLE_OF = { word_lang_text: 'word', entry_word: 'entry', sense_entry: 'sense', translation_word: 'translation', translation_sense: 'translation' };

/** → { fr: { bytes, forms }, … } (forms = part de l'index des formes fléchies, table form) */
export function sizeByLang(db) {
  const bytes = Object.fromEntries(db.prepare('SELECT name, sum(pgsize) AS b FROM dbstat GROUP BY name').all().map(r => [r.name, r.b]));
  const shares = {};
  for (const [table, sql] of Object.entries(WEIGHTS)) {
    const rows = db.prepare(sql).all();
    const total = rows.reduce((s, r) => s + r.w, 0);
    shares[table] = Object.fromEntries(rows.map(r => [r.lang, r.w / total]));
  }
  const out = {};
  const add = (table, b) => {
    for (const [lang, share] of Object.entries(shares[table])) {
      const x = out[lang] ||= { bytes: 0, forms: 0 };
      x.bytes += b * share;
      if (table === 'form') x.forms += b * share;
    }
  };
  for (const [name, b] of Object.entries(bytes)) {
    const table = WEIGHTS[name] ? name : TABLE_OF[name];
    if (table) add(table, b);
  }
  for (const x of Object.values(out)) { x.bytes = Math.round(x.bytes); x.forms = Math.round(x.forms); }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = new DatabaseSync(process.argv[2] || DB_PATH);
  const t = sizeByLang(db);
  db.prepare('INSERT OR REPLACE INTO meta VALUES (?, ?)').run('size_by_lang', JSON.stringify(t));
  for (const [l, x] of Object.entries(t)) console.log(l, (x.bytes / 1e6).toFixed(0), 'MB, of which forms', (x.forms / 1e6).toFixed(0), 'MB');
}
