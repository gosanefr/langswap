// release : publie une version de l'appli Android (ticket 020), à lancer à la main, `--dry-run` d'abord.
//  1. vérifie : version semver plus récente que l'actuelle, copie de travail propre sur main, tag absent,
//     changelogs/<versionCode>.txt dans les 3 langues des fiches, clé de signature, outils (gh, docker, apksigcopier) ;
//  2. écrit versionName/versionCode dans app/build.gradle.kts, compile l'APK et l'AAB signés (clean) ;
//  3. reproductibilité : reconstruit l'APK non signé dans le conteneur android/repro à partir des fichiers suivis par
//     git, puis `apksigcopier compare` ; un écart = rien n'est publié (F-Droid ne pourrait pas publier l'APK signé) ;
//  4. commit « Version x.y.z », tag v<version>, push, release GitHub v<version> (marquée « latest ») avec l'APK.
//     L'AAB reste dans data/release/<version>/, à envoyer à la main dans la console Play.
// node pipeline/release.mjs <version> [--dry-run] [--repo=owner/name]
// --dry-run : tout sauf le commit, le tag, le push et la release.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DATA_DIR, ROOT } from '../shared/config.mjs';
import { SOURCE_REPO } from '../shared/constants.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const repo = args.find(a => a.startsWith('--repo='))?.slice(7) || SOURCE_REPO;
const version = args.find(a => !a.startsWith('--'));
const owner = repo.split('/')[0];
const APP = path.join(ROOT, 'android/langswap');
const GRADLE_FILE = path.join(APP, 'app/build.gradle.kts');
const LOCALES = ['en-US', 'fr-FR', 'es-ES'];
const METADATA = path.join(ROOT, 'fastlane/metadata/android');
const REPRO_IMAGE = 'langswap-repro';
const fail = message => { console.error(`release: ${message}`); process.exit(1); };
const run = (cmd, a, opts = {}) => execFileSync(cmd, a, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
const live = (cmd, a, opts = {}) => execFileSync(cmd, a, { cwd: ROOT, stdio: 'inherit', ...opts });
const has = cmd => { try { run('sh', ['-c', `command -v ${cmd}`]); return true; } catch { return false; } };
const step = title => console.log(`\n== ${title}`);

// ---------- 1. vérifications ----------
const semver = v => v?.match(/^(\d+)\.(\d+)\.(\d+)$/)?.slice(1).map(Number);
const parts = semver(version);
if (!parts) fail('usage: langswap release <x.y.z> [--dry-run]');
if (parts[1] > 99 || parts[2] > 99) fail('minor and patch must stay below 100 (versionCode = MAJOR×10000 + MINOR×100 + PATCH)');
const code = parts[0] * 10000 + parts[1] * 100 + parts[2];
const tag = `v${version}`;

const gradleSource = fs.readFileSync(GRADLE_FILE, 'utf8');
const current = gradleSource.match(/versionName = "([^"]+)"/)?.[1];
const currentCode = Number(gradleSource.match(/versionCode = (\d+)/)?.[1]);
if (!current || !currentCode) fail(`versionName/versionCode not found in ${GRADLE_FILE}`);
const tags = run('git', ['tag', '--list', 'v*']).split('\n').filter(Boolean);
if (tags.includes(tag)) fail(`tag ${tag} already exists`);
// Première version : versionName est déjà à jour (1.0.0) ; ensuite, chaque version doit dépasser la dernière publiée.
const published = tags.map(t => semver(t.slice(1))).filter(Boolean).map(([a, b, c]) => a * 10000 + b * 100 + c);
if (published.length && code <= Math.max(...published)) fail(`${version} is not newer than the last published version`);
if (code < currentCode) fail(`${version} is older than the current versionName ${current}`);

const errors = [];
if (run('git', ['rev-parse', '--abbrev-ref', 'HEAD']) !== 'main') errors.push('not on main');
const dirty = run('git', ['status', '--porcelain']);
if (dirty) errors.push(`uncommitted changes:\n${dirty}`);
for (const l of LOCALES) {
  const f = path.join(METADATA, l, 'changelogs', `${code}.txt`);
  if (!fs.existsSync(f)) errors.push(`missing ${path.relative(ROOT, f)}`);
  else if (fs.statSync(f).size > 500) errors.push(`${path.relative(ROOT, f)}: over 500 bytes (Play limit)`);
}
const local = Object.fromEntries(fs.readFileSync(path.join(APP, 'local.properties'), 'utf8').split('\n')
  .map(l => l.match(/^\s*([\w.]+)\s*=\s*(.*)$/)).filter(Boolean).map(m => [m[1], m[2].trim()]));
if (!local['release.storeFile']) errors.push('no release.storeFile in android/langswap/local.properties (signing key)');
else if (!fs.existsSync(local['release.storeFile'])) errors.push(`keystore not found: ${local['release.storeFile']}`);
for (const tool of ['docker', 'apksigcopier', 'gh']) if (!has(tool)) errors.push(`${tool} not installed`);
let token = process.env.GH_TOKEN;
if (!token && has('gh')) { try { token = run('gh', ['auth', 'token', '-u', owner]); } catch { errors.push(`no GitHub token for ${owner}`); } }
const gh = a => run('gh', a, { env: { ...process.env, GH_TOKEN: token } });
if (token) { try { gh(['api', `repos/${repo}`, '--jq', '.full_name']); } catch (e) { errors.push(`repository ${repo} unreachable`); } }
if (errors.length && !dryRun) fail(errors.join('\n'));
if (errors.length) console.log(`problems (fatal without --dry-run):\n- ${errors.join('\n- ')}`);

