-- Index créés en fin de chargement (ticket 010 §4.6).
CREATE INDEX translation_word ON translation(word_id);
CREATE INDEX translation_sense ON translation(sense_id);
CREATE INDEX sense_entry ON sense(entry_id);
CREATE INDEX entry_word ON entry(word_id);
CREATE UNIQUE INDEX word_lang_text ON word(lang, text);
