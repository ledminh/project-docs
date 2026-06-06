# Project Docs

Local, per-project documentation app and a shared control surface between you and Claude Code.
The working pipeline: **you write a Request → Claude writes a Plan → Claude implements it → Claude
writes a Report.**

Seven views:

- **Workflow** — WYSIWYG markdown editor, saved to `docs/workflow.md` (editable by you).
- **Diagram** — read-only Mermaid render of `docs/diagram.mmd` (Claude Code writes it; empty until generated).
- **Architecture** — read-only render of `docs/architecture.md` with auto-TOC + scroll-spy (Claude Code writes it).
- **Explainers** — rich, illustrated explanations Claude Code writes when a concept is too complex
  for the chat window: Mermaid diagrams, GitHub-style callouts, and KaTeX math. Read-only; `docs/explainers/`.
- **Requests** — what you want built. Written in the global **✎ New request** composer (a wide
  slide-in panel available on every view), saved to `docs/requests/`.
- **Plans** — Claude Code's implementation plans (current state, the change & why, step-by-step,
  test suite, before/after Mermaid diagrams). Read-only; `docs/plans/`.
- **Reports** — long-form work reports written when a task is finished (what/why/dataflow). Read-only; `docs/reports/`.

Content is **files-first** — everything lives in the host project as plain text (no database):

```
<project>/docs/idea.md            # idea capture (editable)
<project>/docs/workflow.md        # Workflow view (editable)
<project>/docs/architecture.md    # read-only in UI; Claude Code edits
<project>/docs/diagram.mmd        # read-only in UI; Claude Code edits
<project>/docs/explainers/*.md    # Claude Code's illustrated explainers (read-only in UI)
<project>/docs/assets/*           # images referenced by explainers (served at /assets)
<project>/docs/requests/*.md      # your requests (composer writes these)
<project>/docs/plans/*.md         # Claude Code's plans (read-only in UI)
<project>/docs/reports/*.md       # Claude Code's reports (read-only in UI)
<project>/.claude/project-docs.md # the Claude Code integration contract (tracked)
```

Files in `requests/`, `plans/`, `reports/`, and `explainers/` are named `YYYY-MM-DD-NN-slug.md` —
`NN` is a per-day sequence so same-day documents stay distinct and every list shows newest first.

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
- The **✎ New request** button (bottom right, every view) opens the composer — a ~1/3-screen
  WYSIWYG panel. Save creates `docs/requests/YYYY-MM-DD-NN-slug.md` (title taken from your first
  heading or line).
- Then in Claude Code: *"draft a plan for the latest request"* → a plan appears in **Plans**;
  *"implement the plan"* → work happens; a report appears in **Reports**.

## Scaffolding into a project

`npm run setup` prepares the surrounding project (idempotent — safe to run repeatedly):

```bash
cd .project-docs
npm install
npm run setup      # creates docs/ (+requests/plans/reports), .claude/project-docs.md; wires root CLAUDE.md
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
`YYYY-MM-DD-NN-slug.md` naming, how to turn a request into a plan (required sections incl.
before/after diagrams and a test suite), to implement plans step by step with status tracking,
and to write a long-form what/why/dataflow report whenever work finishes.
