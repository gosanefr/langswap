// Chemins et environnement (Node seulement). Constantes sans dépendance : constants.mjs.
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DUMPS_DIR = path.join(ROOT, 'dumps');
export const CACHE_DIR = path.join(ROOT, 'cache');
export const REPORTS_DIR = path.join(ROOT, 'reports');
export const DATA_DIR = path.join(ROOT, 'data');
export const DB_PATH = path.join(DATA_DIR, 'langswap.sqlite');
export const DB_TMP_PATH = DB_PATH + '.tmp';
export const HISTORY_PATH = path.join(DATA_DIR, 'history.sqlite');
export const PACKS_DIR = path.join(DATA_DIR, 'packs');   // packs de langue pour l'appli Android (pipeline/packs.mjs)

export const PORT = Number(process.env.LANGSWAP_PORT || 4765);
