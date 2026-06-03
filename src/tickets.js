// project-docs/src/tickets.js
// CRUD over <project>/tasks/NNNN-slug.md. Each file is one ticket (frontmatter + markdown body).
const fs = require('fs');
const path = require('path');
const { TASKS_DIR, ensureDirs } = require('./paths');
const fm = require('./frontmatter');

function slugify(s) {
  return String(s || 'ticket')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'ticket';
}

function pad(n) { return String(n).padStart(4, '0'); }

function listFiles() {
  ensureDirs();
  return fs.readdirSync(TASKS_DIR)
    .filter(f => f.endsWith('.md') && !f.startsWith('_'))
    .sort();
}

function fileFor(id) {
  const want = pad(id);
  return listFiles().find(f => f.startsWith(want + '-') || f === want + '.md') || null;
}

function readFile(file) {
  const full = path.join(TASKS_DIR, file);
  const { data, body } = fm.parse(fs.readFileSync(full, 'utf8'));
  const steps = data.steps || [];
  return {
    id: data.id || file.match(/^(\d+)/)?.[1] || '',
    file,
    title: data.title || '(untitled)',
    status: data.status || 'open',
    created: data.created || '',
    source: data.source || 'manual',
    reasoning: data.reasoning || '',
    steps,
    steps_total: steps.length,
    steps_done: steps.filter(s => s.done).length,
    body,
  };
}

function list() {
  return listFiles().map(readFile).sort((a, b) => (a.id < b.id ? 1 : -1));
}

function get(id) {
  const file = fileFor(id);
  return file ? readFile(file) : null;
}

function nextId() {
  const ids = listFiles().map(f => parseInt(f, 10)).filter(n => !isNaN(n));
  return pad((ids.length ? Math.max(...ids) : 0) + 1);
}

function create({ title, reasoning = '', steps = [], source = 'manual', body = '' }) {
  ensureDirs();
  const id = nextId();
  const file = `${id}-${slugify(title)}.md`;
  const data = {
    id, title: title || 'Untitled', status: 'open',
    created: new Date().toISOString().slice(0, 10), source, reasoning,
    steps: steps.map(s => (typeof s === 'string' ? { text: s, done: false } : { text: s.text, done: !!s.done })),
  };
  fs.writeFileSync(path.join(TASKS_DIR, file), fm.stringify(data, body), 'utf8');
  return readFile(file);
}

function update(id, patch = {}) {
  const file = fileFor(id);
  if (!file) return null;
  const cur = readFile(file);
  const data = {
    id: cur.id,
    title: patch.title ?? cur.title,
    status: patch.status ?? cur.status,
    created: cur.created,
    source: cur.source,
    reasoning: patch.reasoning ?? cur.reasoning,
    steps: patch.steps
      ? patch.steps.map(s => ({ text: s.text, done: !!s.done }))
      : cur.steps,
  };
  const body = patch.body ?? cur.body;
  fs.writeFileSync(path.join(TASKS_DIR, file), fm.stringify(data, body), 'utf8');
  return readFile(file);
}

function remove(id) {
  const file = fileFor(id);
  if (!file) return false;
  fs.unlinkSync(path.join(TASKS_DIR, file));
  return true;
}

module.exports = { list, get, create, update, remove, slugify };