console.log(`\nversion     ${current} (${currentCode}) → ${version} (${code})
tag         ${tag} on ${repo}${dryRun ? '\n--dry-run   builds and checks only; nothing committed, tagged or published' : ''}`);

// ---------- 2. build signé ----------
const out = path.join(DATA_DIR, 'release', version);
const apk = path.join(out, `langswap-${version}.apk`);
const aab = path.join(out, `langswap-${version}.aab`);
const setVersion = src => src.replace(/versionName = "[^"]+"/, `versionName = "${version}"`).replace(/versionCode = \d+/, `versionCode = ${code}`);
fs.writeFileSync(GRADLE_FILE, setVersion(gradleSource));
// Remis en l'état à la sortie (--dry-run, ou échec avant le commit de la version).
let committed = false;
process.on('exit', () => { if (!committed) fs.writeFileSync(GRADLE_FILE, gradleSource); });

step('signed build');
live('./gradlew', ['--no-daemon', 'clean', 'assembleRelease', 'bundleRelease'], { cwd: APP });
const built = path.join(APP, 'app/build/outputs/apk/release/app-release.apk');
if (!fs.existsSync(built)) fail('no signed APK (app-release.apk): check the release.* keys in local.properties');
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(built, apk);
fs.copyFileSync(path.join(APP, 'app/build/outputs/bundle/release/app-release.aab'), aab);
const sdk = local['sdk.dir'] || process.env.ANDROID_HOME;
const certs = run(path.join(sdk, 'build-tools/36.0.0/apksigner'), ['verify', '--print-certs', apk]);
const certSha = certs.match(/certificate SHA-256 digest: ([0-9a-f]{64})/)?.[1];
if (!certSha) fail(`apksigner: no certificate in ${apk}`);
console.log(`signed      ${path.relative(ROOT, apk)}, certificate SHA-256 ${certSha} (AllowedAPKSigningKeys)`);

// ---------- 3. reproductibilité ----------
step('reproducibility (android/repro)');
if (!has('docker') || !has('apksigcopier')) fail('docker and apksigcopier are required for the reproducibility check');
const src = path.join(out, 'repro-src');
fs.rmSync(src, { recursive: true, force: true });
fs.mkdirSync(src, { recursive: true });
// Fichiers suivis par git, dans l'état de la copie de travail (build.gradle.kts avec la nouvelle version).
const files = run('git', ['ls-files', '-z']).split('\0').filter(f => f && fs.existsSync(path.join(ROOT, f)));
for (const f of files) { fs.mkdirSync(path.dirname(path.join(src, f)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), path.join(src, f)); }
fs.chmodSync(path.join(src, 'android/langswap/gradlew'), 0o755);
live('chmod', ['-R', 'a+rwX', src]);   // l'utilisateur du conteneur (vagrant) écrit build/ et .gradle/
live('docker', ['build', '-t', REPRO_IMAGE, path.join(ROOT, 'android/repro')]);
live('docker', ['run', '--rm', '-v', `${src}:/home/vagrant/build/fr.langswap`, REPRO_IMAGE]);
const unsigned = path.join(src, 'android/langswap/app/build/outputs/apk/release/app-release-unsigned.apk');
try { run('apksigcopier', ['compare', apk, '--unsigned', unsigned]); }
catch (e) { fail(`not reproducible: ${apk} differs from ${unsigned}\n${e.stderr || e.message}\n(compare with diffoscope)`); }
console.log('reproducible: the container build matches the signed APK');
fs.rmSync(src, { recursive: true, force: true });

if (dryRun) { console.log(`\n--dry-run: ${path.relative(ROOT, out)}/ holds the APK and AAB; nothing published.`); process.exit(0); }

// ---------- 4. publication ----------
step('publish');
if (gradleSource !== setVersion(gradleSource)) {
  run('git', ['commit', '-m', `Version ${version}`, '--', path.relative(ROOT, GRADLE_FILE)]);
}
committed = true;
run('git', ['tag', '-a', tag, '-m', `LangSwap ${version}`]);
live('git', ['push', 'origin', 'main', tag]);
const changelog = l => fs.readFileSync(path.join(METADATA, l, 'changelogs', `${code}.txt`), 'utf8').trim();
const notes = `${changelog('en-US')}\n\n${changelog('fr-FR')}\n\n${changelog('es-ES')}\n\n`
  + `Signing certificate SHA-256: \`${certSha}\`. Language packs: see the \`packs-*\` releases. Privacy: PRIVACY.md.`;
gh(['release', 'create', tag, '--repo', repo, '--title', `LangSwap ${version}`, '--notes', notes, '--latest', apk]);
console.log(`\ndone: GitHub release ${tag} with ${path.basename(apk)}.
next: upload ${path.relative(ROOT, aab)} in the Play console (closed test or production); F-Droid picks up the tag (UpdateCheckMode: Tags).`);
