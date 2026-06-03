// project-docs/src/routes/todos.js
// Minimal todo store (full Todo UI lands in Phase 4; the API + table exist now).
const { Router } = require('express');
const { db } = require('../db');

const router = Router();

router.get('/', (_req, res) => {
  res.json(db.prepare('SELECT * FROM todos ORDER BY sort_order, id').all());
});

router.post('/', (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'content required' });
  const r = db.prepare('INSERT INTO todos (content) VALUES (?)').run(content.trim());
  res.status(201).json(db.prepare('SELECT * FROM todos WHERE id = ?').get(r.lastInsertRowid));
});

router.patch('/:id', (req, res) => {
  const { content, sort_order } = req.body;
  if (content !== undefined)    db.prepare('UPDATE todos SET content = ? WHERE id = ?').run(content, req.params.id);
  if (sort_order !== undefined) db.prepare('UPDATE todos SET sort_order = ? WHERE id = ?').run(sort_order, req.params.id);
  const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM todos WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
