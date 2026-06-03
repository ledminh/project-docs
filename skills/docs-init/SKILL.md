---
name: docs-init
description: Scaffold the Project Docs app (Workflow / Diagram / Architecture / Tickets views) into the current project. Use when the user wants to set up project documentation tooling in a new or existing project folder, or says things like "install the docs app here" or "set up project docs".
---

# Initialize the Project Docs app in this project

Goal: drop the Project Docs app into the **current working directory** (the project root), wire it up, and tell the user how to run it. The app lives in a single hidden `.project-docs/` folder so it doesn't clutter the project. Be idempotent — if it's already installed, just re-run setup and report status.

## Steps

1. **Check if it already exists.** If `.project-docs/package.json` is already present, skip to step 3.

2. **Fetch the app into `.project-docs/`.** Use whichever source applies:
   - If the env var `PROJECT_DOCS_SRC` is set, copy from that local path:
     `cp -R "$PROJECT_DOCS_SRC" .project-docs`
   - Otherwise clone the published repo:
     `npx degit ledminh/project-docs .project-docs`

3. **Install and scaffold:**

   ```bash
   cd .project-docs
   npm install
   npm run setup     # creates docs/, tasks/, .claude/project-docs.md and wires root CLAUDE.md
   ```

   `npm run setup` resolves the **project root as the folder containing `.project-docs/`** by default. To target a different folder, run it with `PROJECT_ROOT=/abs/path npm run setup`.

4. **Read the contract.** After setup, read `.claude/project-docs.md` — it defines the file conventions you must follow in this project (which docs you maintain, and how `tasks/*.md` work).

5. **Tell the user how to run it:**
   ```bash
   cd .project-docs && npm start    # → http://localhost:4500
   ```
   On a brand-new project the app opens on the **idea capture** editor. Once the user saves an idea, offer to generate `docs/workflow.md` and `docs/diagram.mmd` together (general components first).

## Notes
- `.project-docs/` is the installed app and is entirely gitignored. The contract lives in `.claude/project-docs.md` (tracked) so no folder mixes tracked + ignored content.
- The app is files-first: project content is plain text in `docs/` and `tasks/` — no database. Todos are `tasks/_todos.md`.
- `docs/architecture.md` and `docs/diagram.mmd` are read-only in the UI — you maintain those files. `docs/workflow.md` and `docs/idea.md` are user-editable.
- The implementation inbox is `tasks/*.md`. When the user says "work the tickets", implement every task whose `status` is not `done`.
