// project-docs/src/collections.js
// Generic access to a folder of markdown documents named YYYY-MM-DD-NN-slug.md
// (NN = per-day sequence, so multiple docs on one day stay ordered).
// Used by Requests (writable via the app), Plans and Reports (AI-written, read-only here).
const fs = require('fs');
const path = require('path');
const fm = require('./frontmatter');

function q(v) { return JSON.stringify(String(v == null ? '' : v)); }

function firstLine(body) {
  const line = String(body || '').trim().split('\n').find(l => l.trim() && !l.startsWith('#'));
  return (line || '').slice(0, 220);
}

function titleFrom(content) {
  const lines = String(content || '').trim().split('\n');
  const heading = lines.find(l => /^#{1,3}\s+\S/.test(l));
  const raw = heading ? heading.replace(/^#{1,3}\s+/, '') : (lines.find(l => l.trim()) || 'Untitled');
  return raw.replace(/[*_`]/g, '').trim().slice(0, 80) || 'Untitled';
}

function slugify(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'untitled';
}

function meta(dir, file) {
  const { data, body } = fm.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  return {
    file,
    title: data.title || file.replace(/\.md$/, ''),
    date: data.date || (file.match(/^\d{4}-\d{2}-\d{2}/) || [''])[0],
    author: data.author || '',
    status: data.status || '',
    request: data.request || '',
    ticket: data.ticket || '',
    summary: data.summary || firstLine(body),
  };
}

// newest first — the date-NN filename prefix makes lexicographic order chronological
function list(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && !f.startsWith('_'))
    .sort().reverse()
    .map(f => meta(dir, f));
}

function get(dir, name) {
  const safe = path.basename(String(name || ''));
  if (!safe.endsWith('.md')) return null;
  const p = path.join(dir, safe);
  if (!fs.existsSync(p)) return null;
  const { data, body } = fm.parse(fs.readFileSync(p, 'utf8'));
  return { ...meta(dir, safe), summary: data.summary || '', body, mtime: fs.statSync(p).mtime.toISOString() };
}

// next per-day sequence number: scans existing files for today's date
function nextSeq(dir, date) {
  if (!fs.existsSync(dir)) return 1;
  const nums = fs.readdirSync(dir)
    .map(f => f.match(new RegExp('^' + date + '-(\\d{2})-')))
    .filter(Boolean)
    .map(m => parseInt(m[1], 10));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

// create a new doc from raw markdown content (used by Requests)
function create(dir, { content, author = '' }) {
  if (!String(content || '').trim()) throw Object.assign(new Error('content required'), { status: 400 });
  fs.mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const seq = String(nextSeq(dir, date)).padStart(2, '0');
  const title = titleFrom(content);
  const file = `${date}-${seq}-${slugify(title)}.md`;
  const fmBlock = ['---', `title: ${q(title)}`, `date: ${q(date)}`, author ? `author: ${q(author)}` : null, `status: ${q('open')}`, '---', '']
    .filter(l => l !== null).join('\n');
  fs.writeFileSync(path.join(dir, file), fmBlock + String(content).trim() + '\n', 'utf8');
  return meta(dir, file);
}

module.exports = { list, get, create };
