// extract : lit chaque dump en flux, garde les entrées des 6 langues et les champs utiles,
// sans aucune règle de nettoyage. Sortie : cache/<sha256>.jsonl.gz, réutilisée tant que le dump ne change pas.
// Usage : node pipeline/extract.mjs [--set=AAAA-MM-JJ] [--force]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CACHE_DIR } from '../shared/config.mjs';
import { LANGS } from '../shared/constants.mjs';
import { pinnedDumpSet } from './common.mjs';

const SIX = new Set(LANGS);
const IGNORED_POS = new Set(['hard-redirect', 'soft-redirect']);
const IGNORED_FORM_TAGS = new Set(['table-tags', 'inflection-template', 'class', 'romanization', 'canonical']);
const PREFILTER = /"lang_code": ?"(?:fr|en|es|de|it|pt)"/;

/** Entrée wiktextract → entrée compacte (null si hors périmètre). */
export function compact(o, edition) {
  if (!SIX.has(o.lang_code) || !o.word || IGNORED_POS.has(o.pos)) return null;
  const e = { w: o.word, l: o.lang_code, p: o.pos || 'unknown' };
  if (edition === 'es' && o.etymology_texts?.length) e.ety = o.etymology_texts.join('\n').slice(0, 200);

  const senses = [];
  for (const s of o.senses || []) {
    const x = {};
    if (s.glosses?.length) x.g = s.glosses;
    if (s.sense_index != null && s.sense_index !== '') x.si = String(s.sense_index);
    if (s.form_of?.length) x.fo = s.form_of.map(f => f.word).filter(Boolean);
    // Entrées étrangères de l'édition en : liens de la glose (ticket 012).
    if (edition === 'en' && o.lang_code !== 'en' && s.links?.length && !x.fo) x.lk = s.links.map(l => [l[0], l[1]]);
    if (x.g || x.fo) senses.push(x);
  }
  if (senses.length) e.s = senses;

  const forms = [];
  for (const f of o.forms || []) {
    if (!f.form || f.form === o.word || f.form === '-' || f.form === '—') continue;
    if (f.tags?.some(t => IGNORED_FORM_TAGS.has(t))) continue;
    forms.push(f.form);
  }
  if (forms.length) e.f = [...new Set(forms)];

  const trans = [];
  const all = [...(o.translations || []), ...(o.senses || []).flatMap(s => s.translations || [])];
  for (const t of all) {
    const l = t.lang_code || t.code;
    if (!SIX.has(l)) continue;
    const x = { l, w: t.word ?? '' };
    if (t.sense) x.s = t.sense;
    if (t.sense_index != null && t.sense_index !== '' && t.sense_index !== 0) x.si = String(t.sense_index);
    if (t.tags?.length) x.tg = t.tags;
    if (t.raw_tags?.length) x.rt = t.raw_tags;
    trans.push(x);
  }
  if (trans.length) e.t = trans;

  if (!e.s && !e.t && !e.f) return null;
  return e;
}

async function extractEdition(edition, source, target) {
  const start = Date.now();
  const input = fs.createReadStream(source).pipe(zlib.createGunzip({ chunkSize: 1 << 20 }));
  const gz = zlib.createGzip({ level: 3 });
  const output = fs.createWriteStream(target + '.part');
  gz.pipe(output);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let read = 0, kept = 0, buffer = [];
  for await (const line of rl) {
    read++;
    if (!PREFILTER.test(line)) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    const e = compact(o, edition);
    if (!e) continue;
    kept++;
    buffer.push(JSON.stringify(e));
    if (buffer.length >= 2000) { if (!gz.write(buffer.join('\n') + '\n')) await new Promise(r => gz.once('drain', r)); buffer = []; }
    if (read % 1_000_000 === 0) console.log(`  [${edition}] ${read / 1e6} M lines, ${kept} kept, ${((Date.now() - start) / 1000).toFixed(0)} s`);
  }
  if (buffer.length) gz.write(buffer.join('\n') + '\n');
  gz.end();
  await new Promise(r => output.on('finish', r));
  fs.renameSync(target + '.part', target);
  console.log(`  ✓ [${edition}] ${read} lines read, ${kept} entries kept, ${((Date.now() - start) / 1000).toFixed(0)} s`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = process.argv.find(a => a.startsWith('--edition='));
  if (arg) {
    // Processus enfant : une édition.
    const [edition, source, target] = [arg.split('=')[1], process.argv[3], process.argv[4]];
    await extractEdition(edition, source, target);
  } else {
    const { dir, manifest } = pinnedDumpSet(process.argv);
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const force = process.argv.includes('--force');
    console.log(`extract: dump set ${path.basename(dir)}`);
    const start = Date.now();
    await Promise.all(LANGS.map(ed => {
      const f = manifest.files[ed];
      const target = path.join(CACHE_DIR, `${f.sha256}.jsonl.gz`);
      if (!force && fs.existsSync(target)) { console.log(`  = [${ed}] cache present`); return null; }
      return new Promise((ok, ko) => {
        const p = spawn(process.execPath, ['--no-warnings', fileURLToPath(import.meta.url), `--edition=${ed}`, path.join(dir, f.file), target], { stdio: 'inherit' });
        p.on('exit', c => c === 0 ? ok() : ko(new Error(`extraction ${ed}: exit code ${c}`)));
      });
    }));
    const min = (Date.now() - start) / 60000;
    console.log(`extract: done in ${min.toFixed(1)} min${min > 60 ? ' — WARNING: ≈ 1 h budget exceeded' : ''}`);
  }
}
