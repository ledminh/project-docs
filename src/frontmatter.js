// project-docs/src/frontmatter.js
// Minimal, dependency-free parse/serialize for the ticket file schema.
// Schema (all optional except title): id, title, status, created, source, reasoning, steps[{text,done}].
// Values are double-quoted+JSON-escaped on write, so the parser can JSON.parse them back safely.

function q(v) { return JSON.stringify(String(v == null ? '' : v)); }

function unquote(raw) {
  const s = (raw ?? '').trim();
  if (s.startsWith('"')) {
    try { return JSON.parse(s); } catch (_) { return s.replace(/^"|"$/g, ''); }
  }
  return s;
}

// parse(raw) -> { data, body }
function parse(raw) {
  const text = String(raw ?? '');
  const data = { steps: [] };
  let body = text;

  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data, body: text };

  const fm = m[1];
  body = m[2] ?? '';

  const lines = fm.split(/\r?\n/);
  let mode = null; // 'steps' when inside the steps list
  for (const line of lines) {
    if (!line.trim()) continue;

    // step item:  "  - text: ..."
    const stepText = line.match(/^\s*-\s*text:\s*(.*)$/);
    if (mode === 'steps' && stepText) {
      data.steps.push({ text: unquote(stepText[1]), done: false });
      continue;
    }
    // step flag:  "    done: true"
    const stepDone = line.match(/^\s+done:\s*(true|false)\s*$/);
    if (mode === 'steps' && stepDone && data.steps.length) {
      data.steps[data.steps.length - 1].done = stepDone[1] === 'true';
      continue;
    }

    // top-level "key: value"
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (kv) {
      const key = kv[1];
      if (key === 'steps') { mode = 'steps'; data.steps = []; continue; }
      mode = null;
      data[key] = unquote(kv[2]);
    }
  }

  if (!Array.isArray(data.steps)) data.steps = [];
  return { data, body: body.replace(/^\r?\n/, '') };
}

// stringify({ data, body }) -> raw file content
function stringify(data = {}, body = '') {
  const out = ['---'];
  out.push(`id: ${q(data.id || '')}`);
  out.push(`title: ${q(data.title || '')}`);
  out.push(`status: ${q(data.status || 'open')}`);
  out.push(`created: ${q(data.created || new Date().toISOString().slice(0, 10))}`);
  out.push(`source: ${q(data.source || 'manual')}`);
  out.push(`reasoning: ${q(data.reasoning || '')}`);
  out.push('steps:');
  for (const s of (data.steps || [])) {
    out.push(`  - text: ${q(s.text || '')}`);
    out.push(`    done: ${s.done ? 'true' : 'false'}`);
  }
  out.push('---', '');
  out.push(String(body || ''));
  return out.join('\n');
}

module.exports = { parse, stringify };
