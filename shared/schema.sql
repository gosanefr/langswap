-- Schéma de langswap.sqlite (ticket 008 §4). Dictionnaire en lecture seule, 6 langues, un seul fichier.
-- SQL pur, réutilisé tel quel par l'appli Android (packs : server/pack-queries.mjs).

-- Nœud = mot : langue + forme écrite exacte (accents et casse gardés).
-- volume = nombre de liens fermes distincts (liens directs distincts + appartenances à des sens d'ancre vraie).
CREATE TABLE word (
  id      INTEGER PRIMARY KEY,
  lang    TEXT    NOT NULL,
  text    TEXT    NOT NULL,
  volume  INTEGER NOT NULL
);

-- Une entrée = une section POS d'une page, dans une édition (la langue du mot ≠ édition pour en:X et de:X).
CREATE TABLE entry (
  id       INTEGER PRIMARY KEY,
  word_id  INTEGER NOT NULL,
  pos      TEXT    NOT NULL,
  edition  TEXT    NOT NULL,
  rank     INTEGER NOT NULL      -- ordre de l'entrée dans sa page
);

-- Un sens glosé, la ligne « sans sens précis » (gloss NULL, anchor = 0) ou un sens de glose anglaise (anchor = 0).
-- langs = masque des langues cibles couvertes (bit i = LANGS[i] : fr en es de it pt).
CREATE TABLE sense (
  id        INTEGER PRIMARY KEY,
  entry_id  INTEGER NOT NULL,
  rank      INTEGER NOT NULL,
  gloss     TEXT,
  anchor    INTEGER NOT NULL,
  langs     INTEGER NOT NULL
);

-- Lien direct : mot de l'entrée du sens ↔ mot traduit, lu dans les deux sens.
CREATE TABLE translation (
  sense_id INTEGER NOT NULL,
  word_id  INTEGER NOT NULL,
  rank     INTEGER NOT NULL,
  gender   TEXT,                 -- 'm.', 'f.', 'n.', 'c.', 'm./f.'…
  region   TEXT                  -- codes ISO 3166 séparés par des virgules
);

-- Index des formes normalisées → mots. layer = 'word' (le mot lui-même) | 'inflection' (forme fléchie → lemme).
CREATE TABLE form (
  search_key TEXT    NOT NULL,
  word_id    INTEGER NOT NULL,
  orig_form  TEXT    NOT NULL,
  layer      TEXT    NOT NULL,
  PRIMARY KEY (search_key, word_id, layer)
) WITHOUT ROWID;

CREATE TABLE meta (
  name  TEXT PRIMARY KEY,
  value TEXT
);
