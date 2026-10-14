// Historique : journal chronologique en lecture-écriture (ticket 006).
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ROOT } from '../shared/config.mjs';
import { searchKey } from '../shared/normalize.mjs';

export function openHistory(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode=WAL;');
  db.exec(fs.readFileSync(path.join(ROOT, 'shared/history.sql'), 'utf8'));
  db.function('search_key', { deterministic: true }, s => searchKey(s ?? ''));

  const q = {
    insert: db.prepare('INSERT INTO search (input, lemma, langs, timestamp, parent_id) VALUES (?, ?, ?, ?, ?)'),
    replace: db.prepare('UPDATE search SET input = ?, lemma = ?, langs = ?, timestamp = ? WHERE id = ?'),
    remove: db.prepare('DELETE FROM search WHERE id = ?'),
    clear: db.prepare('DELETE FROM search'),
    page: db.prepare(`SELECT * FROM search WHERE id < ? ORDER BY id DESC LIMIT ?`),
    filteredPage: db.prepare(`SELECT * FROM search WHERE id < ?1
      AND (instr(search_key(input), ?2) > 0 OR instr(search_key(coalesce(lemma, '')), ?2) > 0) ORDER BY id DESC LIMIT ?3`),
    byId: db.prepare('SELECT * FROM search WHERE id = ?'),
  };

  return {
    add({ input, lemma, langs, parentId = null }) {
      const r = q.insert.run(input, lemma ?? null, langs.join(','), new Date().toISOString(), parentId);
      return Number(r.lastInsertRowid);
    },
    replace(id, { input, lemma, langs }) {
      q.replace.run(input, lemma ?? null, langs.join(','), new Date().toISOString(), id);
      return id;
    },
    remove: id => { q.remove.run(id); },
    clear: () => { q.clear.run(); },
    /** Page d'entrées, plus récentes d'abord ; `before` = id exclu (défilement). */
    list({ before = Number.MAX_SAFE_INTEGER, limit = 100, filter = '' }) {
      const k = searchKey(filter);
      const rows = k ? q.filteredPage.all(before, k, limit) : q.page.all(before, limit);
      return rows.map(({ parent_id: parentId, ...r }) => ({ ...r, parentId, langs: r.langs.split(',').filter(Boolean),
        parent: parentId ? (q.byId.get(parentId)?.input ?? null) : null }));
    },
  };
}
