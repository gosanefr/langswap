// Constantes partagées par le pipeline, le serveur et tout code qui tourne hors de Node (navigateur, WebView Android).
// Aucun import : ce module se charge tel quel partout. Chemins et environnement : config.mjs.

export const PIPELINE_VERSION = '1.0.0';

// Ordre d'affichage : 3 principales puis 3 secondaires (Alt+1…6).
export const LANGS = ['fr', 'en', 'es', 'de', 'it', 'pt'];
export const PRIMARY_LANGS = ['fr', 'en', 'es'];
export const SECONDARY_LANGS = ['de', 'it', 'pt'];
export const LANG_NAMES = { fr: 'Français', en: 'English', es: 'Español', de: 'Deutsch', it: 'Italiano', pt: 'Português' };
export const LANG_BIT = Object.fromEntries(LANGS.map((l, i) => [l, 1 << i]));

// Éditions wiktextract (kaikki.org, JSONL déjà extraits).
export const EDITIONS = {
  en: 'https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz',
  fr: 'https://kaikki.org/dictionary/downloads/fr/fr-extract.jsonl.gz',
  de: 'https://kaikki.org/dictionary/downloads/de/de-extract.jsonl.gz',
  es: 'https://kaikki.org/dictionary/downloads/es/es-extract.jsonl.gz',
  it: 'https://kaikki.org/dictionary/downloads/it/it-extract.jsonl.gz',
  pt: 'https://kaikki.org/dictionary/downloads/pt/pt-extract.jsonl.gz',
};
export const WIKDICT_URL = 'https://download.wikdict.com/dictionaries/sqlite/2/';

// Dépôt public (GitHub, compte gosanefr) : sources, releases des packs (`packs-<build>`), manifeste packs/packs.json.
// Décisions : wayfinder/tickets/017-hebergement-licence.md.
export const SOURCE_REPO = 'gosanefr/langswap';
export const SOURCE_URL = `https://github.com/${SOURCE_REPO}`;
export const CODE_LICENSE = { name: 'GPL-3.0-or-later', url: 'https://www.gnu.org/licenses/gpl-3.0.html' };
// Données (packs) : dérivées du Wiktionnaire, donc CC BY-SA 4.0 (partage à l'identique).
export const DATA_LICENSE = { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' };

// Serveur
export const HOST = '127.0.0.1';
// Réglages SQLite du dictionnaire, pour le serveur et le banc de `check` (mêmes conditions) :
// mmap 256 Mo + cache 16 Mo, ≈ 40 % plus rapide que les réglages par défaut ; nécessaire à neighborsBatch
// (prototypes/packs/README.md).
export const SQLITE_PRAGMAS = 'PRAGMA mmap_size = 268435456; PRAGMA cache_size = -16000;';
export const PIVOT_CAP = 30;          // mots intermédiaires (ticket 009)
export const NEAR_CAP = 5;         // mots flous par colonne avant « +N » (ticket 003)
export const INVERSE_SENSE_CAP = 6;   // sens inverses avant « N autres sens » (ticket 003)

// Banc de mesure : mots riches, en AUTO et en source fixée (ticket 009).
export const BENCH_WORDS = [
  ['en', 'set'], ['fr', 'faire'], ['es', 'dar'], ['en', 'work'], ['en', 'run'], ['fr', 'travail'],
  ['de', 'Arbeit'], ['it', 'casa'], ['pt', 'trabalho'], ['fr', 'prendre'], ['de', 'machen'],
  ['en', 'take'], ['es', 'casa'], ['it', 'lavoro'], ['fr', 'travaillé'], ['en', 'saw'],
  [null, 'casa'], [null, 'set'], [null, 'porte'], [null, 'est'],
];
