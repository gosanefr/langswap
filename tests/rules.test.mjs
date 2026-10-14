// node --test tests/ — règles de normalisation (004) et de nettoyage (013).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchKey, lightNormalize } from '../shared/normalize.mjs';
import { gender, regions, isPlaceholder, itPosLabel } from '../shared/lists.mjs';
import { cleanWord, senseNumbers, resolve, reparsePt, glossWords } from '../pipeline/cleanup.mjs';

test('searchKey: accents, case, ß, hyphen ≡ space, apostrophes', () => {
  assert.equal(searchKey('Péché'), 'peche');
  assert.equal(searchKey('Straße'), 'strasse');
  assert.equal(searchKey('  week-end '), 'week end');
  assert.equal(searchKey('week   end'), 'week end');
  assert.equal(searchKey('aujourd’hui'), "aujourd'hui");
  assert.equal(searchKey('Ärger'), 'arger');           // pas de translittération ä → ae
  assert.equal(searchKey('œuvre'), 'œuvre');
  assert.equal(lightNormalize(' l’eau  '), "l'eau");
});

test('cleanup: rejects', () => {
  const o = { edition: 'pt', entryLang: 'pt', targetLang: 'de', headword: 'nicotina' };
  assert.equal(cleanWord('n', o).reject, 'gender-only');
  assert.equal(cleanWord('N', o).pieces[0].w, 'N');
  assert.equal(cleanWord('', o).reject, 'empty');
  assert.equal(cleanWord('Сталинград', o).reject, 'non-latin');
  assert.equal(cleanWord('3.ª', o).pieces[0].w, '3.ª');
  assert.equal(cleanWord('oído', { ...o, targetLang: 'pt' }).reject, 'entry-lang');
  assert.equal(cleanWord('Argentina', { edition: 'it', entryLang: 'it', targetLang: 'es', headword: 'lavoro' }).reject, 'country');
  assert.equal(cleanWord('Gehuuri', { edition: 'en', entryLang: 'en', targetLang: 'de', headword: 'ghost', tags: ['Alemannic-German'] }).reject, 'dialect');
});

test('cleanup: fixes and splits', () => {
  const en = { edition: 'en', entryLang: 'en', targetLang: 'fr', headword: 'work' };
  assert.deepEqual(cleanWord('[6] ^((please verify)) œuvre', en).pieces, [{ w: 'œuvre' }]);
  assert.deepEqual(cleanWord('concentrarse [with en]', { ...en, targetLang: 'es' }).pieces, [{ w: 'concentrarse' }]);
  assert.deepEqual(cleanWord('[closed', { edition: 'it', entryLang: 'it', targetLang: 'en', headword: 'ferma' }).pieces, [{ w: 'closed' }]);
  const de = { edition: 'de', entryLang: 'de', targetLang: 'it', headword: 'Miene' };
  assert.deepEqual(cleanWord('aspetto ; [1b] lineamenti ; [2a] intenzione', de).pieces,
    [{ w: 'aspetto' }, { w: 'lineamenti', si: '1b' }, { w: 'intenzione', si: '2a' }]);
  assert.deepEqual(cleanWord('orgánico / orgánica', { ...de, targetLang: 'es' }).pieces, [{ w: 'orgánico' }, { w: 'orgánica' }]);
  assert.deepEqual(cleanWord('rupture ( ), breach ( )', { ...de, targetLang: 'en' }).pieces, [{ w: 'rupture' }, { w: 'breach' }]);
  assert.equal(cleanWord('acenar ( ) cabeça', { ...de, targetLang: 'pt' }).reject, 'empty-parens');
});

test('sense_index: lists, ranges, sub-senses, placeholders', () => {
  assert.deepEqual(senseNumbers('1–3, 7'), ['1', '2', '3', '7']);
  assert.deepEqual(senseNumbers('2-3'), ['2', '3']);
  assert.equal(senseNumbers('*'), null);
  assert.equal(senseNumbers('0'), null);
  assert.deepEqual(resolve(['2a'], new Set(['1', '2'])), ['2']);
  assert.deepEqual(resolve(['2'], new Set(['1', '2a', '2b'])), ['2a', '2b']);
  assert.deepEqual(reparsePt('1', 'e 2 (algo)'), { extra: ['2'], gloss: 'algo' });
  assert.deepEqual(reparsePt('1', '–3 (x)').extra, ['2', '3']);
});

test('closed lists', () => {
  assert.equal(gender(['masculine']), 'm.');
  assert.equal(gender([], ['m/f']), 'm./f.');
  assert.equal(regions(['Brazil']), 'BR');
  assert.equal(regions([], ['Royaume-Uni', 'États-Unis']), 'GB,US');
  assert.equal(regions(['informal']), '');
  assert.ok(isPlaceholder('Translations') && isPlaceholder('sdü') && isPlaceholder('Traductions à trier suivant le sens'));
  assert.ok(!isPlaceholder('termine araldico'));
  assert.equal(itPosLabel('(aggettivo)'), 'adj');
});

test('English glosses → X→en links (012)', () => {
  const links = [['work', 'work'], ['labor', 'labor'], ['gratis', 'gratis#English']];
  assert.deepEqual(glossWords('work; labor', links), ['work', 'labor']);
  assert.deepEqual(glossWords('free, gratis', links), []);
  assert.deepEqual(glossWords('to work (hard)', links), ['work']);
});
