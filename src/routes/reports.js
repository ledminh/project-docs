// project-docs/src/routes/reports.js
// Read-only: reports are written by AIs directly to docs/reports/, never via the API.
const { Router } = require('express');
const reports = require('../reports');

const router = Router();

router.get('/', (_req, res) => res.json(reports.list()));

router.get('/:file', (req, res) => {
  const r = reports.get(req.params.file);
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json(r);
});

module.exports = router;
