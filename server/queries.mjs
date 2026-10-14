// Module `queries` : toutes les requêtes SQL du serveur, en SQL pur (ticket 009 §3).
// L'appli Android réutilise ce SQL et le schéma (shared/schema.sql) ; version packs : pack-queries.mjs.
// Liens jamais matérialisés (ticket 008 §5) : tout passe par l'index de `translation`.

export const SQL = {
  /** Correspondances d'une clé normalisée : mots (layer 'word') et lemmes (layer 'inflection'). */
  forms: `
    SELECT f.word_id, f.orig_form, f.layer, w.lang, w.text, w.volume
    FROM form f JOIN word w ON w.id = f.word_id
    WHERE f.search_key = ?`,

  /** Sens des entrées du mot (toutes éditions) avec leurs traductions : liens directs sortants. */
  wordSenses: `
    SELECT e.id AS entry_id, e.pos, e.edition, e.rank AS entry_rank,
           s.id AS sense_id, s.rank AS sense_rank, s.gloss, s.anchor,
           t.word_id, t.rank AS trans_rank, t.gender, w.lang, w.text
    FROM entry e
    JOIN sense s ON s.entry_id = e.id
    JOIN translation t ON t.sense_id = s.id
    JOIN word w ON w.id = t.word_id
    WHERE e.word_id = ?
    ORDER BY e.rank, s.rank, t.rank`,

  /** Sens inverses : sens d'autres entrées qui listent le mot (lien direct entrant), avec le mot d'origine. */
  inverseSenses: `
    SELECT s.id AS sense_id, s.rank AS sense_rank, s.gloss, s.anchor,
           e.id AS entry_id, e.pos, e.edition,
           o.id AS origin_id, o.lang AS origin_lang, o.text AS origin_text, o.volume AS origin_volume
    FROM translation t0
    JOIN sense s ON s.id = t0.sense_id
    JOIN entry e ON e.id = s.entry_id
    JOIN word o ON o.id = e.word_id
    WHERE t0.word_id = ? AND e.word_id <> t0.word_id`,

  /** Frères de sens : autres traductions des sens d'ancre vraie qui contiennent le mot. */
  siblings: `
    SELECT t.sense_id, t.word_id, t.rank AS trans_rank, t.gender, w.lang, w.text
    FROM translation t0
    JOIN sense s ON s.id = t0.sense_id AND s.anchor = 1
    JOIN translation t ON t.sense_id = s.id
    JOIN word w ON w.id = t.word_id
    WHERE t0.word_id = ? AND t.word_id <> t0.word_id`,

  /** Voisins fermes d'une liste de mots (JSON), par lot : une ligne (source, id) par chemin (direct sortant,
   *  direct entrant, frères), avec doublons. Un seul appel pour tous les intermédiaires du pivot.
   *  CROSS JOIN : la liste reste la boucle externe, donc les lignes d'une même source sortent dans le même
   *  ordre qu'une requête mot par mot (les ex aequo du pivot en dépendent).
   *  Ids seuls : la langue se déduit de la plage d'ids (meta.word_ranges). */
  neighborsBatch: `
    WITH ids(id) AS (SELECT value FROM json_each(?1))
    SELECT ids.id AS source, t.word_id AS id FROM ids CROSS JOIN entry e ON e.word_id = ids.id
      JOIN sense s ON s.entry_id = e.id JOIN translation t ON t.sense_id = s.id
    UNION ALL
    SELECT ids.id, e.word_id FROM ids CROSS JOIN translation t ON t.word_id = ids.id
      JOIN sense s ON s.id = t.sense_id JOIN entry e ON e.id = s.entry_id
    UNION ALL
    SELECT ids.id, t.word_id FROM ids CROSS JOIN translation t0 ON t0.word_id = ids.id
      JOIN sense s ON s.id = t0.sense_id AND s.anchor = 1 JOIN translation t ON t.sense_id = s.id
      WHERE t.word_id <> ids.id`,

  /** Mots par id (texte, volume) — seulement pour les candidats affichés et les intermédiaires. */
  wordsByIds: `SELECT id, lang, text, volume FROM word WHERE id IN (SELECT value FROM json_each(?))`,

  meta: `SELECT name, value FROM meta`,
};

/** Prépare toutes les requêtes sur une connexion node:sqlite. */
export function prepareAll(db) {
  return Object.fromEntries(Object.entries(SQL).map(([k, sql]) => [k, db.prepare(sql)]));
}
