---
description: Scaffold the Project Docs app (Workflow / Diagram / Architecture / Tickets) into the current project
allowed-tools: Bash, Read
---

Install and wire up the **Project Docs** app in the current working directory (the project root). Be idempotent — if it's already installed, just re-run setup and report status.

1. **Check.** If `.project-docs/package.json` already exists, skip to step 3.

2. **Fetch the app into `.project-docs/`:**
   - If `$PROJECT_DOCS_SRC` is set: `cp -R "$PROJECT_DOCS_SRC" .project-docs`
   - Otherwise: `npx degit ledminh/project-docs .project-docs`

3. **Install + scaffold:**
   ```bash
   cd .project-docs && npm install && npm run setup
   ```
   This creates `docs/` and `tasks/`, writes `.claude/project-docs.md` (the contract), and adds an `@.claude/project-docs.md` import to the project's root `CLAUDE.md`.

4. **Read the contract** at `.claude/project-docs.md` — it defines the file conventions for this project (which docs you maintain, how `tasks/*.md` work).

5. **Tell the user to run it:** `cd .project-docs && npm start` → http://localhost:4500

On a brand-new project the app opens on the idea-capture editor. Once the user saves `docs/idea.md`, offer to generate `docs/workflow.md` and `docs/diagram.mmd` together (general components first). When the user says "work the tickets", implement every `tasks/*.md` whose `status` is not `done`, check off steps, and set `status: done`.
