// project-docs/public/app.js
(function () {
  const PD = window.PD || {};
  const view = PD.view;

  // helpers ---------------------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function slugify(s) {
    return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'h';
  }
  async function api(method, path, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch(path, opts);
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  }

  // global bits ------------------------------------------------------------------
  initComposer();
  initReadingProgress();

  // per-view ----------------------------------------------------------------------
  if (view === 'idea' || view === 'workflow') initEditor();
  else if (view === 'architecture') initArchitecture();
  else if (view === 'diagram') initDiagram();
  else if (view === 'requests' || view === 'plans' || view === 'reports') initCollection();

  // ── Request composer (global, wide slide-in panel) ───────────────────────────
  function initComposer() {
    const panel = document.getElementById('composer');
    if (!panel) return;
    const openBtn = document.getElementById('composer-open');
    const statusEl = document.getElementById('composer-status');
    let editor = null;

    openBtn.addEventListener('click', () => {
      document.body.classList.add('composer-open');
      if (!editor) {
        editor = new toastui.Editor({
          el: document.getElementById('composer-editor'),
          height: '100%', initialEditType: 'wysiwyg', previewStyle: 'tab',
          placeholder: 'What do you want built or changed? Brainstorm freely…',
          usageStatistics: false,
        });
      }
      setTimeout(() => editor.focus(), 60);
    });
    document.getElementById('composer-close').addEventListener('click', () =>
      document.body.classList.remove('composer-open'));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.body.classList.contains('composer-open')) {
        document.body.classList.remove('composer-open');
      }
    });

    document.getElementById('composer-save').addEventListener('click', async () => {
      if (!editor) return;
      const content = editor.getMarkdown().trim();
      if (!content) { msg('Nothing to save yet.', true); return; }
      msg('Saving…');
      try {
        const created = await api('POST', '/api/requests', { content });
        msg('Saved as docs/requests/' + created.file);
        editor.setMarkdown('');
        if (view === 'requests' && window.__reloadCollection) window.__reloadCollection();
      } catch (e) { msg('Error: ' + e.message, true); }
    });

    function msg(m, err) {
      statusEl.textContent = m;
      statusEl.classList.toggle('is-error', !!err);
      if (!err) setTimeout(() => { statusEl.textContent = ''; }, 6000);
    }
  }

  // Thin progress bar under the nav that fills as you scroll.
  function initReadingProgress() {
    const bar = document.getElementById('read-progress');
    if (!bar) return;
    const update = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  // ── Editable doc (idea / workflow) ───────────────────────────────────────────
  async function initEditor() {
    const editorEl = document.getElementById('editor');
    if (!editorEl) return;
    const saveBtn = document.getElementById('save-btn');
    const statusEl = document.getElementById('save-status');
    let initial = '';
    try { const d = await api('GET', '/api/doc/' + PD.docName); initial = d.content || ''; } catch (_) {}

    const editor = new toastui.Editor({
      el: editorEl, height: 'auto', minHeight: '60vh',
      initialEditType: 'wysiwyg', previewStyle: 'vertical',
      initialValue: initial, usageStatistics: false,
    });

    function setStatus(msg, err) {
      if (!statusEl) return;
      statusEl.textContent = msg; statusEl.classList.toggle('is-error', !!err);
      if (!err) setTimeout(() => { statusEl.textContent = ''; }, 4000);
    }
    async function save() {
      if (!PD.writable) return;
      setStatus('Saving…');
      try { await api('PUT', '/api/doc/' + PD.docName, { content: editor.getMarkdown() }); setStatus(PD.afterSaveHint || 'Saved.'); }
      catch (e) { setStatus('Error: ' + e.message, true); }
    }
    if (saveBtn) saveBtn.addEventListener('click', save);
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    });
  }

  // ── Architecture (read-only render + auto-TOC) ───────────────────────────────
  async function initArchitecture() {
    const viewerEl = document.getElementById('viewer');
    const empty = document.getElementById('arch-empty');
    let d = { exists: false, content: '' };
    try { d = await api('GET', '/api/doc/architecture'); } catch (_) {}
    if (!d.exists || !d.content.trim()) { empty.hidden = false; viewerEl.hidden = true; return; }
    renderDoc(viewerEl, d.content);
  }

  // Shared read-only document renderer: TOC, scroll-spy, anchors, mermaid, badges, reveal.
  function renderDoc(viewerEl, markdown) {
    const docEl = viewerEl.closest('.doc-viewer');
    const animate = docEl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (animate) docEl.classList.add('reveal-on');
    toastui.Editor.factory({ el: viewerEl, viewer: true, initialValue: markdown });
    requestAnimationFrame(async () => {
      buildToc(viewerEl);
      addHeadingAnchors(viewerEl);
      setupTocSpy(viewerEl);
      badgeStatuses(viewerEl);
      await renderArchMermaid(viewerEl);
      if (animate) setupReveal(viewerEl);
    });
  }

  // ── Collections: Requests / Plans / Reports (index + reader) ─────────────────
  function initCollection() {
    const file = new URLSearchParams(location.search).get('r');
    if (file) { openDoc(file); return; }
    loadIndex();
    window.__reloadCollection = loadIndex;

    function chips(t) {
      let html = '';
      if (t.status) html += `<span class="status-chip status-${esc(t.status)}">${esc(t.status)}</span>`;
      if (t.ticket) html += `<span class="status-chip status-open">ticket ${esc(t.ticket)}</span>`;
      if (t.request) html += `<span class="status-chip status-open">request ${esc(t.request)}</span>`;
      return html;
    }

    async function loadIndex() {
      let items = [];
      try { items = await api('GET', PD.colApi); } catch (_) {}
      const grid = document.getElementById('col-index');
      if (!items.length) {
        grid.innerHTML = '';
        document.getElementById('col-empty').hidden = false;
        return;
      }
      document.getElementById('col-empty').hidden = true;
      grid.innerHTML = items.map(t => `
        <a class="report-card" href="/${esc(view)}?r=${encodeURIComponent(t.file)}">
          <div class="report-card-top">
            <span class="report-title">${esc(t.title)}</span>
            <span class="report-chips">${chips(t)}</span>
          </div>
          <div class="report-summary">${esc(t.summary)}</div>
          <div class="report-meta-row"><span>${esc(t.date)}</span>${t.author ? `<span>· ${esc(t.author)}</span>` : ''}</div>
        </a>`).join('');
    }

    async function openDoc(name) {
      document.querySelector('.col-view').hidden = true;
      document.getElementById('col-reader').hidden = false;
      const viewerEl = document.getElementById('viewer');
      let d = null;
      try { d = await api('GET', PD.colApi + '/' + encodeURIComponent(name)); } catch (_) {}
      if (!d) {
        document.getElementById('col-meta').innerHTML = '<h1 class="report-title-big">Not found</h1>';
        return;
      }
      document.title = d.title + ' — ' + (PD.colLabel || 'Documents');
      const refs = [d.date, d.author, d.status, d.ticket && ('ticket ' + d.ticket), d.request && ('request ' + d.request)]
        .filter(Boolean).map(esc).join(' · ');
      document.getElementById('col-meta').innerHTML = `
        <h1 class="report-title-big">${esc(d.title)}</h1>
        <p class="view-hint">${refs}</p>`;
      renderDoc(viewerEl, d.body);
    }
  }

  // Highlight the TOC entry whose section is currently near the top of the viewport.
  function setupTocSpy(root) {
    const links = new Map();
    document.querySelectorAll('#arch-toc a').forEach(a => links.set(a.getAttribute('href').slice(1), a));
    const heads = [...root.querySelectorAll('h1, h2, h3')];
    if (!heads.length || !links.size) return;
    const tocEl = document.querySelector('.doc-layout .toc');
    const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 48;
    const visible = new Set();
    let activeId = null;
    function setActive(id) {
      if (id === activeId) return;
      activeId = id;
      links.forEach(a => a.classList.remove('active'));
      const a = links.get(id);
      if (!a) return;
      a.classList.add('active');
      if (tocEl) {
        const ar = a.getBoundingClientRect(), tr = tocEl.getBoundingClientRect();
        if (ar.top < tr.top || ar.bottom > tr.bottom) a.scrollIntoView({ block: 'nearest' });
      }
    }
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target);
      }
      if (visible.size) {
        const top = [...visible].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
        setActive(top.id);
      }
    }, { rootMargin: `-${navH + 8}px 0px -65% 0px`, threshold: 0 });
    heads.forEach(h => obs.observe(h));
  }

  function buildToc(viewerEl) {
    const toc = document.getElementById('arch-toc');
    const heads = viewerEl.querySelectorAll('h1, h2, h3');
    if (!heads.length) { toc.innerHTML = '<span class="rp-empty">No headings</span>'; return; }
    let html = '';
    // Stable, index-independent ids: slug of the heading text, deduped on collision.
    // An index-based id (sec-N-…) shifts whenever a heading is added or removed above
    // the target, silently breaking every cross-link (e.g. from a What's New section).
    const _seen = new Map();
    heads.forEach((h) => {
      const base = slugify(h.textContent);
      const n = _seen.get(base) || 0;
      _seen.set(base, n + 1);
      const id = n ? `${base}-${n}` : base;
      h.id = id;
      html += `<a class="toc-${h.tagName.toLowerCase()}" href="#${id}">${esc(h.textContent)}</a>`;
    });
    toc.innerHTML = html;
  }

  // Hover-to-copy "#" anchors on section headings.
  function addHeadingAnchors(root) {
    root.querySelectorAll('h2[id], h3[id]').forEach((h) => {
      const a = document.createElement('a');
      a.className = 'head-anchor'; a.href = '#' + h.id; a.textContent = '#';
      a.title = 'Copy link to this section';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        history.replaceState(null, '', location.pathname + location.search + '#' + h.id);
        if (navigator.clipboard) navigator.clipboard.writeText(location.href).catch(() => {});
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      h.prepend(a);
    });
  }

  // Gentle fade-and-rise as blocks scroll into view (only when motion is allowed).
  function setupReveal(viewerEl) {
    const contents = viewerEl.querySelector('.toastui-editor-contents') || viewerEl;
    const items = [...contents.children];
    if (!items.length) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('revealed'); obs.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    items.forEach((el) => obs.observe(el));
    // safety net: never leave content hidden, even if observation misfires
    setTimeout(() => items.forEach((el) => el.classList.add('revealed')), 2500);
  }

  // ── Diagram (read-only Mermaid) ──────────────────────────────────────────────
  async function initDiagram() {
    const empty = document.getElementById('diagram-empty');
    const render = document.getElementById('diagram-render');
    const errEl = document.getElementById('diagram-error');
    const mtimeEl = document.getElementById('diagram-mtime');
    let d = { exists: false, content: '' };
    try { d = await api('GET', '/api/doc/diagram'); } catch (_) {}
    if (!d.exists || !d.content.trim()) { empty.hidden = false; return; }
    if (d.mtime && mtimeEl) mtimeEl.textContent = 'Last updated: ' + new Date(d.mtime).toLocaleString();
    try {
      mermaid.initialize({
        startOnLoad: false, theme: 'base',
        themeVariables: { primaryColor: '#d7f0e3', primaryTextColor: '#0c3b2c', primaryBorderColor: '#1f8a70', lineColor: '#1f8a70' },
        flowchart: { curve: 'basis', useMaxWidth: true },
      });
      const { svg } = await mermaid.render('pd-diagram-svg', d.content.trim());
      render.innerHTML = svg;
    } catch (e) {
      errEl.hidden = false;
      errEl.textContent = 'Diagram failed to render: ' + (e && e.message ? e.message : e);
    }
  }

  // Turn ```mermaid code blocks rendered by the viewer into actual SVG diagrams.
  async function renderArchMermaid(root) {
    if (typeof mermaid === 'undefined') return;
    const isMermaid = (c) =>
      /(?:^|\s)lang(?:uage)?-mermaid(?:\s|$)/.test(c.className) ||
      /^\s*(?:flowchart|graph|sequenceDiagram|erDiagram|classDiagram|stateDiagram|gantt|pie|journey|mindmap|gitGraph)\b/.test(c.textContent);
    const blocks = [...root.querySelectorAll('pre code')].filter(isMermaid);
    if (!blocks.length) return;
    mermaid.initialize({
      startOnLoad: false, theme: 'base', securityLevel: 'loose',
      themeVariables: { primaryColor: '#d7f0e3', primaryTextColor: '#0c3b2c', primaryBorderColor: '#1f8a70', lineColor: '#1f8a70', fontSize: '14px' },
      flowchart: { curve: 'basis', useMaxWidth: true }, sequence: { useMaxWidth: true }, er: { useMaxWidth: true },
    });
    let i = 0;
    for (const code of blocks) {
      const pre = code.closest('pre');
      try {
        const { svg } = await mermaid.render('arch-mmd-' + (i++), code.textContent.trim());
        const fig = document.createElement('figure');
        fig.className = 'mermaid-figure revealed';   // already visible; never gets stuck hidden by reveal
        fig.innerHTML = svg;
        pre.replaceWith(fig);
      } catch (_) { /* leave as code on parse error */ }
    }
  }

  // Color-code status words (built / scaffold / planned …) in tables, like the original legend.
  function badgeStatuses(root) {
    const map = { built: 'built', working: 'built', done: 'built', scaffold: 'scaffold', scaffolded: 'scaffold', planned: 'planned', 'not wired': 'planned', partial: 'partial', wip: 'partial' };
    root.querySelectorAll('td').forEach((el) => {
      if (el.children.length) return;
      const key = el.textContent.trim().toLowerCase();
      if (map[key]) el.innerHTML = `<span class="badge badge-${map[key]}">${esc(el.textContent.trim())}</span>`;
    });
  }
})();
