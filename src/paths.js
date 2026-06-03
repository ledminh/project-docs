// project-docs/src/paths.js
// Resolves all content locations relative to the HOST PROJECT ROOT — never the app folder.
// Host root resolution order:
//   1. PROJECT_ROOT env var (absolute path) — always wins.
//   2. Default: the project that contains this app. The app is installed at
//      <project>/.project-docs/app/, so the default root is the parent of `.project-docs`.
//      (Also supports a bare <project>/project-docs/ layout: parent of the app folder.)
const path = require('path');
const fs = require('fs');

const APP_DIR = path.resolve(__dirname, '..');   // .../.project-docs/app  (or .../project-docs)
let defaultRoot = path.dirname(APP_DIR);
if (path.basename(defaultRoot) === '.project-docs') defaultRoot = path.dirname(defaultRoot);
const ROOT = path.resolve(process.env.PROJECT_ROOT || defaultRoot);

const DOCS_DIR   = path.join(ROOT, 'docs');
const TASKS_DIR  = path.join(ROOT, 'tasks');
const CLAUDE_DIR = path.join(ROOT, '.claude'); // the contract lives here (tracked)

// Only ever auto-create content dirs. The app folder (.project-docs/) and .claude/ are
// managed by the scaffold, not created on every boot.
function ensureDirs() {
  for (const d of [DOCS_DIR, TASKS_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

module.exports = { ROOT, DOCS_DIR, TASKS_DIR, CLAUDE_DIR, ensureDirs };
