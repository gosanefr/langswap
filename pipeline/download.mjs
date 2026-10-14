// download : copie les 6 dumps kaikki dans dumps/AAAA-MM-JJ/ avec manifest.json (sha256).
// Usage : node pipeline/download.mjs            → dumps wiktextract
//         node pipeline/download.mjs --wikdict  → épingle les 30 bases WikDict (une fois)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DUMPS_DIR } from '../shared/config.mjs';
import { EDITIONS, LANGS, WIKDICT_URL } from '../shared/constants.mjs';

const today = new Date().toISOString().slice(0, 10);

async function head(url) {
  const r = await fetch(url, { method: 'HEAD' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return { size: Number(r.headers.get('content-length')), date: r.headers.get('last-modified') };
}

async function copy(url, target) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const hash = crypto.createHash('sha256');
  let n = 0, last = 0;
  const total = Number(r.headers.get('content-length')) || 0;
  const src = Readable.fromWeb(r.body);
  src.on('data', c => {
    hash.update(c); n += c.length;
    if (n - last > 200e6) { last = n; console.log(`  ${path.basename(target)} ${(n / 1e9).toFixed(2)}/${(total / 1e9).toFixed(2)} GB`); }
  });
  await pipeline(src, fs.createWriteStream(target + '.part'));
  fs.renameSync(target + '.part', target);
  return { sha256: hash.digest('hex'), size: n };
}

function freeSpace(dir) {
  const s = fs.statfsSync(dir);
  return s.bavail * s.bsize;
}

async function wiktextractDumps() {
  const dir = path.join(DUMPS_DIR, today);
  fs.mkdirSync(dir, { recursive: true });
  const heads = Object.fromEntries(await Promise.all(Object.entries(EDITIONS).map(async ([ed, url]) => [ed, await head(url)])));
  const expected = Object.values(heads).reduce((s, e) => s + e.size, 0);
  const free = freeSpace(DUMPS_DIR);
  if (free < 2 * expected) throw new Error(`Not enough space: ${(free / 1e9).toFixed(1)} GB free, ${(2 * expected / 1e9).toFixed(1)} GB needed (2× ${(expected / 1e9).toFixed(1)} GB)`);
  console.log(`Downloading ${(expected / 1e9).toFixed(2)} GB to ${dir}`);

  const manifest = { downloaded_at: new Date().toISOString(), files: {} };
  await Promise.all(LANGS.map(async ed => {
    const url = EDITIONS[ed];
    const target = path.join(dir, path.basename(url));
    const { sha256, size } = await copy(url, target);
    if (size !== heads[ed].size) throw new Error(`${ed}: size ${size} ≠ ${heads[ed].size}`);
    manifest.files[ed] = { url, file: path.basename(url), server_date: heads[ed].date, size, sha256 };
    console.log(`  ✓ ${ed} ${sha256.slice(0, 12)}`);
  }));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Rétention : le jeu courant + le précédent.
  const sets = fs.readdirSync(DUMPS_DIR).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  for (const old of sets.slice(0, -2)) {
    console.log(`Removing old dump set ${old}`);
    fs.rmSync(path.join(DUMPS_DIR, old), { recursive: true });
  }
  console.log(`Done. Pinned dump set: ${today}`);
}

async function wikdict() {
  const dir = path.join(DUMPS_DIR, `wikdict-${today}`);
  fs.mkdirSync(dir, { recursive: true });
  const manifest = { downloaded_at: new Date().toISOString(), files: {} };
  const pairs = LANGS.flatMap(a => LANGS.filter(b => b !== a).map(b => `${a}-${b}`));
  for (const p of pairs) {
    const url = `${WIKDICT_URL}${p}.sqlite3`;
    const { sha256, size } = await copy(url, path.join(dir, `${p}.sqlite3`));
    manifest.files[p] = { url, size, sha256 };
    console.log(`  ✓ ${p}`);
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

fs.mkdirSync(DUMPS_DIR, { recursive: true });
await (process.argv.includes('--wikdict') ? wikdict() : wiktextractDumps());
