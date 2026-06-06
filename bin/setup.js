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

**you and the user discuss on the WHITEBOARD → you turn it into a PLAN → you IMPLEMENT it step by step → you write a REPORT.**

## Files

- \`docs/idea.md\` — the user's initial idea capture. User-editable.
- \`docs/workflow.md\` — how the app/feature should work. User-editable; you may populate it on request.
- \`docs/whiteboard.md\` — the **shared thinking space**. Both you and the user edit it. **See below.**
- \`docs/architecture.md\` — current architecture. **Read-only in the UI — you maintain this file.**
- \`docs/diagram.mmd\` — the system overview Mermaid diagram. **Read-only in the UI — you maintain it.**
- \`docs/diagrams/<node-id>.mmd\` — optional **detail** diagrams (drill-down). A node becomes clickable
  automatically when a file's name **exactly matches that node's id** — no extra directives. Example:
  a node \`backend\` in \`diagram.mmd\` → write \`docs/diagrams/backend.mmd\`.
  **Nesting is unlimited and works the same way at every level**: a node inside \`backend.mmd\` (say id
  \`routes\`) drills in when \`docs/diagrams/routes.mmd\` exists. To avoid name clashes across branches,
  namespace deeper ids like \`backend-routes\` (node id) ↔ \`backend-routes.mmd\`. The app shows a
  breadcrumb (\`Overview › Backend › Routes\`). Keep depth shallow (1–2 levels) unless deeper truly helps;
  keep every detail diagram accurate to the code. **Prefer structural "what contains what" diagrams**
  (components, modules, files, fields) — the user reads these as a reference map of the codebase, not a
  trace. Use sequence/behavioral diagrams sparingly, only when the runtime flow itself is the point.
- \`docs/plans/\` — your implementation plans. **Read-only in the UI — you write these.**
- \`docs/reports/\` — your work reports. **Read-only in the UI — you write these.**

## Whiteboard — \`docs/whiteboard.md\`

This is where you and the user think together before any plan exists. The user sketches notes and
questions in the app (WYSIWYG); you edit the same file. The view has an **Edit ⇄ Preview** toggle —
Preview renders your diagrams, callouts, and math, so it's the place to **explain difficult concepts
visually** instead of dumping a wall of text in the chat. When the user asks you to explain, illustrate,
or sketch something, write it onto the whiteboard and tell them to open Preview. You can use:

- **Mermaid diagrams** wherever a picture helps (they render + pan/zoom in Preview). Your main tool.
- **Callouts** for key points: \`> [!NOTE]\`, \`> [!TIP]\`, \`> [!WARNING]\`, \`> [!IMPORTANT]\`, \`> [!CAUTION]\`.
- **Math** with KaTeX: inline \`$…$\` and display \`\`\`math fenced blocks.
- **Images** via \`![alt](assets/<file>)\` — drop the file in \`docs/assets/\` (served at \`/assets\`).
- Headings, short sections, tables, and code blocks.

The whiteboard is a living scratchpad — it's fine to clear or rewrite it as the discussion moves on.
When the discussion has settled, the user will ask you to **turn the whiteboard into a plan**.

## File naming — \`YYYY-MM-DD-NN-<slug>.md\`

Every file in \`plans/\` and \`reports/\` uses this name format. \`NN\` is a 2-digit per-day sequence:
before writing, look at the folder, find today's highest \`NN\`, and use the next one (01 if none).
This keeps same-day documents distinct and sorted newest-first in the app.

## Plans — \`docs/plans/\`

When the user asks you to **turn the whiteboard discussion into a plan**, write a plan with this
frontmatter:

\`\`\`
---
title: "Short descriptive title"
date: "YYYY-MM-DD"
author: "Claude Code"
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
\`plan:\` referencing the plan that drove the work.

The body is **long-form and educational** — the user reads reports to understand the codebase and
to practice reading. Structure it with \`##\` sections covering:

1. **What I did** — the changes, files touched, features added.
2. **Why** — your reasoning, alternatives considered, trade-offs.
3. **How the data flows** — walk through the runtime path of the code you wrote or changed,
   step by step. Include Mermaid diagrams where they help (they render in the app).

Write thoroughly; length is welcome. Never delete or rewrite existing reports or plans — add new
files. (The whiteboard is the one exception: it's a scratchpad and may be rewritten freely.)

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
  console.log('  docs/             : ' + rel(DOCS_DIR) + ' (+ plans/, reports/)');
  console.log('  contract          : ' + rel(contractPath) + (wroteContract ? ' (written)' : ' (unchanged)'));
  console.log('  root CLAUDE.md    : ' + rootStatus);
  console.log('');
  console.log('Run it:  cd .project-docs && npm install && npm start   →  http://localhost:4500');
}

main();
