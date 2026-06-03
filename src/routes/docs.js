// project-docs/src/routes/docs.js
const { Router } = require('express');
const { spec, readDoc, writeDoc } = require('../files');

const router = Router();

// GET /api/doc/:name  → read any known doc
router.get('/:name', (req, res) => {
  const s = spec(req.params.name);
  if (!s) return res.status(404).json({ error: 'Unknown doc' });
  const { exists, content, mtime } = readDoc(req.params.name);
  res.json({ name: req.params.name, exists, content, mtime, writable: s.writable });
});

// PUT /api/doc/:name  → write (only idea + workflow are writable via API)
router.put('/:name', (req, res) => {
  try {
    const result = writeDoc(req.params.name, req.body?.content);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
