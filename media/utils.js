// ── Polyfill ───────────────────────────────────────────────
const deepClone = typeof structuredClone !== 'undefined'
  ? structuredClone
  : v => JSON.parse(JSON.stringify(v));

// ── Value helpers ──────────────────────────────────────────
function valEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function getNestedValue(obj, path) {
  let cur = obj;
  for (const k of path) { if (cur == null) return undefined; cur = cur[k]; }
  return cur;
}

function setNestedValue(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) cur = cur[path[i]];
  cur[path[path.length - 1]] = value;
}

function pathKey(path) { return JSON.stringify(path); }

function normalizePath(path) {
  if (typeof path === 'string') return path.split('.').map(seg => /^\d+$/.test(seg) ? Number(seg) : seg);
  if (Array.isArray(path) && path.length === 1 && typeof path[0] === 'string' && path[0].includes('.')) {
    return path[0].split('.').map(seg => /^\d+$/.test(seg) ? Number(seg) : seg);
  }
  return (path || []).map(seg => typeof seg === 'number' ? seg : (/^\d+$/.test(String(seg)) ? Number(seg) : String(seg)));
}

// ── String helpers ─────────────────────────────────────────
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function linkifyUrls(text) {
  const urlRe = /https?:\/\/[^\s"'<>)}\]]+/g;
  let last = 0, out = '', m;
  while ((m = urlRe.exec(text)) !== null) {
    out += escapeHtml(text.slice(last, m.index));
    const url = m[0].replace(/[.,;:!?]+$/, '');
    urlRe.lastIndex = m.index + url.length;
    out += `<a href="${escapeHtml(url)}" class="agent-link" title="${escapeHtml(url)}">${escapeHtml(url)}</a>`;
    last = m.index + url.length;
  }
  out += escapeHtml(text.slice(last));
  return out;
}

function commonPrefix(strs) {
  if (strs.length === 0) return '';
  let p = strs[0];
  for (let i = 1; i < strs.length; i++) {
    while (strs[i].indexOf(p) !== 0) p = p.slice(0, -1);
    if (p === '') break;
  }
  return p;
}

// ── Object flatten (for export) ────────────────────────────
function flattenObj(obj, prefix = '') {
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenObj(val, p));
    } else {
      result[p] = val;
    }
  }
  return result;
}

// ── Toast notification ─────────────────────────────────────
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
