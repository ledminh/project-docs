// project-docs/src/server.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const { ROOT, PLANS_DIR, REPORTS_DIR, ASSETS_DIR, ensureDirs } = require('./paths');
const { readDoc } = require('./files');
const docsRouter = require('./routes/docs');
const collectionRouter = require('./routes/collection');
const diagramsRouter = require('./routes/diagrams');

ensureDirs();

const app = express();
const PORT = process.env.PORT || 4500;
const TITLE = process.env.DOCS_TITLE || path.basename(ROOT) || 'Project Docs';
const TMPL = path.join(__dirname, 'template.html');

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/assets', express.static(ASSETS_DIR));   // images Claude Code draws onto the whiteboard
app.use('/api/doc', docsRouter);
app.use('/api/plans', collectionRouter(PLANS_DIR));
app.use('/api/reports', collectionRouter(REPORTS_DIR));
app.use('/api/diagrams', diagramsRouter);

// ── Config API ───────────────────────────────────────────────────────────────
app.get('/api/config', (_req, res) => {
  res.json({ title: TITLE, port: String(PORT), root: ROOT });
});

// ── Views ─────────────────────────────────────────────────────────────────────
const VIEWS = ['workflow', 'whiteboard', 'diagram', 'architecture', 'plans', 'reports'];
function title() { return TITLE; }

// Landing: empty-state idea capture until workflow.md exists, then Workflow.
app.get('/', (_req, res) => {
  if (readDoc('workflow').exists) return res.redirect('/workflow');
  res.send(renderEditorView({
    view: 'idea', label: 'Idea', docName: 'idea', writable: true, active: null,
    heading: 'Capture your idea',
    hint: 'Describe the app or feature you’re about to build. Save it, then ask Claude Code to populate the Workflow and Diagram views.',
    afterSaveHint: 'Saved to docs/idea.md. Now ask Claude Code to populate the Workflow and Diagram views.',
    centered: true,
  }));
});

app.get('/idea', (_req, res) => {
  res.send(renderEditorView({
    view: 'idea', label: 'Idea', docName: 'idea', writable: true, active: null,
    heading: 'Idea', hint: 'Your initial idea capture (docs/idea.md).',
    afterSaveHint: 'Saved to docs/idea.md.', centered: true,
  }));
});

app.get('/workflow', (_req, res) => {
  res.send(renderEditorView({
    view: 'workflow', label: 'Workflow', docName: 'workflow', writable: true, active: 'workflow',
    heading: 'Workflow',
    hint: 'How this app / feature should work. Editable — saved to docs/workflow.md.',
    afterSaveHint: 'Saved to docs/workflow.md.', centered: false,
  }));
});

// Whiteboard — a shared, editable thinking space (docs/whiteboard.md). You and Claude Code
// both write here. Edit in WYSIWYG; flip to Preview to see Claude Code's diagrams / callouts / math.
app.get('/whiteboard', (_req, res) => {
  const content = `
  <section class="whiteboard-view" data-view="whiteboard">
    <header class="view-head wb-head">
      <div>
        <h1 class="wb-title">Whiteboard</h1>
        <p class="view-hint">Your shared thinking space with Claude Code — sketch ideas, ask it to draw diagrams and illustrations, then turn the discussion into a plan. Saved to <code>docs/whiteboard.md</code>.</p>
      </div>
      <div class="wb-tools">
        <div class="wb-toggle" role="tablist">
          <button id="wb-edit-tab" class="wb-tab is-active" type="button">✎ Edit</button>
          <button id="wb-preview-tab" class="wb-tab" type="button">◉ Preview</button>
        </div>
        <span id="save-status" class="save-status"></span>
        <button id="wb-full" class="wb-iconbtn" type="button" title="Fullscreen">⛶</button>
        <button id="save-btn" class="btn-primary">Save</button>
      </div>
    </header>
    <div class="wb-canvas">
      <div id="editor" class="wb-editor"></div>
      <div id="wb-preview" class="doc-viewer wb-preview" hidden></div>
    </div>
  </section>`;
  res.send(shell({
    viewLabel: 'Whiteboard', active: 'whiteboard', content,
    pd: { view: 'whiteboard', docName: 'whiteboard', writable: true },
    headExtra: DOC_HEAD,
  }));
});

// Architecture — read-only render of docs/architecture.md with an auto-TOC.
app.get('/architecture', (_req, res) => {
  const content = `
  <section class="doc-layout" data-view="architecture">
    <aside class="toc"><div class="toc-label">On this page</div><nav id="arch-toc"></nav></aside>
    <div class="doc-main">
      <header class="view-head">
        <h1>Architecture</h1>
        <p class="view-hint">Read-only — Claude Code maintains <code>docs/architecture.md</code>.</p>
      </header>
      <div id="arch-empty" class="empty-state" hidden>
        <p><strong>No architecture doc yet.</strong></p>
        <p>Ask Claude Code to write <code>docs/architecture.md</code> describing the system.</p>
      </div>
      <div id="viewer" class="doc-viewer"></div>
    </div>
  </section>`;
  res.send(shell({ viewLabel: 'Architecture', active: 'architecture', content, pd: { view: 'architecture', docName: 'architecture' }, headExtra: DOC_HEAD }));
});

