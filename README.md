# Project Docs

Local, per-project documentation + task app. All four views are built:

- **Workflow** — WYSIWYG markdown editor, saved to `docs/workflow.md` (editable by you).
- **Diagram** — read-only Mermaid render of `docs/diagram.mmd` (Claude Code writes it; empty until generated).
- **Architecture** — read-only render of `docs/architecture.md` with an auto-generated table of contents (Claude Code writes it).
- **Tickets** — card grid + detail modal over `tasks/*.md`. Each ticket carries a WYSIWYG instruction body; a Todo panel (multi-line, auto-expanding) sits alongside, and todos can be promoted to tickets.

Content is **files-first** — everything lives in the host project as plain text (no database):

```
<project>/docs/idea.md           # idea capture (editable)
<project>/docs/workflow.md       # Workflow view (editable)
<project>/docs/architecture.md   # read-only in UI; Claude Code edits
<project>/docs/diagram.mmd       # read-only in UI; Claude Code edits
<project>/tasks/*.md             # ticket / implementation inbox
<project>/tasks/_todos.md        # the Todo list (the "_" keeps it out of the ticket grid)
<project>/.project-docs/CLAUDE.md # the Claude Code integration contract
```

Title defaults to the project folder name (override with `DOCS_TITLE`); port defaults to `4500`
(override with `PORT`). There is no database — everything is committable text.

## Run

```bash
cd project-docs
npm install
PROJECT_ROOT=/absolute/path/to/your/project npm start
# → http://localhost:4500
```

`PROJECT_ROOT` is where `docs/` and `tasks/` are read and written. If omitted, it defaults to the
**parent of the `project-docs` folder** — i.e. the project the app is installed inside. So when the
app lives at `<project>/project-docs/`, running `cd project-docs && npm start` uses `<project>/` as
the root. Set `PROJECT_ROOT=/abs/path` to point it anywhere else (e.g. a throwaway folder for testing).
Port defaults to `4500` (override with `PORT`).

## Behaviour

- First visit with no `docs/workflow.md` → the **idea capture** editor. Save writes `docs/idea.md`.
- Once `docs/workflow.md` exists → `/` lands on the **Workflow** editor.
- Diagram and Architecture are read-only by design; only Claude Code writes those files.

## Scaffolding into a project

`npm run setup` prepares the surrounding project (idempotent — safe to run repeatedly):

```bash
cd project-docs
npm install
npm run setup      # creates docs/, tasks/, .project-docs/CLAUDE.md; wires root CLAUDE.md
npm start          # → http://localhost:4500
```

It resolves the **project root as the parent of `project-docs/`**. To target elsewhere:
`PROJECT_ROOT=/abs/path npm run setup`.

What it does: creates `docs/` and `tasks/`, writes the `.project-docs/CLAUDE.md` integration
contract, and adds an `@.project-docs/CLAUDE.md` import to the project's root `CLAUDE.md`
(creating that file if absent, appending once if present).

## Reuse on every project

Three layers, cheapest first:

1. **GitHub template repo.** Push this folder to a repo named `project-docs` and mark it a template.
   Then in any project: `npx degit <OWNER>/project-docs project-docs && cd project-docs && npm install && npm run setup`.
2. **Claude Code skill.** `skills/docs-init/` is a ready skill — copy it into your Claude Code
   skills directory (or bundle it in a plugin). Then just tell Claude Code *"set up project docs here"*
   and it runs the scaffold. Set `PROJECT_DOCS_SRC` to a local clone path, or edit the repo `<OWNER>`
   placeholder in the skill.
3. **Global `~/.claude/CLAUDE.md`** so Claude Code knows the convention everywhere:

   ```markdown
   ## Project Docs
   If a project contains a `.project-docs/` folder, follow `.project-docs/CLAUDE.md`.
   To create one, run the `docs-init` skill (or `npx degit <OWNER>/project-docs project-docs`
   then `cd project-docs && npm install && npm run setup`).
   ```

## Claude Code integration contract

After setup, `.project-docs/CLAUDE.md` tells Claude Code: which files map to which views, that
`docs/architecture.md` + `docs/diagram.mmd` are read-only in the UI (Claude maintains them), and
that `tasks/*.md` is the implementation inbox — "work the tickets" means implement every task whose
`status` is not `done`, check off steps, and flip `status: done`.
