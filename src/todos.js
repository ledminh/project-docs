// project-docs/src/todos.js
// Todos are a plain-text checklist at <project>/tasks/_todos.md — tracked in git, Claude-readable.
// The "_" prefix keeps it out of the ticket grid (tickets.js ignores files starting with "_").
const fs = require('fs');
const path = require('path');
const { TASKS_DIR, ensureDirs } = require('./paths');

const FILE = () => path.join(TASKS_DIR, '_todos.md');
const HEADER = '# Todos\n\n';

function readLines() {
  const f = FILE();
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8')
    .split(/\r?\n/)
    .map(l => l.match(/^\s*-\s+(?:\[[ xX]\]\s+)?(.*\S)\s*$/))
    .filter(Boolean)
    .map(m => m[1]);
}

function write(items) {
  ensureDirs();
  const body = items.length ? items.map(t => `- ${t}`).join('\n') + '\n' : '';
  fs.writeFileSync(FILE(), HEADER + body, 'utf8');
}

// id == current index (the UI reloads the full list after each change, so indices stay stable per render)
function list() {
  return readLines().map((content, id) => ({ id, content }));
}
function add(content) {
  const items = readLines();
  items.push(String(content).trim());
  write(items);
  return { id: items.length - 1, content: String(content).trim() };
}
function removeAt(id) {
  const items = readLines();
  if (id < 0 || id >= items.length) return false;
  items.splice(id, 1);
  write(items);
  return true;
}
function contentAt(id) {
  const items = readLines();
  return (id >= 0 && id < items.length) ? items[id] : null;
}

module.exports = { list, add, removeAt, contentAt };
