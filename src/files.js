// project-docs/src/files.js
// Read/write the doc files in <project>/docs. Files are the source of truth.
const path = require('path');
const fs = require('fs');
const { DOCS_DIR, ensureDirs } = require('./paths');

// name -> { file, writable }
const DOCS = {
  idea:         { file: 'idea.md',         writable: true  },
  workflow:     { file: 'workflow.md',     writable: true  },
  architecture: { file: 'architecture.md', writable: false }, // Claude Code only
  diagram:      { file: 'diagram.mmd',     writable: false }, // Claude Code only
};

function spec(name) {
  return Object.prototype.hasOwnProperty.call(DOCS, name) ? DOCS[name] : null;
}

function docPath(name) {
  const s = spec(name);
  if (!s) return null;
  return path.join(DOCS_DIR, s.file);
}

// Returns { exists, content, mtime } — never throws on missing file.
function readDoc(name) {
  const p = docPath(name);
  if (!p || !fs.existsSync(p)) return { exists: false, content: '', mtime: null };
  const content = fs.readFileSync(p, 'utf8');
  const mtime = fs.statSync(p).mtime.toISOString();
  return { exists: true, content, mtime };
}

function writeDoc(name, content) {
  const s = spec(name);
  if (!s) throw Object.assign(new Error('Unknown doc'), { status: 404 });
  if (!s.writable) throw Object.assign(new Error('This doc is read-only (Claude Code edits it)'), { status: 403 });
  ensureDirs();
  fs.writeFileSync(docPath(name), content ?? '', 'utf8');
  return readDoc(name);
}

module.exports = { DOCS, spec, readDoc, writeDoc };
