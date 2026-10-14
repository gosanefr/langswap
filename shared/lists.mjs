// Listes fermées du nettoyage (ticket 013). Toute nouvelle valeur repérée par le rapport
// « gloses les plus fréquentes » de `check` s'ajoute ici.
import { searchKey } from './normalize.mjs';

/** Libellés de sens qui ne sont pas des sens → « sans sens précis » (013 §2). Comparés via searchKey(). */
const PLACEHOLDERS = ['Translations', 'sdü', 'sdÜ', 'Übersetzungen umgeleitet', 'À trier', '?', 'Traductions', 'Traductions à trier'];
const PLACEHOLDER_KEYS = new Set(PLACEHOLDERS.map(searchKey));
export function isPlaceholder(sense) {
  const k = searchKey(sense).replace(/[.…:]+$/, '').trim();
  return PLACEHOLDER_KEYS.has(k) || k.startsWith('traductions a trier') || k === 'translations to be checked';
}

/** Libellés it qui nomment une POS (013 §1 et §2) → POS wiktextract. */
const POS_IT = {
  aggettivo: 'adj', sostantivo: 'noun', nome: 'noun', verbo: 'verb', avverbio: 'adv', pronome: 'pron',
  preposizione: 'prep', congiunzione: 'conj', interiezione: 'intj', articolo: 'article', locuzione: 'phrase',
  'locuzione avverbiale': 'adv', 'locuzione aggettivale': 'adj', 'locuzione sostantivale': 'noun', 'locuzione verbale': 'verb',
  'nome proprio': 'name', 'sostantivo femminile': 'noun', 'sostantivo maschile': 'noun', 'participio passato': 'verb',
  'participio presente': 'verb', 'aggettivo sostantivato': 'adj', 'verbo transitivo': 'verb', 'verbo intransitivo': 'verb',
  'verbo pronominale': 'verb', 'verbo riflessivo': 'verb',
};
export function itPosLabel(sense) {
  const k = searchKey(sense).replace(/^\(|\)$/g, '').replace(/[.:]+$/, '').trim();
  return POS_IT[k] ?? null;
}

/** Abréviations de genre prises pour un mot (013 §4, minuscules seulement). */
export const GENDER_ONLY = new Set(['m', 'f', 'n', 'c', 'mf', 'm/f', 'f/m', 'm f', 'm, f', 'm e f', 'm pl', 'f pl', 'n pl', 'mp', 'fp', 'np',
  'm.', 'f.', 'n.', 'c.', 'pl', 'pl.', 'm. pl.', 'f. pl.', 'm/f pl', 'm or f', 'f or m', 'm sg', 'f sg', 'n sg', "m'", "f'"]);

/** Genre affiché : `m.`, `f.`, `n.`, `c.` ou combinaison (`m./f.`). */
const GENDER_TAGS = { masculine: 'm', feminine: 'f', neuter: 'n', common: 'c' };
const GENDER_RAW = { m: 'm', 'm.': 'm', f: 'f', 'f.': 'f', n: 'n', 'n.': 'n', c: 'c', 'c.': 'c', mf: 'mf', 'm/f': 'mf', 'f, m': 'mf', 'm, f': 'mf', 'm e f': 'mf', masculino: 'm', feminino: 'f' };
export function gender(tags = [], rawTags = []) {
  const g = new Set();
  for (const t of tags) if (GENDER_TAGS[t]) g.add(GENDER_TAGS[t]);
  for (const t of rawTags) { const v = GENDER_RAW[String(t).trim()]; if (v === 'mf') { g.add('m'); g.add('f'); } else if (v) g.add(v); }
  return ['m', 'f', 'n', 'c'].filter(x => g.has(x)).map(x => x + '.').join('/') || null;
}

/** Dialectes étiquetés dans l'édition en → rejet (013 §4). */
export const DIALECTS = new Set(['Alemannic-German', 'Alemannic', 'Bavarian', 'Swabian', 'Swiss-German', 'Low-German', 'German-Low-German',
  'Kölsch', 'Ripuarian', 'Palatine-German', 'Palatinate', 'Hessian', 'East-Central-German', 'Pennsylvania-German', 'Silesian', 'Upper-Saxon',
  'Austro-Bavarian', 'Cimbrian', 'Mòcheno', 'Walser', 'Rhine-Franconian', 'Luxembourgish',
  'Tuscany', 'Tuscan', 'Sicilian', 'Neapolitan', 'Venetian', 'Lombard', 'Piedmontese', 'Romanesco', 'Ligurian', 'Emilian', 'Friulian', 'Sardinian',
  'Asturian', 'Aragonese', 'Leonese', 'Extremaduran', 'Ladino', 'Judaeo-Spanish', 'Mirandese', 'Galician-Portuguese',
  'Picard', 'Walloon', 'Norman', 'Gallo', 'Lorrain', 'Franc-Comtois', 'Poitevin-Saintongeais', 'Jersey', 'Guernsey', 'Sark']);

