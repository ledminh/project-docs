// project-docs/src/reports.js
// Read-only access to AI work reports: <project>/docs/reports/YYYY-MM-DD-slug.md
// Each report = YAML-ish frontmatter (title, date, author, ticket?, summary) + long markdown body.
// The app never writes these — AIs (or the user) create the files directly.
const fs = require('fs');
const path = require('path');
const { REPORTS_DIR } = require('./paths');
const fm = require('./frontmatter');

function firstLine(body) {
  const line = String(body || '').trim().split('\n').find(l => l.trim() && !l.startsWith('#'));
  return (line || '').slice(0, 220);
}

function meta(file) {
  const { data, body } = fm.parse(fs.readFileSync(path.join(REPORTS_DIR, file), 'utf8'));
  return {
    file,
    title: data.title || file.replace(/\.md$/, ''),
    date: data.date || (file.match(/^\d{4}-\d{2}-\d{2}/) || [''])[0],
    author: data.author || '',
    ticket: data.ticket || '',
    summary: data.summary || firstLine(body),
  };
}

// newest first (date-prefixed filenames sort naturally)
function list() {
  if (!fs.existsSync(REPORTS_DIR)) return [];
  return fs.readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('.md') && !f.startsWith('_'))
    .sort().reverse()
    .map(meta);
}

function get(name) {
  const safe = path.basename(String(name || ''));
  if (!safe.endsWith('.md')) return null;
  const p = path.join(REPORTS_DIR, safe);
  if (!fs.existsSync(p)) return null;
  const { data, body } = fm.parse(fs.readFileSync(p, 'utf8'));
  return {
    file: safe,
    title: data.title || safe.replace(/\.md$/, ''),
    date: data.date || (safe.match(/^\d{4}-\d{2}-\d{2}/) || [''])[0],
    author: data.author || '',
    ticket: data.ticket || '',
    summary: data.summary || '',
    body,
    mtime: fs.statSync(p).mtime.toISOString(),
  };
}

module.exports = { list, get };
