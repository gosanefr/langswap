-- Schéma de history.sqlite (ticket 006 §3, ticket 008 §8). Lecture-écriture, séparé du dictionnaire.
-- Tout en texte, aucun word_id : les ids du dictionnaire changent à chaque build.
CREATE TABLE IF NOT EXISTS search (
  id          INTEGER PRIMARY KEY,
  input       TEXT    NOT NULL,     -- mot tapé (travaillé)
  lemma       TEXT,                 -- entrée ou lemme trouvé (travailler) ; celui du premier groupe en AUTO
  langs       TEXT    NOT NULL,     -- langue(s) d'origine, séparées par des virgules
  timestamp   TEXT    NOT NULL,     -- ISO 8601
  parent_id   INTEGER               -- recherche d'où vient un rebond
);
CREATE INDEX IF NOT EXISTS search_timestamp ON search(timestamp);
