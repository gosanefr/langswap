// Les requêtes de queries.mjs, réécrites pour des packs de langue attachés (appli Android, prototypes/packs).
// À garder alignées sur queries.mjs : mêmes colonnes en sortie, mêmes ordres de lignes.
// Une entrée, ses sens et leurs traductions sont toujours dans le même pack : chaque requête s'exécute
// pack par pack (jointures locales, index du pack) puis UNION ALL. Seul `word` est commun (pack de base, WORD).
// Mêmes colonnes en sortie que queries.mjs : search.mjs n'y voit aucune différence.

/**
 * @param {string[]} fullPacks alias des packs de langue attachés (entry, sense, translation, form)
 * @param {string}   WORD      table des mots (ex. 'base.word')
 * Pas de packs « bridges » (sens des langues non installées) : écartés le 2026-10-14, leurs lignes affichaient
 * des gloses et mots d'origine hors des langues choisies (mesures : prototypes/packs/README.md).
 */
export function packQueries(fullPacks, WORD) {
  const union = (packs, f) => packs.map(f).join('\n    UNION ALL\n');
  return {
    forms: union(fullPacks, p => `
    SELECT f.word_id, f.orig_form, f.layer, w.lang, w.text, w.volume
    FROM ${p}.form f JOIN ${WORD} w ON w.id = f.word_id
    WHERE f.search_key = ?1`),

    wordSenses: union(fullPacks, p => `
    SELECT e.id AS entry_id, e.pos, e.edition, e.rank AS entry_rank,
           s.id AS sense_id, s.rank AS sense_rank, s.gloss, s.anchor,
           t.word_id, t.rank AS trans_rank, t.gender, w.lang, w.text
    FROM ${p}.entry e
    JOIN ${p}.sense s ON s.entry_id = e.id
    JOIN ${p}.translation t ON t.sense_id = s.id
    JOIN ${WORD} w ON w.id = t.word_id
    WHERE e.word_id = ?1`) + '\n    ORDER BY entry_rank, sense_rank, trans_rank',

    inverseSenses: union(fullPacks, p => `
    SELECT s.id AS sense_id, s.rank AS sense_rank, s.gloss, s.anchor,
           e.id AS entry_id, e.pos, e.edition,
           o.id AS origin_id, o.lang AS origin_lang, o.text AS origin_text, o.volume AS origin_volume
    FROM ${p}.translation t0
    JOIN ${p}.sense s ON s.id = t0.sense_id
    JOIN ${p}.entry e ON e.id = s.entry_id
    JOIN ${WORD} o ON o.id = e.word_id
    WHERE t0.word_id = ?1 AND e.word_id <> t0.word_id`),

    siblings: union(fullPacks, p => `
    SELECT t.sense_id, t.word_id, t.rank AS trans_rank, t.gender, w.lang, w.text
    FROM ${p}.translation t0
    JOIN ${p}.sense s ON s.id = t0.sense_id AND s.anchor = 1
    JOIN ${p}.translation t ON t.sense_id = s.id
    JOIN ${WORD} w ON w.id = t.word_id
    WHERE t0.word_id = ?1 AND t.word_id <> t0.word_id`),

    neighborsBatch: '\n    WITH ids(id) AS (SELECT value FROM json_each(?1))' + [
      ...fullPacks.map(p => `
    SELECT ids.id AS source, t.word_id AS id FROM ids CROSS JOIN ${p}.entry e ON e.word_id = ids.id
      JOIN ${p}.sense s ON s.entry_id = e.id JOIN ${p}.translation t ON t.sense_id = s.id
    UNION ALL
    SELECT ids.id, e.word_id FROM ids CROSS JOIN ${p}.translation t ON t.word_id = ids.id
      JOIN ${p}.sense s ON s.id = t.sense_id JOIN ${p}.entry e ON e.id = s.entry_id`),
      ...fullPacks.map(p => `
    SELECT ids.id, t.word_id FROM ids CROSS JOIN ${p}.translation t0 ON t0.word_id = ids.id
      JOIN ${p}.sense s ON s.id = t0.sense_id AND s.anchor = 1 JOIN ${p}.translation t ON t.sense_id = s.id
      WHERE t.word_id <> ids.id`)].join('\n    UNION ALL\n'),

    wordsByIds: `SELECT id, lang, text, volume FROM ${WORD} WHERE id IN (SELECT value FROM json_each(?))`,

    meta: `SELECT name, value FROM base.meta`,
  };
}