/** Table fermée forme → code ISO 3166 (013 §5), multilingue (tags en, raw_tags fr/de/es/it/pt). */
const REGIONS = {
  GB: ['UK', 'United Kingdom', 'Britain', 'British', 'Great Britain', 'England', 'English', 'Royaume-Uni', 'Grande-Bretagne', 'Angleterre', 'Großbritannien', 'England', 'Vereinigtes Königreich', 'britisch', 'Reino Unido', 'Gran Bretaña', 'Inglaterra', 'RU', 'Regno Unito', 'Gran Bretagna', 'Inghilterra', 'Grã-Bretanha'],
  US: ['US', 'USA', 'United States', 'American', 'États-Unis', 'Etats-Unis', 'USA', 'Vereinigte Staaten', 'amerikanisch', 'Estados Unidos', 'EE. UU.', 'EEUU', 'Stati Uniti', 'EUA'],
  CA: ['Canada', 'Canadian', 'Kanada', 'Canadá'],
  'CA-QC': ['Quebec', 'Québec'],
  AU: ['Australia', 'Australian', 'Australie', 'Australien', 'Austrália'],
  NZ: ['New Zealand', 'Nouvelle-Zélande', 'Neuseeland', 'Nueva Zelanda', 'Nuova Zelanda', 'Nova Zelândia'],
  IE: ['Ireland', 'Irish', 'Irlande', 'Irland', 'Irlanda'],
  'GB-SCT': ['Scotland', 'Scottish', 'Écosse', 'Schottland', 'Escocia', 'Scozia', 'Escócia'],
  ZA: ['South Africa', 'Afrique du Sud', 'Südafrika', 'Sudáfrica', 'Sudafrica', 'África do Sul'],
  IN: ['India', 'Indian', 'Inde', 'Indien', 'Índia'],
  FR: ['France', 'Frankreich', 'Francia', 'França', 'Metropolitan France', 'France métropolitaine'],
  BE: ['Belgium', 'Belgian', 'Belgique', 'Belgien', 'Bélgica', 'Belgio'],
  CH: ['Switzerland', 'Swiss', 'Suisse', 'Schweiz', 'Suiza', 'Svizzera', 'Suíça', 'Swiss Standard German', 'schweizerisch'],
  LU: ['Luxembourg', 'Luxemburg', 'Luxemburgo', 'Lussemburgo'],
  DE: ['Germany', 'Allemagne', 'Deutschland', 'Alemania', 'Germania', 'Alemanha', 'deutschländisch', 'Bundesdeutsch'],
  AT: ['Austria', 'Austrian', 'Autriche', 'Österreich', 'österreichisch', 'Áustria'],
  LI: ['Liechtenstein'],
  IT: ['Italy', 'Italie', 'Italien', 'Italia', 'Itália'],
  ES: ['Spain', 'Espagne', 'Spanien', 'España', 'Spagna', 'Espanha', 'Castilian', 'Peninsular'],
  MX: ['Mexico', 'Mexican', 'Mexique', 'Mexiko', 'México', 'Messico'],
  AR: ['Argentina', 'Argentine', 'Argentinien', 'Rioplatense'],
  UY: ['Uruguay', 'Uruguai'],
  PY: ['Paraguay', 'Paraguai'],
  CL: ['Chile', 'Chili', 'Cile'],
  PE: ['Peru', 'Pérou', 'Perú', 'Perù'],
  BO: ['Bolivia', 'Bolivie', 'Bolivien', 'Bolívia'],
  EC: ['Ecuador', 'Équateur', 'Equador'],
  CO: ['Colombia', 'Colombie', 'Kolumbien', 'Colômbia'],
  VE: ['Venezuela', 'Venezuelan'],
  CU: ['Cuba', 'Kuba'],
  DO: ['Dominican Republic', 'République dominicaine', 'Dominikanische Republik', 'República Dominicana', 'Repubblica Dominicana'],
  PR: ['Puerto Rico', 'Porto Rico', 'Porto Rico'],
  CR: ['Costa Rica'],
  PA: ['Panama', 'Panamá'],
  GT: ['Guatemala'],
  HN: ['Honduras'],
  SV: ['El Salvador', 'Salvador'],
  NI: ['Nicaragua'],
  PH: ['Philippines', 'Philippinen', 'Filipinas', 'Filippine'],
  GQ: ['Equatorial Guinea', 'Guinée équatoriale', 'Guinea Ecuatorial'],
  PT: ['Portugal', 'European Portuguese', 'Portogallo', 'Portugal (PT)', 'Europe (Portugal)'],
  BR: ['Brazil', 'Brazilian', 'Brésil', 'Brasilien', 'Brasil', 'Brasile'],
  AO: ['Angola'],
  MZ: ['Mozambique', 'Moçambique', 'Mosambik', 'Mozambico'],
  CV: ['Cape Verde', 'Cap-Vert', 'Kap Verde', 'Cabo Verde', 'Capo Verde'],
  GW: ['Guinea-Bissau', 'Guinée-Bissau', 'Guiné-Bissau'],
  ST: ['São Tomé and Príncipe', 'Sao Tomé-et-Principe', 'São Tomé e Príncipe'],
  TL: ['East Timor', 'Timor-Leste', 'Timor oriental', 'Timor-Leste'],
  MO: ['Macau', 'Macao'],
  SN: ['Senegal', 'Sénégal'],
  CI: ["Côte d'Ivoire", 'Ivory Coast'],
  CM: ['Cameroon', 'Cameroun', 'Kamerun', 'Camerún'],
  CD: ['Congo', 'RDC', 'DR Congo'],
  MA: ['Morocco', 'Maroc', 'Marokko', 'Marruecos', 'Marocco', 'Marrocos'],
  DZ: ['Algeria', 'Algérie', 'Algerien', 'Argelia', 'Argélia'],
  TN: ['Tunisia', 'Tunisie', 'Tunesien', 'Túnez'],
  HT: ['Haiti', 'Haïti', 'Haití'],
  MC: ['Monaco', 'Mónaco'],
  SM: ['San Marino', 'Saint-Marin'],
  VA: ['Vatican', 'Vatikan', 'Vaticano'],
  'IT-82': ['Sicily', 'Sicile', 'Sizilien', 'Sicilia'],
  'ES-CN': ['Canary Islands', 'Canaries', 'Kanarische Inseln', 'Canarias', 'Canarie'],
  'ES-AN': ['Andalusia', 'Andalousie', 'Andalusien', 'Andalucía'],
  'US-LA': ['Louisiana', 'Louisiane'],
  NA: ['Namibia', 'Namibie'],
  JM: ['Jamaica', 'Jamaïque'],
  SG: ['Singapore', 'Singapour'],
  MT: ['Malta', 'Malte'],
  HK: ['Hong Kong'],
  TW: ['Taiwan', 'Taïwan'],
};
const REGION_BY_FORM = new Map();
for (const [code, forms] of Object.entries(REGIONS)) for (const f of forms) REGION_BY_FORM.set(searchKey(f), code);

