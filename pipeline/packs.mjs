// packs : découpe langswap.sqlite en packs de langue téléchargeables par l'appli Android, compressés (xz)
// et décrits par packs.json (build, tailles, sha256, licence). Mesures et choix : prototypes/packs/README.md,
// wayfinder/tickets/017-hebergement-licence.md.
// node pipeline/packs.mjs [out_dir] [source.sqlite]   (par défaut : data/packs, DB_PATH)
// Sortie : <nom>.sqlite (pour android/langswap/install-packs.sh), <nom>.sqlite.xz + packs.json + LICENSE-DATA.md
// (à servir en HTTP : `langswap serve-packs`, ou à publier : `langswap publish-packs`). Demande la commande `xz`.
// pack-<L>    : form, entry, sense, translation des mots de L (une ligne n'appartient qu'à un pack).
// base        : meta + table `word` des 6 langues, toujours installée.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { DB_PATH, PACKS_DIR, ROOT } from '../shared/config.mjs';
import { DATA_LICENSE, LANGS } from '../shared/constants.mjs';
import { licenseText } from './common.mjs';

const outDir = process.argv[2] || PACKS_DIR;
const source = process.argv[3] || DB_PATH;
// Anciens packs « bridges » (abandonnés) et archives gzip (avant xz) : jamais servis.
for (const f of fs.existsSync(outDir) ? fs.readdirSync(outDir) : []) if (f.startsWith('bridges-') || f.endsWith('.sqlite.gz')) fs.rmSync(path.join(outDir, f));
fs.mkdirSync(outDir, { recursive: true });
const schema = fs.readFileSync(path.join(ROOT, 'shared/schema.sql'), 'utf8').replace(/CREATE TABLE meta[\s\S]*?\);/, '');
// Sans `word_lang_text` : unicité vérifiée au build, aucune requête ne s'en sert (28 Mo).
const index = fs.readFileSync(path.join(ROOT, 'shared/index.sql'), 'utf8').replace(/.* ON word\(.*\n/, '');
const src = new DatabaseSync(source, { readOnly: true });
const ranges = JSON.parse(src.prepare("SELECT value FROM meta WHERE name = 'word_ranges'").get().value);

function open(name) {
  const f = path.join(outDir, name + '.sqlite');
  fs.rmSync(f, { force: true });
  const db = new DatabaseSync(f);
  db.exec('PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF; PRAGMA page_size=4096;');
  db.exec(schema.replace(/CREATE TABLE word[\s\S]*?\);/, ''));
  db.exec(`ATTACH '${source}' AS s`);
  return db;
}
function close(db, name, t0) {
  db.exec('DETACH s');
  db.exec(index);
  db.exec('ANALYZE; VACUUM;');
  db.close();
  console.log(name, ((performance.now() - t0) / 1000).toFixed(1) + ' s');
}

for (const L of LANGS) {
  const [a, b] = ranges[L];
  let t0 = performance.now(), db = open('pack-' + L);
  db.exec(`
    INSERT INTO form SELECT * FROM s.form WHERE word_id BETWEEN ${a} AND ${b};
    INSERT INTO entry SELECT * FROM s.entry WHERE word_id BETWEEN ${a} AND ${b} ORDER BY id;
    INSERT INTO sense SELECT s2.* FROM s.sense s2 JOIN main.entry e ON e.id = s2.entry_id ORDER BY s2.id;
    INSERT INTO translation SELECT t.* FROM s.translation t JOIN main.sense s2 ON s2.id = t.sense_id;`);
  close(db, 'pack-' + L, t0);

}
// Pack de base, toujours installé : meta + tous les mots des 6 langues (id, lang, text, volume).
// Une traduction vers une langue non installée garde ainsi son texte (pivot « via de:Arbeit » possible).
const t0 = performance.now();
const baseFile = path.join(outDir, 'base.sqlite');
fs.rmSync(baseFile, { force: true });
const m = new DatabaseSync(baseFile);
m.exec(`PRAGMA journal_mode=OFF; ${schema.match(/CREATE TABLE word[\s\S]*?\);/)[0]}
  CREATE TABLE meta (name TEXT PRIMARY KEY, value TEXT); ATTACH '${source}' AS s;
  INSERT INTO meta SELECT * FROM s.meta; INSERT INTO word SELECT * FROM s.word ORDER BY id; DETACH s; VACUUM;`);
m.close();
console.log('base', ((performance.now() - t0) / 1000).toFixed(1) + ' s');

// ---------- compression + manifeste ----------
// xz -9e (et non gzip ou zstd) : ≈ 44 % de moins que gzip -9 à télécharger, décompressé sur Android par
// org.tukaani:xz (Java pur, sans bibliothèque native). Un processus xz par fichier, tous en parallèle ; -T1 garde
// un seul bloc (meilleure compression que les blocs du mode multifil).
const meta = Object.fromEntries(src.prepare('SELECT name, value FROM meta').all().map(r => [r.name, r.value]));
const names = ['base', ...LANGS.map(l => `pack-${l}`)];
function xz(input, output) {
  return new Promise((resolve, reject) => {
    const p = spawn('xz', ['-9e', '-T1', '-c', input], { stdio: ['ignore', fs.openSync(output, 'w'), 'inherit'] });
    p.on('error', reject);
    p.on('exit', code => code === 0 ? resolve() : reject(new Error(`xz ${input}: exit code ${code}`)));
  });
}
const t1 = performance.now();
const files = {};
await Promise.all(names.map(async name => {
  const sqlite = path.join(outDir, name + '.sqlite'), xzFile = sqlite + '.xz';
  await xz(sqlite, xzFile);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(xzFile)).digest('hex');
  files[name] = { file: path.basename(xzFile), bytes: fs.statSync(xzFile).size, sqliteBytes: fs.statSync(sqlite).size, sha256 };
  console.log(`${name}.sqlite.xz`, (files[name].bytes / 1e6).toFixed(1), 'MB');
}));
console.log('xz', ((performance.now() - t1) / 1000).toFixed(1) + ' s');

// build = date du build du dictionnaire : les ids changent à chaque build, l'appli ne mélange jamais deux builds.
// Noms de fichiers relatifs au manifeste (serve-packs) ; publish-packs les remplace par des URL absolues.
const manifest = {
  build: meta.built_at, pipelineVersion: meta.pipeline_version, dumpSet: meta.dump_set, langs: LANGS,
  license: DATA_LICENSE, files: Object.fromEntries(names.map(n => [n, files[n]])),
};
fs.writeFileSync(path.join(outDir, 'packs.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(outDir, 'LICENSE-DATA.md'), licenseText(manifest, JSON.parse(meta.dumps || '{}')));
console.log(`packs.json: build ${manifest.build}, ${names.length} files`);
