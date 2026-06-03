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

  // global right panel (Todo + Tickets) — on every view -------------------------
  initRightPanel();
  initReadingProgress();

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

  // per-view --------------------------------------------------------------------
  if (view === 'idea' || view === 'workflow') initEditor();
  else if (view === 'architecture') initArchitecture();
  else if (view === 'diagram') initDiagram();
  else if (view === 'tickets') initTickets();

  // ── Right panel ──────────────────────────────────────────────────────────────
  function initRightPanel() {
    const panel = document.getElementById('right-panel');
    if (!panel) return;
    document.getElementById('right-open').addEventListener('click', () => document.body.classList.add('right-open'));
    document.getElementById('right-close').addEventListener('click', () => document.body.classList.remove('right-open'));
    document.querySelectorAll('.rp-tab').forEach(tab =>
      tab.addEventListener('click', () => {
        document.querySelectorAll('.rp-tab').forEach(t => t.classList.toggle('active', t === tab));
        const name = tab.dataset.tab;
        document.querySelectorAll('.rp-pane').forEach(p => p.classList.toggle('active', p.id === 'rp-' + name));
        if (name === 'tickets') loadTicketList();
      }));

    // todos
    const input = document.getElementById('todo-input');
    const listEl = document.getElementById('todo-list');
    autoGrow(input);
    input.addEventListener('input', () => autoGrow(input));
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addTodo(); } });
    document.getElementById('todo-add-btn').addEventListener('click', addTodo);
    loadTodos();

    async function loadTodos() {
      let todos = [];
      try { todos = await api('GET', '/api/todos'); } catch (_) {}
      listEl.innerHTML = todos.map(t => `
        <li class="todo-item" data-id="${t.id}">
          <span class="todo-text">${esc(t.content)}</span>
          <button class="btn-ghost todo-to-ticket" data-id="${t.id}" title="Turn into a ticket">→</button>
          <button class="todo-del" data-id="${t.id}" title="Delete">×</button>
        </li>`).join('') || '<li class="rp-empty">No todos yet.</li>';
      listEl.querySelectorAll('.todo-del').forEach(b =>
        b.addEventListener('click', async () => { await api('DELETE', '/api/todos/' + b.dataset.id); loadTodos(); }));
      listEl.querySelectorAll('.todo-to-ticket').forEach(b =>
        b.addEventListener('click', async () => {
          const text = b.closest('.todo-item').querySelector('.todo-text').textContent;
          await api('POST', '/api/tickets', { title: text, source: 'todo' });
          await api('DELETE', '/api/todos/' + b.dataset.id);
          loadTodos(); loadTicketList();
          if (window.__refreshTicketsGrid) window.__refreshTicketsGrid();
        }));
    }
    async function addTodo() {
      const content = input.value.trim(); if (!content) return;
      await api('POST', '/api/todos', { content });
      input.value = ''; autoGrow(input); loadTodos();
    }
    function autoGrow(el) {
      if (!el) return;
      el.style.height = 'auto';
      const max = 12 * 22;
      el.style.height = Math.min(el.scrollHeight, max) + 'px';
      el.style.overflowY = el.scrollHeight > max ? 'auto' : 'hidden';
    }

    // tickets quick-list
    const ticketListEl = document.getElementById('ticket-list');
    async function loadTicketList() {
      let tickets = [];
      try { tickets = await api('GET', '/api/tickets'); } catch (_) {}
      ticketListEl.innerHTML = tickets.map(t => `
        <li class="ticket-item" data-id="${t.id}">
          <div class="ticket-title">${esc(t.title)}</div>
          <div class="ticket-meta"><span class="status-chip status-${esc(t.status)}">${esc(t.status)}</span>
            <span>${t.steps_done}/${t.steps_total} steps</span></div>
        </li>`).join('') || '<li class="rp-empty">No tickets yet.</li>';
      ticketListEl.querySelectorAll('.ticket-item').forEach(li =>
        li.addEventListener('click', () => {
          if (window.__openTicketById) window.__openTicketById(li.dataset.id);
          else window.location.href = '/tickets';
        }));
    }
    window.__reloadTicketList = loadTicketList;
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
    // arm reveal-on-scroll before the content renders (so it starts hidden, then settles in)
    const docEl = viewerEl.closest('.doc-viewer');
    const animate = docEl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (animate) docEl.classList.add('reveal-on');
    toastui.Editor.factory({ el: viewerEl, viewer: true, initialValue: d.content });
    requestAnimationFrame(async () => {
      buildToc(viewerEl);
      addHeadingAnchors(viewerEl);
      setupTocSpy(viewerEl);
      badgeStatuses(viewerEl);
      await renderArchMermaid(viewerEl);
      if (animate) setupReveal(viewerEl);
    });
  }
  // Hover-to-copy "#" anchors on section headings.
  function addHeadingAnchors(root) {
    root.querySelectorAll('h2[id], h3[id]').forEach((h) => {
      const a = document.createElement('a');
      a.className = 'head-anchor'; a.href = '#' + h.id; a.textContent = '#';
      a.title = 'Copy link to this section';
      a.addEventListener('click', (e) => {
        e.preventDefault();
        history.replaceState(null, '', '#' + h.id);
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
    heads.forEach((h, i) => {
      const id = 'sec-' + i + '-' + slugify(h.textContent);
      h.id = id;
      html += `<a class="toc-${h.tagName.toLowerCase()}" href="#${id}">${esc(h.textContent)}</a>`;
    });
    toc.innerHTML = html;
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

  // ── Tickets page (grid + modal) ──────────────────────────────────────────────
  function initTickets() {
    const grid = document.getElementById('tickets-grid');
    let tickets = [];
    let modalEditor = null;
    let current = null;
    let steps = [];

    loadTickets();
    document.getElementById('new-ticket-btn').addEventListener('click', async () => {
      const t = await api('POST', '/api/tickets', { title: 'Untitled ticket', source: 'manual' });
      tickets.unshift(t); renderGrid(); openModal(t);
      if (window.__reloadTicketList) window.__reloadTicketList();
    });

    window.__refreshTicketsGrid = loadTickets;
    window.__openTicketById = (id) => {
      const t = tickets.find(x => x.id === id);
      if (t) { document.body.classList.remove('right-open'); openModal(t); }
    };

    async function loadTickets() {
      try { tickets = await api('GET', '/api/tickets'); } catch (_) { tickets = []; }
      renderGrid();
    }
    function renderGrid() {
      if (!tickets.length) { grid.innerHTML = '<p class="tickets-empty">No tickets yet. Create one, or turn a todo into a ticket.</p>'; return; }
      grid.innerHTML = tickets.map(t => `
        <div class="ticket-card ${t.status === 'done' ? 'card-done' : ''}" data-id="${t.id}">
          <div class="card-header"><span class="card-title">${esc(t.title)}</span>
            <span class="status-chip status-${esc(t.status)}">${esc(t.status)}</span></div>
          <div class="card-body">${esc(t.reasoning || '—')}</div>
          <div class="card-footer"><span class="card-steps-done">${t.steps_done}/${t.steps_total} steps</span>
            <span>${esc(t.file)}</span></div>
        </div>`).join('');
      grid.querySelectorAll('.ticket-card').forEach(c =>
        c.addEventListener('click', () => openModal(tickets.find(t => t.id === c.dataset.id))));
    }

    const modal = document.getElementById('ticket-modal');
    const elTitle = document.getElementById('m-title');
    const elStatus = document.getElementById('m-status');
    const elReason = document.getElementById('m-reasoning');
    const elSteps = document.getElementById('m-steps');
    const elMsg = document.getElementById('m-status-msg');
    const elToggle = document.getElementById('m-toggle');

    function openModal(t) {
      current = t; steps = (t.steps || []).map(s => ({ ...s }));
      elTitle.value = t.title; elReason.value = t.reasoning || '';
      setChip(t.status); renderSteps();
      document.getElementById('m-body').innerHTML = '';
      modalEditor = new toastui.Editor({
        el: document.getElementById('m-body'), height: '240px',
        initialEditType: 'wysiwyg', previewStyle: 'tab',
        initialValue: t.body || '', usageStatistics: false,
      });
      modal.classList.remove('hidden');
    }
    function closeModal() {
      modal.classList.add('hidden');
      if (modalEditor) { modalEditor.destroy(); modalEditor = null; }
      current = null;
    }
    function setChip(status) { elStatus.textContent = status; elStatus.className = 'status-chip status-' + status; }
    function msg(m, err) { elMsg.textContent = m; elMsg.classList.toggle('is-error', !!err); if (!err) setTimeout(() => elMsg.textContent = '', 3000); }

    function renderSteps() {
      elToggle.textContent = current.status === 'done' ? 'Reopen' : 'Mark done';
      elSteps.innerHTML = steps.map((s, i) => `
        <li class="detail-step ${s.done ? 'step-done' : ''}">
          <input type="checkbox" data-i="${i}" ${s.done ? 'checked' : ''}>
          <span>${esc(s.text)}</span>
          <button class="todo-del step-del" data-i="${i}" title="Remove">×</button>
        </li>`).join('');
      elSteps.querySelectorAll('input[type=checkbox]').forEach(cb =>
        cb.addEventListener('change', async () => { steps[+cb.dataset.i].done = cb.checked; await persist({ steps }); renderSteps(); }));
      elSteps.querySelectorAll('.step-del').forEach(b =>
        b.addEventListener('click', () => { steps.splice(+b.dataset.i, 1); renderSteps(); }));
    }

    async function persist(patch) {
      const updated = await api('PATCH', '/api/tickets/' + current.id, patch);
      current = updated;
      const i = tickets.findIndex(x => x.id === updated.id);
      if (i !== -1) tickets[i] = updated;
      renderGrid();
      if (window.__reloadTicketList) window.__reloadTicketList();
      return updated;
    }

    document.getElementById('m-step-add-btn').addEventListener('click', addStep);
    document.getElementById('m-step-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addStep(); } });
    function addStep() {
      const inp = document.getElementById('m-step-input');
      if (!inp.value.trim()) return;
      steps.push({ text: inp.value.trim(), done: false }); inp.value = ''; renderSteps();
    }

    document.getElementById('m-save').addEventListener('click', async () => {
      msg('Saving…');
      try {
        await persist({ title: elTitle.value.trim() || 'Untitled', reasoning: elReason.value, steps, body: modalEditor.getMarkdown() });
        msg('Saved to ' + current.file);
      } catch (e) { msg('Error: ' + e.message, true); }
    });
    elToggle.addEventListener('click', async () => {
      try { const u = await persist({ status: current.status === 'done' ? 'open' : 'done' }); setChip(u.status); renderSteps(); }
      catch (e) { msg('Error: ' + e.message, true); }
    });
    document.getElementById('m-delete').addEventListener('click', async () => {
      if (!confirm('Delete "' + current.title + '"? This removes the task file.')) return;
      await api('DELETE', '/api/tickets/' + current.id);
      tickets = tickets.filter(x => x.id !== current.id);
      renderGrid(); closeModal();
      if (window.__reloadTicketList) window.__reloadTicketList();
    });
    document.getElementById('m-close').addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  }
})();