/** Codes ISO 3166 tirés des tags (013 §5) ; tags inconnus ignorés ; '' si aucun. */
export function regions(tags = [], rawTags = []) {
  const codes = new Set();
  for (const t of [...tags, ...rawTags]) {
    const c = REGION_BY_FORM.get(searchKey(String(t).replace(/-/g, ' ')));
    if (c) codes.add(c);
  }
  return [...codes].join(',');
}

/** Noms de pays (es/it) rejetés comme traductions it→es (013 §4). */
const COUNTRIES = ['Argentina', 'Uruguay', 'Spagna', 'España', 'Spain', 'Ecuador', 'Colombia', 'Cuba', 'Perù', 'Perú', 'Messico', 'México', 'Mexico',
  'Cile', 'Chile', 'Venezuela', 'Bolivia', 'Paraguay', 'Costa Rica', 'Panamá', 'Panama', 'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua',
  'Puerto Rico', 'Portorico', 'Repubblica Dominicana', 'República Dominicana', 'Filippine', 'Filipinas', 'America Latina', 'América Latina',
  'Andalusia', 'Andalucía', 'Canarie', 'Canarias', 'Stati Uniti', 'Estados Unidos', 'America Centrale', 'Centroamerica', 'América Central',
  'Centroamérica', 'Sudamerica', 'Sudamérica', 'America del Sud', 'Caraibi', 'Caribe', 'Antille', 'Antillas'];
export const COUNTRY_KEYS = new Set(COUNTRIES.map(searchKey));

/** Libellés français des POS wiktextract (intertitres du tableau). */
export const POS_LABELS_FR = {
  noun: 'nom', verb: 'verbe', adj: 'adjectif', adv: 'adverbe', name: 'nom propre', pron: 'pronom', prep: 'préposition',
  conj: 'conjonction', intj: 'interjection', article: 'article', det: 'déterminant', num: 'numéral', particle: 'particule',
  phrase: 'locution', proverb: 'proverbe', prefix: 'préfixe', suffix: 'suffixe', abbrev: 'abréviation', symbol: 'symbole',
  character: 'caractère', contraction: 'contraction', postp: 'postposition', adv_phrase: 'locution adverbiale',
  prep_phrase: 'locution prépositive', participle: 'participe', onomatopoeia: 'onomatopée', unknown: 'autre',
};