// Diagram — read-only Mermaid render of docs/diagram.mmd (not seeded).
app.get('/diagram', (_req, res) => {
  const content = `
  <section class="diagram-view" data-view="diagram">
    <header class="view-head">
      <h1>Diagram</h1>
      <p class="view-hint">Read-only — generated by Claude Code. Click a highlighted box to drill into its detail.</p>
      <nav id="diagram-crumb" class="diagram-crumb" hidden></nav>
      <span id="diagram-mtime" class="view-meta"></span>
    </header>
    <div id="diagram-empty" class="empty-state" hidden>
      <p><strong>No diagram yet.</strong></p>
      <p>Ask Claude Code to generate one (general components first) into <code>docs/diagram.mmd</code>.</p>
    </div>
    <div id="diagram-error" class="diagram-error" hidden></div>
    <div id="diagram-render" class="diagram-render"></div>
  </section>`;
  res.send(shell({ viewLabel: 'Diagram', active: 'diagram', content, pd: { view: 'diagram', docName: 'diagram' }, headExtra: MERMAID }));
});

// ── Collections: Plans / Reports (index + reader) ────────────────────────────
const COLLECTIONS = {
  plans: {
    label: 'Plans',
    hint: 'Claude Code’s implementation plans — current state, the change &amp; why, step-by-step, test suite, and before/after diagrams. Read-only; files live in <code>docs/plans/</code>.',
    empty: `<p><strong>No plans yet.</strong></p>
            <p>Discuss on the <strong>Whiteboard</strong>, then ask Claude Code: <em>“turn the whiteboard into a plan”</em> — it writes the plan here.</p>`,
  },
  reports: {
    label: 'Reports',
    hint: 'Work reports written when a task is finished — what was done, the reasoning, and how the data flows. Read-only; files live in <code>docs/reports/</code>.',
    empty: `<p><strong>No reports yet.</strong></p>
            <p>When Claude Code finishes implementing a plan, it writes a report to <code>docs/reports/</code>.</p>`,
  },
};

for (const [view, c] of Object.entries(COLLECTIONS)) {
  app.get('/' + view, (_req, res) => {
    const content = `
  <section class="col-view" data-view="${view}">
    <header class="view-head">
      <h1>${c.label}</h1>
      <p class="view-hint">${c.hint}</p>
    </header>
    <div id="col-empty" class="empty-state" hidden>${c.empty}</div>
    <div id="col-index" class="reports-index"><p class="muted">Loading…</p></div>
  </section>

  <section class="doc-layout" id="col-reader" hidden>
    <aside class="toc"><div class="toc-label">On this page</div><nav id="arch-toc"></nav></aside>
    <div class="doc-main">
      <header class="view-head report-head">
        <a href="/${view}" class="btn-ghost report-back">← All ${view}</a>
        <div id="col-meta"></div>
      </header>
      <div id="viewer" class="doc-viewer"></div>
    </div>
  </section>`;
    res.send(shell({ viewLabel: c.label, active: view, content, pd: { view, colApi: '/api/' + view, colLabel: c.label }, headExtra: DOC_HEAD }));
  });
}

// Retired views → Whiteboard (the new collaboration surface).
['/tickets', '/requests', '/explainers'].forEach((p) =>
  app.get(p, (_req, res) => res.redirect('/whiteboard')));

// ── Page assembly ───────────────────────────────────────────────────────────
const MERMAID = `<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>`;
const KATEX = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>`;
const DOC_HEAD = MERMAID + '\n    ' + KATEX;   // doc-rendering pages (whiteboard preview, architecture, reports, …)

function navLinks(active) {
  return VIEWS.map(v => {
    const label = v[0].toUpperCase() + v.slice(1);
    const cls = v === active ? ' class="nav-active"' : '';
    return `<a href="/${v}"${cls}>${label}</a>`;
  }).join('\n      ');
}

function shell({ viewLabel, active, content, pd, headExtra = '' }) {
  const tmpl = fs.readFileSync(TMPL, 'utf8');
  return tmpl
    .replace(/\{\{TITLE\}\}/g, esc(title()))
    .replace('{{VIEW_LABEL}}', esc(viewLabel))
    .replace('{{HEAD_EXTRA}}', headExtra)
    .replace('{{NAV_LINKS}}', navLinks(active))
    .replace('{{CONTENT}}', content)
    .replace('{{RIGHT_PANEL}}', '')
    .replace('{{PD_JSON}}', JSON.stringify(pd));
}

function renderEditorView(o) {
  const content = `
  <section class="editor-view${o.centered ? ' centered' : ''}" data-view="${o.view}">
    <header class="view-head">
      <h1>${esc(o.heading)}</h1>
      <p class="view-hint">${esc(o.hint)}</p>
    </header>
    <div id="editor"></div>
    <div class="editor-actions">
      <span id="save-status" class="save-status"></span>
      <button id="save-btn" class="btn-primary">Save</button>
    </div>
  </section>`;
  return shell({
    viewLabel: o.label, active: o.active, content,
    pd: { view: o.view, docName: o.docName, writable: o.writable, afterSaveHint: o.afterSaveHint },
  });
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

app.listen(PORT, () => {
  console.log(`Project Docs → http://localhost:${PORT}`);
  console.log(`Project root  → ${ROOT}`);
});
