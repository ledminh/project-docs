#!/usr/bin/env node
// project-docs/bin/setup.js
// Idempotent scaffold: prepares the HOST PROJECT to use the Project Docs app.
//   - creates docs/ and tasks/ in the project root
//   - writes the .claude/project-docs.md integration contract (refreshed each run)
//   - wires an @import into the project's root CLAUDE.md (added once)
//
// The app code lives in .project-docs/app/ (entirely gitignored); the contract lives in
// .claude/ (tracked) so no single folder mixes tracked + ignored content.
const fs = require('fs');
const path = require('path');
const { ROOT, DOCS_DIR, TASKS_DIR, CLAUDE_DIR, ensureDirs } = require('../src/paths');

const IMPORT_LINE = '@.claude/project-docs.md';
const BEGIN = '<!-- project-docs:begin -->';
const END = '<!-- project-docs:end -->';

const CONTRACT = `# Project Docs — conventions for Claude Code

This project uses the **Project Docs** app (in \`.project-docs/app\`). It surfaces four views backed
by plain files in this project. Follow these conventions whenever you work here.

## Files you read and write

- \`docs/idea.md\` — the user's initial idea capture. User-editable.
- \`docs/workflow.md\` — how the app/feature should work. User-editable; you may populate it on request.
- \`docs/architecture.md\` — current architecture. **Read-only in the UI — you maintain this file.**
- \`docs/diagram.mmd\` — a Mermaid diagram of the system. **Read-only in the UI — you maintain this file.**
  Absent until you create it.

## Populating views

- When the user captures an idea (\`docs/idea.md\`), generate \`docs/workflow.md\` **and**
  \`docs/diagram.mmd\` **together**. The first diagram should show only the general components
  (frontend / backend / database / mobile / web, etc.), then refine it as the architecture firms up.
- Keep \`docs/architecture.md\` and \`docs/diagram.mmd\` in sync with the real codebase as it changes.

## Implementation inbox — \`tasks/*.md\`

Each file in \`tasks/\` is a ticket: YAML frontmatter
(\`id, title, status, created, source, reasoning, steps[]\`) followed by a markdown body that
describes what to build.

When asked to **"work the tickets"**:
1. Read every \`tasks/*.md\` whose \`status\` is not \`done\`.
2. Implement the body.
3. Check off completed \`steps\` (set \`done: true\`).
4. Set \`status: done\` when the whole ticket is complete.

Never delete task files.

\`tasks/_todos.md\` is the user's lightweight scratch todo list (the leading \`_\` keeps it out of the
ticket grid). It is not a ticket — don't implement it directly; the user promotes todos into tickets.

There is no database. Everything is plain text in \`docs/\` and \`tasks/\`. \`.project-docs/\` holds only
this contract.
`;

function writeIfChanged(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return false;
  fs.writeFileSync(file, content, 'utf8');
  return true;
}

function wireRootClaudeMd() {
  const rootMd = path.join(ROOT, 'CLAUDE.md');
  const block = `${BEGIN}\n${IMPORT_LINE}\n${END}\n`;
  if (!fs.existsSync(rootMd)) {
    fs.writeFileSync(rootMd, `# ${path.basename(ROOT)}\n\n${block}`, 'utf8');
    return 'created';
  }
  const cur = fs.readFileSync(rootMd, 'utf8');
  if (cur.includes(IMPORT_LINE)) return 'already-wired';
  fs.writeFileSync(rootMd, cur.replace(/\s*$/, '') + `\n\n${block}`, 'utf8');
  return 'appended';
}

function main() {
  ensureDirs();
  if (!fs.existsSync(CLAUDE_DIR)) fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  const contractPath = path.join(CLAUDE_DIR, 'project-docs.md');
  const wroteContract = writeIfChanged(contractPath, CONTRACT);
  const rootStatus = wireRootClaudeMd();

  const rel = p => path.relative(ROOT, p) || '.';
  console.log('Project Docs scaffold complete.');
  console.log('  project root      : ' + ROOT);
  console.log('  docs/             : ' + rel(DOCS_DIR));
  console.log('  tasks/            : ' + rel(TASKS_DIR));
  console.log('  contract          : ' + rel(contractPath) + (wroteContract ? ' (written)' : ' (unchanged)'));
  console.log('  root CLAUDE.md    : ' + rootStatus);
  console.log('');
  console.log('Run it:  cd .project-docs/app && npm install && npm start   →  http://localhost:4500');
}

main();
