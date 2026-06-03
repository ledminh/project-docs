// project-docs/src/paths.js
// Resolves all content locations relative to the HOST PROJECT ROOT — never the app folder.
// Host root resolution order:
//   1. PROJECT_ROOT env var (absolute path) — always wins.
//   2. Default: the PARENT of this app folder, since the app is installed *inside* a project
//      (e.g. <project>/project-docs/ → root is <project>/). This makes `cd project-docs && npm start`
//      treat the surrounding project as the root, not project-docs itself.
const path = require('path');
const fs = require('fs');

const APP_DIR = path.resolve(__dirname, '..');   // .../project-docs
const DEFAULT_ROOT = path.dirname(APP_DIR);      // the surrounding project
const ROOT = path.resolve(process.env.PROJECT_ROOT || DEFAULT_ROOT);

const DOCS_DIR  = path.join(ROOT, 'docs');
const TASKS_DIR = path.join(ROOT, 'tasks');
const STATE_DIR = path.join(ROOT, '.project-docs');

function ensureDirs() {
  for (const d of [DOCS_DIR, TASKS_DIR, STATE_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
}

module.exports = { ROOT, DOCS_DIR, TASKS_DIR, STATE_DIR, ensureDirs };
