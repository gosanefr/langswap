// Banc WebView : search.mjs tel quel, SQL via le pont Android (bridge.all → SQLite embarqué, synchrone).
// Mesure par recherche : total (JS + pont + SQL) et part native (SQL + sérialisation JSON côté Kotlin).
import { search } from '../server/search.mjs';

const bridge = window.Android;
const log = l => { bridge.log(l); document.body.textContent += l + '\n'; };
const stats = t => {
  if (!t.length) return '—';
  const s = [...t].sort((a, b) => a - b), p = x => s[Math.min(s.length - 1, Math.floor(s.length * x))];
  return `p50 ${p(0.5).toFixed(1).padStart(5)} ms  p95 ${p(0.95).toFixed(1).padStart(5)} ms  max ${s.at(-1).toFixed(1).padStart(6)} ms  (n=${s.length})`;
};
const sha1 = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');

try {
  const trace = JSON.parse(bridge.trace());
  const only = bridge.config();
  log(`WebView ${navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0]}`);
  // Coût d'un aller-retour du pont, à vide.
  for (let attempt = 0; attempt < 2; attempt++) {
    const t0 = performance.now();
    for (let i = 0; i < 2000; i++) bridge.nativeMs();
    log(`empty bridge call: ${((performance.now() - t0) / 2000 * 1000).toFixed(0)} µs`);
  }
  for (const [name, c] of Object.entries(trace)) {
    if (only && name !== only) continue;
    bridge.open(name);
    const q = {};
    let calls = 0;
    for (const k of Object.keys(c.sql)) q[k] = { all: (...a) => { calls++; return JSON.parse(bridge.all(k, JSON.stringify(a))); } };
    const meta = Object.fromEntries(q.meta.all().map(r => [r.name, r.value]));
    q.ranges = JSON.parse(meta.word_ranges);

    const m = { cold: [], warm: [], sample: [], nativeWarm: [], nativeSample: [] };
    let identical = 0;
    const different = [];
    for (let pass = 0; pass < 3; pass++) for (const r of c.searches) {
      if (!r.bench && pass > 0) continue;
      bridge.nativeReset();
      if (pass === 1 && r === c.searches[0]) calls = 0;
      const t0 = performance.now();
      const res = search(q, { input: r.word, source: r.source, langs: c.langs });
      const ms = performance.now() - t0, native = bridge.nativeMs();
      if (!r.bench) { m.sample.push(ms); m.nativeSample.push(native); }
      else if (pass === 0) m.cold.push(ms);
      else { m.warm.push(ms); m.nativeWarm.push(native); }
      if (pass === 0) {
        if (await sha1(JSON.stringify(res, (k, v) => (k === 'ms' ? undefined : v))) === r.hash) identical++;
        else different.push(`${r.source ?? 'AUTO'}:${r.word}`);
      }
    }
    log(`\n== ${name} (WebView, mmap/cache)`);
    log(`  bench, 1st pass: ${stats(m.cold)}`);
    log(`  bench, passes 2-3: ${stats(m.warm)}`);
    log(`    of which native: ${stats(m.nativeWarm)}`);
    if (m.sample.length) {
      log(`  sample of ${m.sample.length} words: ${stats(m.sample)}`);
      log(`    of which native: ${stats(m.nativeSample)}`);
    }
    log(`  bridge calls per bench search (passes 2-3): ${(calls / m.warm.length).toFixed(0)} on average`);
    log(`  results identical to desktop: ${identical}/${c.searches.length}${different.length ? '  different: ' + different.slice(0, 8).join(' ') : ''}`);
    bridge.close();
  }
} catch (e) {
  log(`ERROR ${e}\n${e.stack}`);
}
bridge.done();
