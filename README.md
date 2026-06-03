# Project Docs

Local, per-project documentation + task app. Five views:

- **Workflow** — WYSIWYG markdown editor, saved to `docs/workflow.md` (editable by you).
- **Diagram** — read-only Mermaid render of `docs/diagram.mmd` (Claude Code writes it; empty until generated).
- **Architecture** — read-only render of `docs/architecture.md` with an auto-generated table of contents (Claude Code writes it).
- **Tickets** — card grid + detail modal over `tasks/*.md`. Each ticket carries a WYSIWYG instruction body; a Todo panel (multi-line, auto-expanding) sits alongside, and todos can be promoted to tickets.
- **Reports** — read-only index + reader over `docs/reports/*.md`: long-form work reports written by AIs when they finish a task (what/why/dataflow, mermaid supported).

Content is **files-first** — everything lives in the host project as plain text (no database):

```
<project>/docs/idea.md           # idea capture (editable)
<project>/docs/workflow.md       # Workflow view (editable)
<project>/docs/architecture.md   # read-only in UI; Claude Code edits
<project>/docs/diagram.mmd       # read-only in UI; Claude Code edits
<project>/tasks/*.md             # ticket / implementation inbox
<project>/tasks/_todos.md        # the Todo list (the "_" keeps it out of the ticket grid)
<project>/docs/reports/*.md      # AI work reports (read-only in UI; AIs write them)
<project>/.project-docs/         # the installed app code (its own repo; entirely gitignored)
<project>/.claude/project-docs.md # the Claude Code integration contract (tracked)
```

`.project-docs/` is the installed tool and is fully gitignored — one folder, one purpose. The
contract lives in `.claude/project-docs.md` (with your other Claude config), so no folder mixes
tracked and ignored content. The visible project tree stays clean — your code plus `docs/` and `tasks/`.

Title defaults to the project folder name (override with `DOCS_TITLE`); port defaults to `4500`
(override with `PORT`). There is no database — everything is committable text.

## Run

```bash
cd .project-docs
npm install
npm start            # → http://localhost:4500
```

`PROJECT_ROOT` is where `docs/` and `tasks/` are read and written. If omitted, it defaults to the
**folder that contains `.project-docs/`** — i.e. the project the app is installed inside. So when the
app lives at `<project>/.project-docs/`, running `cd .project-docs && npm start` uses `<project>/`
as the root. Set `PROJECT_ROOT=/abs/path` to point it anywhere else (e.g. a throwaway folder for
testing). Port defaults to `4500` (override with `PORT`).

## Behaviour

- First visit with no `docs/workflow.md` → the **idea capture** editor. Save writes `docs/idea.md`.
- Once `docs/workflow.md` exists → `/` lands on the **Workflow** editor.
- Diagram and Architecture are read-only by design; only Claude Code writes those files.

## Scaffolding into a project

`npm run setup` prepares the surrounding project (idempotent — safe to run repeatedly):

```bash
cd .project-docs
npm install
npm run setup      # creates docs/, tasks/, .claude/project-docs.md; wires root CLAUDE.md
npm start          # → http://localhost:4500
```

It resolves the **project root as the folder containing `.project-docs/`**. To target elsewhere:
`PROJECT_ROOT=/abs/path npm run setup`.

What it does: creates `docs/` and `tasks/`, writes the `.claude/project-docs.md` integration
contract, and adds an `@.claude/project-docs.md` import to the project's root `CLAUDE.md`
(creating that file if absent, appending once if present).

## Reuse on every project

Pick whichever fits; the plugin is the nicest.

1. **Claude Code plugin (recommended).** This repo is also a one-plugin marketplace, so you install
   once and get the `/docs-init` slash command plus the `docs-init` skill in every project:

   ```text
   /plugin marketplace add ledminh/project-docs
   /plugin install project-docs@ledminh
   ```

   Then in any project just run `/docs-init` (or say *"set up project docs here"*). To update later:
   `/plugin marketplace update` then reinstall.

2. **Manual skill install.** Copy just the skill to your user skills dir:
   `npx degit ledminh/project-docs/skills/docs-init ~/.claude/skills/docs-init`.

3. **No Claude at all.** Plain one-liner in any project:
   `npx degit ledminh/project-docs .project-docs && cd .project-docs && npm install && npm run setup`.

Optionally add to `~/.claude/CLAUDE.md` so Claude Code recognizes the convention everywhere:

```markdown
## Project Docs
If a project contains a `.claude/project-docs.md` file, follow it.
To set this up, run the `/docs-init` command (or the `docs-init` skill).
```

## Claude Code integration contract

After setup, `.claude/project-docs.md` tells Claude Code: which files map to which views, that
`docs/architecture.md` + `docs/diagram.mmd` are read-only in the UI (Claude maintains them), and
that `tasks/*.md` is the implementation inbox — "work the tickets" means implement every task whose
`status` is not `done`, check off steps, and flip `status: done`.
