// Normalisation partagée entre le build et le serveur (ticket 004 §4–5, ticket 010 §2).
// Toute divergence entre `forme.cle` en base et la clé calculée à la requête casserait la recherche :
// ce module est la seule définition.

const APOSTROPHES = /[’ʼ‘´`′]/g;   // ’ ʼ ‘ ´ ` ′ → '
const DASHES = /[-‐‑‒–—−]/g;          // trait d'union ≡ espace
const MARKS = /\p{M}+/gu;
const SPACES = /\s+/g;

/** Normalisation légère : bords, espaces multiples, apostrophes typographiques. Sert à repérer
 *  les correspondances « identiques au caractère près ». */
export function lightNormalize(s) {
  return String(s ?? '').normalize('NFC').replace(APOSTROPHES, "'").replace(SPACES, ' ').trim();
}

/** Clé de recherche : insensible aux accents (NFD sans diacritiques) et à la casse (casefold, ß → ss),
 *  trait d'union ≡ espace. Pas de translittération (ä ↛ ae, œ ↛ oe). */
export function searchKey(s) {
  return lightNormalize(s)
    .normalize('NFD').replace(MARKS, '')
    .replace(DASHES, ' ')
    .toLowerCase()
    .replace(/ß/g, 'ss').replace(/ς/g, 'σ')
    .replace(SPACES, ' ').trim();
}
