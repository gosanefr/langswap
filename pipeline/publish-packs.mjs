// publish-packs : publie les packs de data/packs (sortie de `langswap packs`) sur GitHub, à lancer à la main après
// vérification du build (ticket 017).
//  1. vérifie data/packs (tailles, sha256 de packs.json, LICENSE-DATA.md) et l'accès à GitHub (gh) ;
//  2. crée la release `packs-<build>` (jamais « latest » : réservé aux versions de l'appli) et y envoie les
//     .sqlite.xz + LICENSE-DATA.md ; une release déjà là reçoit seulement les fichiers manquants (reprise) ;
//  3. écrit packs/packs.json (URL absolues vers cette release), puis commit + push sur la branche courante.
//     C'est ce push qui fait passer les téléphones au nouveau build (l'appli lit ce fichier sur raw.githubusercontent.com).
// node pipeline/publish-packs.mjs [--dry-run] [--repo=owner/name]
// Accès : GH_TOKEN s'il est défini, sinon le jeton du compte propriétaire du dépôt dans gh (`gh auth token -u <owner>`),
// sans changer le compte actif de gh. Le push passe par la configuration git locale du dépôt.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { PACKS_DIR, ROOT } from '../shared/config.mjs';
import { SOURCE_REPO } from '../shared/constants.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const repo = args.find(a => a.startsWith('--repo='))?.slice(7) || SOURCE_REPO;
const owner = repo.split('/')[0];
const manifestOut = path.join(ROOT, 'packs/packs.json');
const fail = message => { console.error(`publish-packs: ${message}`); process.exit(1); };
const run = (cmd, a, opts = {}) => execFileSync(cmd, a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();

// ---------- 1. vérifications ----------
const local = JSON.parse(fs.readFileSync(path.join(PACKS_DIR, 'packs.json'), 'utf8'));
const assets = [];
for (const [name, f] of Object.entries(local.files)) {
  const file = path.join(PACKS_DIR, f.file);
  if (!fs.existsSync(file)) fail(`${f.file} missing in ${PACKS_DIR}: run \`langswap packs\``);
  if (fs.statSync(file).size !== f.bytes) fail(`${f.file}: size differs from packs.json`);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (sha256 !== f.sha256) fail(`${f.file}: sha256 differs from packs.json`);
  assets.push(file);
  console.log(`ok  ${name.padEnd(8)} ${f.file.padEnd(20)} ${(f.bytes / 1e6).toFixed(1).padStart(6)} MB`);
}
const licenseFile = path.join(PACKS_DIR, 'LICENSE-DATA.md');
if (!fs.existsSync(licenseFile)) fail('LICENSE-DATA.md missing: run `langswap packs`');
assets.push(licenseFile);

// Tag lisible tiré de l'horodatage du build : 2026-10-14T05:17:34.122Z → packs-20261014-0517.
const tag = 'packs-' + local.build.replace(/[-:]/g, '').replace(/^(\d{8})T(\d{4}).*$/, '$1-$2');
if (!/^packs-\d{8}-\d{4}$/.test(tag)) fail(`unexpected build timestamp: ${local.build}`);
const base = `https://github.com/${repo}/releases/download/${tag}/`;
const published = {
  ...local, release: tag, licenseFile: base + 'LICENSE-DATA.md',
  files: Object.fromEntries(Object.entries(local.files).map(([n, f]) => [n, { ...f, file: base + f.file }])),
};

let token = process.env.GH_TOKEN;
if (!token) {
  try { token = run('gh', ['auth', 'token', '-u', owner]); }
  catch { fail(`no GitHub token for ${owner}: run \`gh auth login\` with that account, or set GH_TOKEN`); }
}
const gh = a => run('gh', a, { env: { ...process.env, GH_TOKEN: token } });
try { gh(['api', `repos/${repo}`, '--jq', '.full_name']); } catch (e) { fail(`repository ${repo} unreachable: ${e.stderr || e.message}`); }
let existing = null;
try { existing = JSON.parse(gh(['release', 'view', tag, '--repo', repo, '--json', 'assets'])).assets.map(a => a.name); } catch { /* release absente */ }
const missing = assets.filter(a => !existing?.includes(path.basename(a)));
const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
const previous = fs.existsSync(manifestOut) ? fs.readFileSync(manifestOut, 'utf8') : null;
const next = JSON.stringify(published, null, 2) + '\n';

console.log(`\nrepository  ${repo}
release     ${tag} ${existing ? `(exists, ${missing.length} file(s) to upload)` : '(to create, not marked latest)'}
upload      ${missing.map(a => path.basename(a)).join(', ') || 'nothing'} — ${(missing.reduce((s, a) => s + fs.statSync(a).size, 0) / 1e6).toFixed(1)} MB
manifest    packs/packs.json ${previous === next ? '(unchanged)' : `(${previous ? 'updated' : 'new'}), commit + push to ${branch}`}
build       ${local.build} · dumps ${local.dumpSet} · ${local.license.name}`);
if (dryRun) { console.log('\n--dry-run: nothing published.'); process.exit(0); }

// ---------- 2. release ----------
if (!existing) {
  const title = `Dictionary ${local.dumpSet} (build ${local.build.slice(0, 16).replace('T', ' ')})`;
  const notes = `Language packs for LangSwap, built from the Wiktionary dumps of ${local.dumpSet} (pipeline ${local.pipelineVersion}).\n\n`
    + `Data: © Wiktionary contributors, ${local.license.name} (${local.license.url}); modified by LangSwap — see LICENSE-DATA.md.\n`
    + `The app reads packs/packs.json on the main branch, which points to this release.`;
  console.log(`\ncreating ${tag}…`);
  gh(['release', 'create', tag, '--repo', repo, '--title', title, '--notes', notes, '--latest=false', ...missing]);
} else if (missing.length) {
  console.log(`\nuploading to ${tag}…`);
  gh(['release', 'upload', tag, '--repo', repo, ...missing]);
}

// ---------- 3. manifeste ----------
if (previous === next) { console.log('packs/packs.json unchanged: done.'); process.exit(0); }
fs.mkdirSync(path.dirname(manifestOut), { recursive: true });
fs.writeFileSync(manifestOut, next);
run('git', ['add', 'packs/packs.json']);
run('git', ['commit', '-m', `Packs: build ${local.build} (${tag})`, '--', 'packs/packs.json']);
console.log(run('git', ['push', 'origin', branch], { stdio: ['ignore', 'pipe', 'inherit'] }) || `pushed to ${branch}`);
console.log(`done: phones will see build ${local.build} once raw.githubusercontent.com refreshes (a few minutes).`);
