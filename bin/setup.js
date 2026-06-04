#!/usr/bin/env node
// project-docs/bin/setup.js
// Idempotent scaffold: prepares the HOST PROJECT to use the Project Docs app.
//   - creates docs/ (with requests/, plans/, reports/) in the project root
//   - writes the .claude/project-docs.md integration contract (refreshed each run)
//   - wires an @import into the project's root CLAUDE.md (added once)
//
// The app code lives in .project-docs/ (entirely gitignored); the contract lives in
// .claude/ (tracked) so no single folder mixes tracked + ignored content.
const fs = require('fs');
const path = require('path');
const { ROOT, DOCS_DIR, CLAUDE_DIR, ensureDirs } = require('../src/paths');

const IMPORT_LINE = '@.claude/project-docs.md';
const BEGIN = '<!-- project-docs:begin -->';
const END = '<!-- project-docs:end -->';

const CONTRACT = `# Project Docs — conventions for Claude Code

This project uses the **Project Docs** app (in \`.project-docs/\`). It surfaces six views backed by
plain files. The working pipeline is:

**the user writes a REQUEST → you write a PLAN → you IMPLEMENT it step by step → you write a REPORT.**

## Files

- \`docs/idea.md\` — the user's initial idea capture. User-editable.
- \`docs/workflow.md\` — how the app/feature should work. User-editable; you may populate it on request.
- \`docs/architecture.md\` — current architecture. **Read-only in the UI — you maintain this file.**
- \`docs/diagram.mmd\` — a Mermaid diagram of the system. **Read-only in the UI — you maintain this file.**
- \`docs/requests/\` — what the user wants built, written in the app's composer. **You read these.**
- \`docs/plans/\` — your implementation plans. **Read-only in the UI — you write these.**
- \`docs/reports/\` — your work reports. **Read-only in the UI — you write these.**

## File naming — \`YYYY-MM-DD-NN-<slug>.md\`

Every file in \`requests/\`, \`plans/\`, and \`reports/\` uses this name format. \`NN\` is a 2-digit
per-day sequence: before writing, look at the folder, find today's highest \`NN\`, and use the next
one (01 if none). This keeps same-day documents distinct and sorted newest-first in the app.

## Plans — \`docs/plans/\`

When the user asks you to **plan a request**, read the request file and write a plan with this
frontmatter:

\`\`\`
---
title: "Short descriptive title"
date: "YYYY-MM-DD"
author: "Claude Code"
request: "YYYY-MM-DD-NN-the-request-file.md"
status: "draft"
---
\`\`\`

…and exactly these sections:

1. \`## Current state\` — the relevant parts of the project as they are today.
2. \`## What this changes and why\` — the goal, the reasoning, alternatives considered.
3. \`## Step-by-step\` — the ordered implementation steps, each small enough to verify.
4. \`## Test suite\` — how to test the change after implementing (cases, commands, expected results).
5. \`## Diagrams\` — **two Mermaid diagrams: the current state and the finished state.**

When the user asks you to **implement a plan**, follow it step by step and keep its \`status\`
frontmatter current: \`draft\` → \`in-progress\` → \`implemented\`.

## Work reports — \`docs/reports/\`

**Whenever you finish a piece of work — planned or ad-hoc — write a report** before considering
the work done. Frontmatter: \`title\`, \`date\`, \`author\`, \`summary\` (one sentence), and optionally
\`request:\` / \`plan:\` referencing the files that drove the work.

The body is **long-form and educational** — the user reads reports to understand the codebase and
to practice reading. Structure it with \`##\` sections covering:

1. **What I did** — the changes, files touched, features added.
2. **Why** — your reasoning, alternatives considered, trade-offs.
3. **How the data flows** — walk through the runtime path of the code you wrote or changed,
   step by step. Include Mermaid diagrams where they help (they render in the app).

Write thoroughly; length is welcome. Never delete or rewrite existing reports, plans, or requests —
add new files.

## Populating views

- When the user captures an idea (\`docs/idea.md\`), generate \`docs/workflow.md\` **and**
  \`docs/diagram.mmd\` **together**. The first diagram should show only the general components
  (frontend / backend / database / mobile / web, etc.), then refine it as the architecture firms up.
- Keep \`docs/architecture.md\` and \`docs/diagram.mmd\` in sync with the real codebase as it changes.

There is no database. Everything is plain text under \`docs/\`. The app code lives in
\`.project-docs/\` (gitignored); this contract lives in \`.claude/project-docs.md\` (tracked).
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
  console.log('  docs/             : ' + rel(DOCS_DIR) + ' (+ requests/, plans/, reports/)');
  console.log('  contract          : ' + rel(contractPath) + (wroteContract ? ' (written)' : ' (unchanged)'));
  console.log('  root CLAUDE.md    : ' + rootStatus);
  console.log('');
  console.log('Run it:  cd .project-docs && npm install && npm start   →  http://localhost:4500');
}

main();
