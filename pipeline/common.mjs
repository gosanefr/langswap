// Utilitaires communs aux étapes du pipeline.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { CACHE_DIR, DUMPS_DIR } from '../shared/config.mjs';

/** Jeu de dumps épinglé : --set=AAAA-MM-JJ, sinon le plus récent. Le build ne lit jamais le réseau. */
export function pinnedDumpSet(argv) {
  const arg = argv.find(a => a.startsWith('--set='));
  const sets = fs.existsSync(DUMPS_DIR) ? fs.readdirSync(DUMPS_DIR).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort() : [];
  const name = arg ? arg.split('=')[1] : sets.at(-1);
  if (!name) throw new Error('No dump set: run `node pipeline/download.mjs` first');
  const dir = path.join(DUMPS_DIR, name);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  return { dir, name, manifest };
}

export const cacheFile = (manifest, edition) => path.join(CACHE_DIR, `${manifest.files[edition].sha256}.jsonl.gz`);

/** Itère les entrées compactes d'un fichier de cache. */
export async function* readCache(file) {
  const rl = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip({ chunkSize: 1 << 20 })), crlfDelay: Infinity });
  for await (const line of rl) if (line) yield JSON.parse(line);
}

/** Dernier jeu WikDict épinglé. */
export function wikdictDir() {
  const d = fs.existsSync(DUMPS_DIR) ? fs.readdirSync(DUMPS_DIR).filter(x => x.startsWith('wikdict-')).sort().at(-1) : null;
  return d ? path.join(DUMPS_DIR, d) : null;
}

// Attribution exigée par CC BY-SA 4.0 : auteurs (contributeurs du Wiktionnaire, par lien), licence, modifications.
export function licenseText(m, dumps) {
  const editions = m.langs.filter(ed => dumps[ed])
    .map(ed => `- ${ed}.wiktionary.org — dump kaikki.org du ${new Date(dumps[ed].server_date).toISOString().slice(0, 10)}`).join('\n');
  return `# LangSwap — licence des données

Les packs de langue de LangSwap (\`base.sqlite.xz\`, \`pack-<langue>.sqlite.xz\`) sont une base dérivée du
**Wiktionnaire** (Wiktionary), © ses contributeurs (https://wiktionary.org ; auteurs : historique de chaque page).

- Licence : **${m.license.name}** — ${m.license.url}
  (le Wiktionnaire est aussi disponible sous GFDL ; ces packs sont distribués sous CC BY-SA 4.0 seulement).
- Modifications : entrées extraites par wiktextract (https://github.com/tatuylonen/wiktextract, dumps de
  https://kaikki.org), filtrées sur 6 langues (fr, en, es, de, it, pt), nettoyées, regroupées par sens et
  restructurées en tables SQLite par le pipeline de LangSwap (https://github.com/gosanefr/langswap, GPL-3.0-or-later).
- Build du dictionnaire : ${m.build} (pipeline ${m.pipelineVersion}, jeu de dumps ${m.dumpSet}).

Éditions utilisées :

${editions}

Toute redistribution de ces packs, modifiés ou non, doit garder cette attribution et la même licence.
`;
}
