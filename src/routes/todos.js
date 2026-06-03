// project-docs/src/routes/todos.js
// Backed by tasks/_todos.md (see src/todos.js). No database.
const { Router } = require('express');
const todos = require('../todos');

const router = Router();

router.get('/', (_req, res) => res.json(todos.list()));

router.post('/', (req, res) => {
  const { content } = req.body || {};
  if (!content?.trim()) return res.status(400).json({ error: 'content required' });
  res.status(201).json(todos.add(content.trim()));
});

router.delete('/:id', (req, res) => {
  const ok = todos.removeAt(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

module.exports = router;
