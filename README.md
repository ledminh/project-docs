# Project Docs

Local, per-project documentation app and a shared control surface between you and Claude Code.
The working pipeline: **you and Claude discuss on the Whiteboard → Claude writes a Plan → Claude
implements it → Claude writes a Report.**

Six views:

- **Workflow** — WYSIWYG markdown editor, saved to `docs/workflow.md` (editable by you).
- **Whiteboard** — a shared, editable thinking space (`docs/whiteboard.md`). You sketch ideas and
  questions; Claude Code edits the same file and can draw diagrams, illustrations, callouts, and math
  onto it. An **Edit ⇄ Preview** toggle renders Claude's diagrams/math. Editable by both.
- **Diagram** — read-only Mermaid render of `docs/diagram.mmd` (Claude Code writes it; empty until generated).
- **Architecture** — read-only render of `docs/architecture.md` with auto-TOC + scroll-spy (Claude Code writes it).
- **Plans** — Claude Code's implementation plans (current state, the change & why, step-by-step,
  test suite, before/after Mermaid diagrams). Read-only; `docs/plans/`.
- **Reports** — long-form work reports written when a task is finished (what/why/dataflow). Read-only; `docs/reports/`.

Content is **files-first** — everything lives in the host project as plain text (no database):

```
<project>/docs/idea.md            # idea capture (editable)
<project>/docs/workflow.md        # Workflow view (editable)
<project>/docs/whiteboard.md      # Whiteboard — shared, editable by you AND Claude Code
<project>/docs/architecture.md    # read-only in UI; Claude Code edits
<project>/docs/diagram.mmd        # read-only in UI; Claude Code edits
<project>/docs/assets/*           # images Claude Code draws onto the whiteboard (served at /assets)
<project>/docs/plans/*.md         # Claude Code's plans (read-only in UI)
<project>/docs/reports/*.md       # Claude Code's reports (read-only in UI)
<project>/.claude/project-docs.md # the Claude Code integration contract (tracked)
```

Files in `plans/` and `reports/` are named `YYYY-MM-DD-NN-slug.md` — `NN` is a per-day sequence so
same-day documents stay distinct and every list shows newest first.

`.project-docs/` is the installed app and is fully gitignored — one folder, one purpose. The
contract lives in `.claude/project-docs.md` (with your other Claude config). Title defaults to the
project folder name (override `DOCS_TITLE`); port defaults to `4500` (override `PORT`).

## Run

```bash
cd .project-docs
npm install
npm start            # → http://localhost:4500
```

`PROJECT_ROOT` is where `docs/` is read and written. If omitted, it defaults to the **folder that
contains `.project-docs/`**. Set `PROJECT_ROOT=/abs/path` to point anywhere else.

## Behaviour

- First visit with no `docs/workflow.md` → the **idea capture** editor. Save writes `docs/idea.md`.
- Once `docs/workflow.md` exists → `/` lands on the **Workflow** editor.
- Open **Whiteboard** to think alongside Claude Code: type your notes, ask it to draw diagrams or
  explain a concept onto the board, and flip to **Preview** to see it rendered. Saved to `docs/whiteboard.md`.
- Then in Claude Code: *"turn the whiteboard into a plan"* → a plan appears in **Plans**;
  *"implement the plan"* → work happens; a report appears in **Reports**.

## Scaffolding into a project

`npm run setup` prepares the surrounding project (idempotent — safe to run repeatedly):

```bash
cd .project-docs
npm install
npm run setup      # creates docs/ (+plans/reports), .claude/project-docs.md; wires root CLAUDE.md
npm start          # → http://localhost:4500
```

## Reuse on every project

1. **Skill install (one-time).** Copy the skill to your user skills dir:
   `npx degit ledminh/project-docs/skills/docs-init ~/.claude/skills/docs-init`.
   Then in any project: *"set up project docs here."*
2. **Plain one-liner:**
   `npx degit ledminh/project-docs .project-docs && cd .project-docs && npm install && npm run setup`.

Optionally add to `~/.claude/CLAUDE.md` so Claude Code recognizes the convention everywhere:

```markdown
## Project Docs
If a project contains a `.claude/project-docs.md` file, follow it.
To set this up, run the `docs-init` skill.
```

## Claude Code integration contract

After setup, `.claude/project-docs.md` tells Claude Code: which files map to which views, the
`YYYY-MM-DD-NN-slug.md` naming, how to use the whiteboard to explain things visually, how to turn a
whiteboard discussion into a plan (required sections incl. before/after diagrams and a test suite),
to implement plans step by step with status tracking, and to write a long-form what/why/dataflow
report whenever work finishes.
