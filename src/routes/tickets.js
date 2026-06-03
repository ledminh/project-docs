// project-docs/src/routes/tickets.js
const { Router } = require('express');
const tickets = require('../tickets');

const router = Router();

router.get('/', (_req, res) => res.json(tickets.list()));

router.get('/:id', (req, res) => {
  const t = tickets.get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  res.json(t);
});

router.post('/', (req, res) => {
  const { title } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });
  res.status(201).json(tickets.create(req.body));
});

router.patch('/:id', (req, res) => {
  const t = tickets.update(req.params.id, req.body || {});
  if (!t) return res.status(404).json({ error: 'Not found' });
  res.json(t);
});

router.delete('/:id', (req, res) => {
  const ok = tickets.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

module.exports = router;
