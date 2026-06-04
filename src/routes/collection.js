// project-docs/src/routes/collection.js
// Router factory for a markdown collection folder. Plans/Reports are read-only
// (AIs write the files directly); Requests additionally accept POST from the composer.
const { Router } = require('express');
const col = require('../collections');

module.exports = function collectionRouter(dir, { writable = false, author = '' } = {}) {
  const router = Router();

  router.get('/', (_req, res) => res.json(col.list(dir)));

  router.get('/:file', (req, res) => {
    const doc = col.get(dir, req.params.file);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  });

  if (writable) {
    router.post('/', (req, res) => {
      try {
        const created = col.create(dir, { content: req.body?.content, author });
        res.status(201).json(created);
      } catch (err) {
        res.status(err.status || 500).json({ error: err.message });
      }
    });
  }

  return router;
};
