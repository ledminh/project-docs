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
  else if (view === 'whiteboard') initWhiteboard();
  else if (view === 'architecture') initArchitecture();
  else if (view === 'diagram') initDiagram();
  else if (view === 'plans' || view === 'reports') initCollection();

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

  // ── Whiteboard (shared editable space; Edit ⇄ Preview) ───────────────────────
  async function initWhiteboard() {
    const editorEl = document.getElementById('editor');
    const previewEl = document.getElementById('wb-preview');
    if (!editorEl) return;
    const saveBtn = document.getElementById('save-btn');
    const statusEl = document.getElementById('save-status');
    const editTab = document.getElementById('wb-edit-tab');
    const previewTab = document.getElementById('wb-preview-tab');

    let initial = '';
    try { const d = await api('GET', '/api/doc/whiteboard'); initial = d.content || ''; } catch (_) {}

    const editor = new toastui.Editor({
      el: editorEl, height: 'auto', minHeight: '64vh',
      initialEditType: 'wysiwyg', previewStyle: 'vertical',
      initialValue: initial, usageStatistics: false,
      placeholder: 'Sketch your thinking here — notes, questions, sketches. Ask Claude Code to draw diagrams and illustrations onto the board, then turn it into a plan.',
    });

    function setStatus(m, err) {
      if (!statusEl) return;
      statusEl.textContent = m; statusEl.classList.toggle('is-error', !!err);
      if (!err) setTimeout(() => { statusEl.textContent = ''; }, 4000);
    }
    async function save() {
      setStatus('Saving…');
      try { await api('PUT', '/api/doc/whiteboard', { content: editor.getMarkdown() }); setStatus('Saved to docs/whiteboard.md.'); }
      catch (e) { setStatus('Error: ' + e.message, true); }
    }
    if (saveBtn) saveBtn.addEventListener('click', save);
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
    });

    function showEdit() {
      editTab.classList.add('is-active'); previewTab.classList.remove('is-active');
      previewEl.hidden = true; editorEl.hidden = false;
    }
    function showPreview() {
      previewTab.classList.add('is-active'); editTab.classList.remove('is-active');
      editorEl.hidden = true; previewEl.hidden = false;
      previewEl.innerHTML = '';                       // re-render fresh each time
      const md = editor.getMarkdown().trim();
      if (!md) { previewEl.innerHTML = '<p class="muted wb-preview-empty">Nothing on the board yet — switch to Edit and start sketching.</p>'; return; }
      const inner = document.createElement('div');
      previewEl.appendChild(inner);
      renderDoc(inner, md);
    }
    if (editTab) editTab.addEventListener('click', showEdit);
    if (previewTab) previewTab.addEventListener('click', showPreview);

    // Land on Preview when the board already has content — that's where diagrams, callouts and
    // math render, so you see Claude Code's drawings right away. Start in Edit on an empty board.
    if (initial.trim()) showPreview(); else showEdit();

    // Fullscreen the whole view (keeps the toolbar reachable inside fullscreen).
    const fullBtn = document.getElementById('wb-full');
    const wbView = document.querySelector('.whiteboard-view');
    if (fullBtn && wbView) {
      fullBtn.addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else wbView.requestFullscreen?.();
      });
      document.addEventListener('fullscreenchange', () => {
        const on = document.fullscreenElement === wbView;
        fullBtn.textContent = on ? '⤡' : '⛶';
        fullBtn.title = on ? 'Exit fullscreen' : 'Fullscreen';
      });
    }
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
      styleCallouts(viewerEl);
      renderMath(viewerEl);
      await renderArchMermaid(viewerEl);
      if (animate) setupReveal(viewerEl);
    });
  }

  // GitHub-style callouts: `> [!NOTE] / [!TIP] / [!WARNING] / [!IMPORTANT] / [!CAUTION]`
  function styleCallouts(root) {
    const types = ['note', 'tip', 'warning', 'important', 'caution'];
    root.querySelectorAll('blockquote').forEach((bq) => {
      const m = (bq.textContent || '').match(/^\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]/i);
      if (!m) return;
      const type = m[1].toLowerCase();
      bq.classList.add('callout', 'callout-' + type);
      const first = bq.querySelector('p') || bq;
      first.innerHTML = first.innerHTML.replace(/\[!(?:NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]\s*(<br\s*\/?>)?/i, '');
      const title = document.createElement('div');
      title.className = 'callout-title';
      title.textContent = type.toUpperCase();
      bq.insertBefore(title, bq.firstChild);
    });
  }

  // KaTeX math: ```math fenced blocks (display) and inline $…$
  function renderMath(root) {
    if (typeof katex === 'undefined') return;
    // Toast UI renders ```math as <pre class="lang-math"><code data-language="math">…</code></pre>
    // (the language class sits on the <pre>, not the <code>).
    root.querySelectorAll('pre.lang-math, pre.language-math, pre code[data-language="math"]').forEach((el) => {
      const pre = el.tagName === 'PRE' ? el : el.closest('pre');
      if (!pre || !pre.isConnected) return;
      const code = pre.querySelector('code') || pre;
      const div = document.createElement('div');
      div.className = 'math-block';
      try { katex.render(code.textContent.trim(), div, { displayMode: true, throwOnError: false }); pre.replaceWith(div); } catch (_) {}
    });
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && n.parentElement.closest('pre, code, .katex, .math-block'))
        ? NodeFilter.FILTER_REJECT
        : (/\$[^$\n]+\$/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    const targets = []; let n;
    while ((n = walker.nextNode())) targets.push(n);
    targets.forEach((node) => {
      const frag = document.createDocumentFragment();
      const s = node.nodeValue; const re = /\$([^$\n]+)\$/g; let last = 0, m;
      while ((m = re.exec(s))) {
        if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
        const span = document.createElement('span');
        try { katex.render(m[1], span, { throwOnError: false }); } catch (_) { span.textContent = m[0]; }
        frag.appendChild(span); last = re.lastIndex;
      }
      if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
      node.parentNode.replaceChild(frag, node);
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
      const refs = [d.date, d.author, d.status]
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
    if (!toc) return;
    const heads = viewerEl.querySelectorAll('h1, h2, h3');
    if (!heads.length) { toc.innerHTML = '<span class="rp-empty">No headings</span>'; return; }
    let html = '';
    // Stable, index-independent ids: slug of the heading text, deduped on collision.
    // An index-based id (sec-N-…) shifts whenever a heading is added or removed above
    // the target, silently breaking every cross-link (e.g. from the What's New section).
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

  // ── Diagram (read-only Mermaid, with click-to-drill-down) ────────────────────
  async function initDiagram() {
    const empty = document.getElementById('diagram-empty');
    const errEl = document.getElementById('diagram-error');
    const mtimeEl = document.getElementById('diagram-mtime');
    const crumb = document.getElementById('diagram-crumb');
    let d = { exists: false, content: '' };
    try { d = await api('GET', '/api/doc/diagram'); } catch (_) {}
    if (!d.exists || !d.content.trim()) { empty.hidden = false; return; }
    if (d.mtime && mtimeEl) mtimeEl.textContent = 'Last updated: ' + new Date(d.mtime).toLocaleString();

    let manifest = [];
    try { manifest = await api('GET', '/api/diagrams'); } catch (_) {}

    mermaid.initialize({
      startOnLoad: false, theme: 'base', securityLevel: 'loose',
      themeVariables: { primaryColor: '#d7f0e3', primaryTextColor: '#0c3b2c', primaryBorderColor: '#1f8a70', lineColor: '#1f8a70' },
      flowchart: { curve: 'basis', useMaxWidth: true }, er: { useMaxWidth: true },
    });

    const stack = [{ name: null, label: 'Overview', content: d.content }];
    let rid = 0;

    function freshHost() {
      const fresh = document.createElement('div');
      fresh.id = 'diagram-render'; fresh.className = 'diagram-render';
      document.getElementById('diagram-render').replaceWith(fresh);
      return fresh;
    }
    async function contentFor(top) {
      if (top.content != null) return top.content;
      const res = await fetch('/api/diagrams/' + encodeURIComponent(top.name));
      if (!res.ok) throw new Error('detail not found');
      return res.text();
    }
    async function show() {
      const top = stack[stack.length - 1];
      const renderId = 'pd-d-' + (++rid);
      let svg;
      try {
        const content = await contentFor(top);
        ({ svg } = await mermaid.render(renderId, content.trim()));
      } catch (e) {
        errEl.hidden = false; errEl.textContent = 'Diagram failed to render: ' + (e && e.message ? e.message : e);
        return;
      }
      errEl.hidden = true;
      const host = freshHost();
      host.innerHTML = svg;
      makeInteractive(host);
      markClickable(host, manifest, drillTo, renderId);
      host.classList.add('entering');
      setTimeout(() => host.classList.remove('entering'), 320);
      renderCrumb();
    }
    function drillTo(name) {
      if (!name || name === stack[stack.length - 1].name) return;
      if (manifest.length && !manifest.includes(name)) return;   // no detail file → ignore
      stack.push({ name, label: name.charAt(0).toUpperCase() + name.slice(1) });
      show();
    }
    function renderCrumb() {
      if (stack.length <= 1) { crumb.hidden = true; crumb.innerHTML = ''; return; }
      crumb.hidden = false;
      crumb.innerHTML = stack.map((s, i) =>
        i === stack.length - 1
          ? `<span class="crumb-cur">${esc(s.label)}</span>`
          : `<a href="#" data-i="${i}">${esc(s.label)}</a>`
      ).join('<span class="crumb-sep">›</span>');
      crumb.querySelectorAll('a').forEach(a => a.addEventListener('click', (e) => {
        e.preventDefault(); stack.length = (+a.dataset.i) + 1; show();
      }));
    }
    show();
  }

  // Tag any node whose EXACT source id has a detail diagram as drillable (works at any depth).
  function markClickable(host, manifest, onDrill, renderId) {
    if (!manifest || !manifest.length) return;
    const prefix = renderId + '-flowchart-';
    host.querySelectorAll('g.node').forEach((g) => {
      const id = g.id || '';
      // mermaid ids look like "<renderId>-flowchart-<sourceId>-<n>"; recover the exact sourceId
      const core = id.startsWith(prefix) ? id.slice(prefix.length) : id.replace(/^.*?-flowchart-/, '');
      const sourceId = core.replace(/-\d+$/, '');
      if (manifest.includes(sourceId)) {
        g.dataset.drill = sourceId;
        g.style.cursor = 'pointer';
        g.style.pointerEvents = 'auto';
        g.classList.add('drillable');
      }
    });
    // pan/click handling lives in makeInteractive; it invokes this on a real (non-drag) node click
    host._onNodeClick = onDrill;
  }

  // Pan / zoom / fullscreen for the Diagram view.
  function makeInteractive(render) {
    const svgEl = render.querySelector('svg');
    if (!svgEl) return;

    // wrap the svg in a transformable stage inside a clipping viewport
    render.classList.add('diagram-interactive');
    const stage = document.createElement('div');
    stage.className = 'diagram-stage';
    stage.appendChild(svgEl);
    render.appendChild(stage);

    // controls
    const bar = document.createElement('div');
    bar.className = 'diagram-controls';
    bar.innerHTML = `
      <button data-act="in"  title="Zoom in">+</button>
      <button data-act="out" title="Zoom out">−</button>
      <button data-act="fit" title="Fit / reset (double-click also resets)">⤢</button>
      <button data-act="full" title="Fullscreen">⛶</button>`;
    render.appendChild(bar);
    const hint = document.createElement('div');
    hint.className = 'diagram-hint-pill';
    hint.textContent = 'scroll to zoom · drag to pan';
    render.appendChild(hint);
    setTimeout(() => hint.classList.add('fade'), 3500);

    let s = 1, tx = 0, ty = 0;
    const MIN = 0.3, MAX = 5;
    const apply = () => { stage.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`; };

    function zoomAt(px, py, factor) {
      const ns = Math.min(MAX, Math.max(MIN, s * factor));
      if (ns === s) return;
      tx = px - (px - tx) * (ns / s);
      ty = py - (py - ty) * (ns / s);
      s = ns; apply();
    }
    function center() {
      const r = render.getBoundingClientRect();
      return { x: r.width / 2, y: r.height / 2 };
    }
    function reset() { s = 1; tx = 0; ty = 0; apply(); }

    render.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = render.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });

    let drag = null;
    render.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.diagram-controls')) return;
      drag = { x: e.clientX, y: e.clientY, tx, ty, target: e.target };  // keep the real down-target
      render._dragMoved = false;            // for distinguishing click (drill) from drag (pan)
      render.classList.add('dragging');
      render.setPointerCapture(e.pointerId);
    });
    render.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3) render._dragMoved = true;
      tx = drag.tx + (e.clientX - drag.x);
      ty = drag.ty + (e.clientY - drag.y);
      apply();
    });
    const endDrag = (e) => {
      const wasClick = drag && !render._dragMoved;
      const downTarget = drag && drag.target;
      drag = null; render.classList.remove('dragging');
      if (e.pointerId !== undefined) { try { render.releasePointerCapture(e.pointerId); } catch (_) {} }
      // node click detected from the pointer-DOWN target (robust under pointer capture / Firefox)
      if (wasClick && render._onNodeClick && downTarget && downTarget.closest) {
        const g = downTarget.closest('[data-drill]');
        if (g) render._onNodeClick(g.dataset.drill);
      }
    };
    render.addEventListener('pointerup', endDrag);
    render.addEventListener('pointercancel', endDrag);
    render.addEventListener('dblclick', (e) => { if (!e.target.closest('.diagram-controls')) reset(); });

    bar.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      const c = center();
      if (act === 'in') zoomAt(c.x, c.y, 1.25);
      else if (act === 'out') zoomAt(c.x, c.y, 1 / 1.25);
      else if (act === 'fit') reset();
      else if (act === 'full') {
        if (document.fullscreenElement) document.exitFullscreen();
        else render.requestFullscreen?.();
      }
    });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) reset(); });
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
