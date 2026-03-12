// ── VSCode API ─────────────────────────────────────────────
const vscode = acquireVsCodeApi();

// ── Polyfill ───────────────────────────────────────────────
const deepClone = typeof structuredClone !== 'undefined'
  ? structuredClone
  : v => JSON.parse(JSON.stringify(v));

// ── Theme definitions ──────────────────────────────────────
const DARK_BADGES = {
  '--badge-str-bg':'#1a3a2a',  '--badge-str-fg':'#3fb950',
  '--badge-num-bg':'#1a2a3a',  '--badge-num-fg':'#58a6ff',
  '--badge-bool-bg':'#2a1a3a', '--badge-bool-fg':'#bc8cff',
  '--badge-null-bg':'#2a2a1a', '--badge-null-fg':'#d29922',
  '--badge-list-bg':'#2a1a2a', '--badge-list-fg':'#f778ba',
};

const THEMES = {
  midnight: {
    label: 'Midnight', bg: '#0d1117',
    defaults: { labelColor: '#c9d1d9', fieldColor: '#58a6ff', accentColor: '#58a6ff' },
    vars: { '--bg-0':'#0d1117','--bg-1':'#161b22','--bg-2':'#21262d','--bg-3':'#30363d',
            '--border':'#30363d','--text-0':'#e6edf3','--text-1':'#c9d1d9','--text-2':'#8b949e',
            ...DARK_BADGES }
  },
  slate: {
    label: 'Slate', bg: '#1e1e2e',
    defaults: { labelColor: '#c0c0d0', fieldColor: '#a78bfa', accentColor: '#a78bfa' },
    vars: { '--bg-0':'#1e1e2e','--bg-1':'#262637','--bg-2':'#2e2e42','--bg-3':'#3a3a50',
            '--border':'#3a3a50','--text-0':'#e0e0ef','--text-1':'#c0c0d0','--text-2':'#8888a0',
            ...DARK_BADGES }
  },
  nord: {
    label: 'Nord', bg: '#2e3440',
    defaults: { labelColor: '#d8dee9', fieldColor: '#88c0d0', accentColor: '#88c0d0' },
    vars: { '--bg-0':'#2e3440','--bg-1':'#3b4252','--bg-2':'#434c5e','--bg-3':'#4c566a',
            '--border':'#4c566a','--text-0':'#eceff4','--text-1':'#d8dee9','--text-2':'#81a1c1',
            ...DARK_BADGES }
  },
  forest: {
    label: 'Forest', bg: '#1a2218',
    defaults: { labelColor: '#b8c8a8', fieldColor: '#56a869', accentColor: '#56a869' },
    vars: { '--bg-0':'#1a2218','--bg-1':'#222d1f','--bg-2':'#2b3828','--bg-3':'#374432',
            '--border':'#374432','--text-0':'#e0ead8','--text-1':'#b8c8a8','--text-2':'#7a9468',
            ...DARK_BADGES }
  },
  light: {
    label: 'Light', bg: '#ffffff',
    defaults: { labelColor: '#31363b', fieldColor: '#0969da', accentColor: '#0969da' },
    vars: { '--bg-0':'#ffffff','--bg-1':'#f6f8fa','--bg-2':'#eef1f5','--bg-3':'#d0d7de',
            '--border':'#d0d7de','--text-0':'#1f2328','--text-1':'#31363b','--text-2':'#57606a',
            '--badge-str-bg':'#dcfce7',  '--badge-str-fg':'#15803d',
            '--badge-num-bg':'#dbeafe',  '--badge-num-fg':'#1d4ed8',
            '--badge-bool-bg':'#f3e8ff', '--badge-bool-fg':'#7c3aed',
            '--badge-null-bg':'#fef3c7', '--badge-null-fg':'#92400e',
            '--badge-list-bg':'#fce7f3', '--badge-list-fg':'#be185d' }
  },
  desert: {
    label: 'Desert', bg: '#f5f0e8',
    defaults: { labelColor: '#5c3d2e', fieldColor: '#c07050', accentColor: '#c07050' },
    vars: { '--bg-0':'#f5f0e8','--bg-1':'#ede4d3','--bg-2':'#e0d5c0','--bg-3':'#c8bea8',
            '--border':'#c8bea8','--text-0':'#2d1a0e','--text-1':'#5c3d2e','--text-2':'#8b6050',
            '--badge-str-bg':'#e8f4e6',  '--badge-str-fg':'#2a6a2a',
            '--badge-num-bg':'#e6ecf4',  '--badge-num-fg':'#1a4878',
            '--badge-bool-bg':'#f0e8f4', '--badge-bool-fg':'#5a1880',
            '--badge-null-bg':'#f8f0d8', '--badge-null-fg':'#7a4a00',
            '--badge-list-bg':'#f4e8f0', '--badge-list-fg':'#7a1840' }
  },
  sunset: {
    label: 'Sunset', bg: '#fff5f0',
    defaults: { labelColor: '#5c2810', fieldColor: '#d94f2a', accentColor: '#d94f2a' },
    vars: { '--bg-0':'#fff5f0','--bg-1':'#ffe8dc','--bg-2':'#ffd4c0','--bg-3':'#f5bca8',
            '--border':'#e8a890','--text-0':'#2d1008','--text-1':'#5c2810','--text-2':'#a04530',
            '--badge-str-bg':'#e8f4e0',  '--badge-str-fg':'#2a6a10',
            '--badge-num-bg':'#e0ecff',  '--badge-num-fg':'#1a3a8a',
            '--badge-bool-bg':'#f4e0f8', '--badge-bool-fg':'#6a1080',
            '--badge-null-bg':'#fff0c0', '--badge-null-fg':'#7a4800',
            '--badge-list-bg':'#ffe0f0', '--badge-list-fg':'#8a1050' }
  },
};

// ── State ──────────────────────────────────────────────────
const state = {
  files: [],
  configs: {},
  activeFile: null,
  fieldMap: {},
  fieldCounter: 0,
};

const SETTINGS_KEY = 'config-dashboard-settings';
const defaultSettings = {
  theme: 'midnight',
  labelFont: "'JetBrains Mono', monospace",
  fieldFont: "'Major Mono Display', monospace",
  valueFont: "'Courier New', Courier, monospace",
  fontSize: 12,
  labelColor: '#c9d1d9',
  fieldColor: '#58a6ff',
  accentColor: '#58a6ff',
  density: 'compact',
  showBadges: true,
  showCounts: true,
  autoExpand: false,
  sortKeys: false,
};
let settings = { ...defaultSettings };

// Detect macOS for keyboard shortcut hint
if (navigator.userAgent.includes('Mac') || navigator.userAgentData?.platform === 'macOS') {
  document.getElementById('mod-key').textContent = '\u2318';
}

// ── Settings ───────────────────────────────────────────────
function loadSettings() {
  try {
    const prev = vscode.getState();
    if (prev && prev.settings) settings = { ...defaultSettings, ...prev.settings };
  } catch {}
  applySettings();
  syncSettingsUI();
}

function saveSettings() {
  const prev = vscode.getState() || {};
  vscode.setState({ ...prev, settings });
}

function syncSettingsUI() {
  document.getElementById('set-label-font').value = settings.labelFont;
  document.getElementById('set-field-font').value = settings.fieldFont;
  document.getElementById('set-value-font').value = settings.valueFont;
  document.getElementById('set-font-size').value = settings.fontSize;
  document.getElementById('font-size-val').textContent = settings.fontSize;
  document.getElementById('set-label-color').value = settings.labelColor;
  document.getElementById('set-field-color').value = settings.fieldColor;
  document.getElementById('set-accent-color').value = settings.accentColor;
  document.getElementById('set-density').value = settings.density;
  document.getElementById('set-badges').checked = settings.showBadges;
  document.getElementById('set-counts').checked = settings.showCounts;
  document.getElementById('set-autoexpand').checked = settings.autoExpand;
  document.getElementById('set-sortkeys').checked = settings.sortKeys;
  document.querySelectorAll('.sp-theme-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.theme === settings.theme);
  });
}

function applySettings() {
  const root = document.documentElement.style;
  root.setProperty('--font-label', settings.labelFont);
  root.setProperty('--font-field', settings.fieldFont);
  root.setProperty('--font-value', settings.valueFont);
  root.setProperty('--font-size-base', settings.fontSize + 'px');
  root.setProperty('--color-label', settings.labelColor);
  root.setProperty('--color-field', settings.fieldColor);
  root.setProperty('--accent', settings.accentColor);

  const hex = settings.accentColor.replace('#','');
  const r = Math.max(0, parseInt(hex.slice(0,2),16) - 40);
  const g = Math.max(0, parseInt(hex.slice(2,4),16) - 40);
  const b = Math.max(0, parseInt(hex.slice(4,6),16) - 40);
  root.setProperty('--accent-dim', `rgb(${r},${g},${b})`);

  const theme = THEMES[settings.theme];
  if (theme) {
    for (const [k, v] of Object.entries(theme.vars)) root.setProperty(k, v);
  }

  const densityMap = {
    compact: { pad: '4px', gap: '8px', secGap: '2px' },
    comfortable: { pad: '7px', gap: '12px', secGap: '4px' },
    spacious: { pad: '11px', gap: '16px', secGap: '8px' },
  };
  const d = densityMap[settings.density] || densityMap.comfortable;
  root.setProperty('--field-pad-y', d.pad);
  root.setProperty('--field-gap', d.gap);
  root.setProperty('--section-gap', d.secGap);

  document.body.classList.toggle('hide-badges', !settings.showBadges);
  document.body.classList.toggle('hide-counts', !settings.showCounts);
}

function onSettingChange() {
  settings.labelFont = document.getElementById('set-label-font').value;
  settings.fieldFont = document.getElementById('set-field-font').value;
  settings.valueFont = document.getElementById('set-value-font').value;
  settings.fontSize = parseInt(document.getElementById('set-font-size').value);
  settings.labelColor = document.getElementById('set-label-color').value;
  settings.fieldColor = document.getElementById('set-field-color').value;
  settings.accentColor = document.getElementById('set-accent-color').value;
  settings.density = document.getElementById('set-density').value;
  settings.showBadges = document.getElementById('set-badges').checked;
  settings.showCounts = document.getElementById('set-counts').checked;
  settings.autoExpand = document.getElementById('set-autoexpand').checked;
  settings.sortKeys = document.getElementById('set-sortkeys').checked;

  document.getElementById('font-size-val').textContent = settings.fontSize;

  applySettings();
  saveSettings();

  if (state.activeFile) renderEditor();
}

function selectTheme(themeName) {
  settings.theme = themeName;
  const t = THEMES[themeName];
  if (t && t.defaults) {
    settings.labelColor  = t.defaults.labelColor;
    settings.fieldColor  = t.defaults.fieldColor;
    settings.accentColor = t.defaults.accentColor;
  }
  applySettings();
  saveSettings();
  syncSettingsUI();
}

function toggleSettings() {
  const panel = document.getElementById('settings-panel');
  const overlay = document.getElementById('settings-overlay');
  const btn = document.getElementById('settings-btn');
  const open = panel.style.display !== 'block';
  panel.style.display = open ? 'block' : 'none';
  overlay.style.display = open ? 'block' : 'none';
  btn.classList.toggle('active', open);
}

function buildThemeSwatches() {
  const container = document.getElementById('theme-swatches');
  container.innerHTML = Object.entries(THEMES).map(([key, t]) =>
    `<div>
      <div class="sp-theme-swatch${settings.theme === key ? ' active' : ''}"
           data-theme="${key}" title="${t.label}"
           style="background: linear-gradient(135deg, ${t.bg} 55%, ${t.defaults.accentColor} 55%)"></div>
      <span class="swatch-label">${t.label}</span>
    </div>`
  ).join('');
}

// ── Export helpers ──────────────────────────────────────────
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

function copyAsCLI() {
  const config = state.configs[state.activeFile];
  if (!config) return;
  const flat = flattenObj(config.current);
  const args = Object.entries(flat).map(([k, v]) => {
    if (v === null) return `--${k} null`;
    if (v === true) return `--${k}`;
    if (v === false) return `--no-${k}`;
    if (Array.isArray(v)) return `--${k} ${v.join(',')}`;
    return `--${k} ${v}`;
  }).join(' \\\n  ');
  navigator.clipboard.writeText(args);
  toast('Copied CLI args to clipboard', 'success');
}

function copyAsJSON() {
  const config = state.configs[state.activeFile];
  if (!config) return;
  const flat = flattenObj(config.current);
  navigator.clipboard.writeText(JSON.stringify(flat, null, 2));
  toast('Copied flat JSON to clipboard', 'success');
}

function copyAsEnv() {
  const config = state.configs[state.activeFile];
  if (!config) return;
  const flat = flattenObj(config.current);
  const envStr = Object.entries(flat).map(([k, v]) => {
    const envKey = k.replace(/\./g, '__').toUpperCase();
    const envVal = Array.isArray(v) ? v.join(',') : String(v);
    return `${envKey}=${envVal}`;
  }).join('\n');
  navigator.clipboard.writeText(envStr);
  toast('Copied env vars to clipboard', 'success');
}

// ── Message handler from extension host ────────────────────
window.addEventListener('message', event => {
  const msg = event.data;
  switch (msg.type) {
    case 'init': {
      state.files = msg.files;
      if (state.files.length > 0) {
        const stems = state.files.map(f => f.replace(/\.ya?ml$/, ''));
        const prefix = commonPrefix(stems).replace(/[/_-]+$/, '');
        document.getElementById('project-badge').textContent = prefix || 'configs';
      }
      renderTabs();
      if (state.files.length > 0) selectFile(state.files[0]);
      break;
    }
    case 'configData': {
      if (msg.error) { toast('Error loading: ' + msg.error, 'error'); return; }
      state.configs[msg.filename] = {
        original: deepClone(msg.parsed),
        current: deepClone(msg.parsed),
      };
      state.activeFile = msg.filename;
      renderTabs();
      renderEditor();
      updateButtons();
      break;
    }
    case 'writeResult': {
      const saveBtn = document.getElementById('save-btn');
      if (msg.success) {
        const config = state.configs[msg.filename];
        if (config) config.original = deepClone(config.current);
        renderEditor(); renderTabs();
        toast('Saved ' + msg.filename, 'success');
      } else {
        toast('Error: ' + (msg.error || 'Unknown'), 'error');
      }
      saveBtn.innerHTML = '<span class="btn-save-indicator">Save</span>';
      updateButtons();
      break;
    }
  }
});

// ── Init ───────────────────────────────────────────────────
function init() {
  buildThemeSwatches();
  loadSettings();
  vscode.postMessage({ type: 'init' });
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

// ── File selection ─────────────────────────────────────────
function selectFile(filename) {
  if (!state.configs[filename]) {
    vscode.postMessage({ type: 'readConfig', filename });
    return;
  }
  state.activeFile = filename;
  renderTabs();
  renderEditor();
  updateButtons();
}

// ── Tabs ───────────────────────────────────────────────────
function renderTabs() {
  const nav = document.getElementById('file-tabs');
  const prefix = commonPrefix(state.files.map(f => f.replace(/\.ya?ml$/, '')));
  nav.innerHTML = state.files.map(f => {
    const isActive = f === state.activeFile;
    const modified = state.configs[f] && isModified(f);
    let label = f.replace(/\.ya?ml$/, '');
    if (prefix.length > 0) label = label.slice(prefix.length) || label;
    return `<button class="tab${isActive ? ' active' : ''}" data-filename="${escapeHtml(f)}">${escapeHtml(label)}${modified ? '<span class="dot"></span>' : ''}</button>`;
  }).join('');
}

function isModified(filename) {
  const c = state.configs[filename];
  if (!c) return false;
  return JSON.stringify(c.original) !== JSON.stringify(c.current);
}

// ── Editor rendering ───────────────────────────────────────
function renderEditor() {
  state.fieldMap = {};
  state.fieldCounter = 0;

  const main = document.getElementById('config-editor');
  const config = state.configs[state.activeFile];
  if (!config) { main.innerHTML = ''; return; }

  main.innerHTML = renderNode(config.current, config.original, []);

  if (settings.autoExpand) {
    main.querySelectorAll('.section').forEach(s => s.classList.remove('collapsed'));
  } else {
    main.querySelectorAll(':scope > .section').forEach(s => s.classList.remove('collapsed'));
  }
  applySectionHeights();
  applySearch();
}

function registerField(path, type) {
  const id = 'f' + (state.fieldCounter++);
  state.fieldMap[id] = { path: [...path], type };
  return id;
}

// ── Recursive node renderer ────────────────────────────────
function renderNode(value, original, path) {
  if (value === null || value === undefined) {
    return renderScalarField(path, value, original, 'null');
  }
  if (Array.isArray(value)) {
    if (value.length === 0 || typeof value[0] !== 'object' || value[0] === null) {
      return renderScalarArrayField(path, value, original);
    }
    return renderObjectArray(path, value, original);
  }
  if (typeof value === 'object') {
    return renderObjectNode(value, original, path);
  }
  const type = typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? 'num' : 'str';
  return renderScalarField(path, value, original, type);
}

function sortedKeys(obj) {
  const keys = Object.keys(obj);
  return settings.sortKeys ? keys.sort() : keys;
}

function renderObjectNode(obj, original, path) {
  let html = '';
  for (const key of sortedKeys(obj)) {
    const val = obj[key];
    const orig = original != null ? original[key] : undefined;
    const childPath = [...path, key];

    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      const childCount = Object.keys(val).length;
      const dispKey = escapeHtml(String(key).replace(/_/g, ' ').toLowerCase());
      html += `<div class="section collapsed">
        <div class="section-header" data-action="toggle-section">
          <span class="chevron">&#9654;</span>
          <span class="section-name">${dispKey}</span>
          <span class="section-count">${childCount}</span>
        </div>
        <div class="section-body">${renderObjectNode(val, orig, childPath)}</div>
      </div>`;
    } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
      const dispKey = escapeHtml(String(key).replace(/_/g, ' ').toLowerCase());
      html += `<div class="section collapsed">
        <div class="section-header" data-action="toggle-section">
          <span class="chevron">&#9654;</span>
          <span class="section-name">${dispKey}</span>
          <span class="section-count">${val.length} items</span>
        </div>
        <div class="section-body">${renderObjectArray(childPath, val, orig)}</div>
      </div>`;
    } else {
      html += renderNode(val, orig, childPath);
    }
  }
  return html;
}

function renderObjectArray(path, arr, origArr) {
  let html = '';
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const origItem = origArr && origArr[i] ? origArr[i] : {};
    const label = escapeHtml(String(item.name || item.fn_key || `[${i}]`).replace(/_/g, ' ').toLowerCase());
    const childCount = Object.keys(item).length;
    html += `<div class="section collapsed">
      <div class="section-header" data-action="toggle-section">
        <span class="chevron">&#9654;</span>
        <span class="section-name">${label}</span>
        <span class="section-count">${childCount}</span>
      </div>
      <div class="section-body">${renderObjectNode(item, origItem, [...path, i])}</div>
    </div>`;
  }
  return html;
}

function renderScalarField(path, value, original, type) {
  const key = path[path.length - 1];
  const dispKey = escapeHtml(String(key).replace(/_/g, ' ').toLowerCase());
  const fid = registerField(path, type);
  const mod = !valEqual(value, original) ? ' modified' : '';
  const resetVisible = mod ? ' visible' : '';

  let inputHtml;
  if (type === 'bool') {
    const checked = value ? ' checked' : '';
    inputHtml = `<label class="toggle">
      <input type="checkbox" id="${fid}"${checked} data-action="toggle" data-fid="${fid}">
      <span class="toggle-slider"></span>
    </label>`;
  } else if (type === 'null') {
    inputHtml = `<span class="null-badge" data-action="convert-null" data-fid="${fid}" title="Click to set a value">null</span>`;
  } else if (type === 'num') {
    inputHtml = `<input type="text" id="${fid}" value="${escapeHtml(String(value))}" class="${mod ? 'modified' : ''}" data-action="input" data-fid="${fid}">`;
  } else {
    inputHtml = `<input type="text" id="${fid}" value="${escapeHtml(String(value))}" class="${mod ? 'modified' : ''}" data-action="input" data-fid="${fid}">`;
  }

  const typeBadge = `<span class="type-badge type-${type}">${type}</span>`;
  const origTitle = original !== undefined ? ` title="Original: ${escapeHtml(String(original))}"` : '';

  return `<div class="field${mod}" data-fid="${fid}" data-key="${escapeHtml(String(key))}"${origTitle}>
    <span class="field-key">${dispKey} ${typeBadge}</span>
    <span class="field-input">${inputHtml}</span>
    <button class="field-reset${resetVisible}" data-action="reset-field" data-fid="${fid}" title="Reset to original">&#8635;</button>
  </div>`;
}

function renderScalarArrayField(path, value, original) {
  const key = path[path.length - 1];
  const dispKey = escapeHtml(String(key).replace(/_/g, ' ').toLowerCase());
  const fid = registerField(path, 'list');
  const mod = !valEqual(value, original) ? ' modified' : '';
  const resetVisible = mod ? ' visible' : '';

  let itemsHtml = '';
  for (let i = 0; i < value.length; i++) {
    itemsHtml += `<div class="array-item">
      <input type="text" value="${escapeHtml(String(value[i]))}" data-action="array-input" data-fid="${fid}" data-index="${i}">
      <button class="array-btn remove" data-action="remove-item" data-fid="${fid}" data-index="${i}" title="Remove">&times;</button>
    </div>`;
  }
  itemsHtml += `<button class="array-btn add" data-action="add-item" data-fid="${fid}">+ add</button>`;

  const typeBadge = `<span class="type-badge type-list">list</span>`;

  return `<div class="field${mod}" data-fid="${fid}" data-key="${escapeHtml(String(key))}">
    <span class="field-key">${dispKey} ${typeBadge}</span>
    <span class="field-input"><div class="array-items">${itemsHtml}</div></span>
    <button class="field-reset${resetVisible}" data-action="reset-field" data-fid="${fid}" title="Reset to original">&#8635;</button>
  </div>`;
}

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

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Input handlers ─────────────────────────────────────────
function onInput(fid, rawValue) {
  const { path, type } = state.fieldMap[fid];
  let value;
  if (type === 'num') {
    if (rawValue === '' || rawValue === '-' || rawValue === '.') value = rawValue;
    else { const n = Number(rawValue); value = isNaN(n) ? rawValue : n; }
  } else { value = rawValue; }
  setNestedValue(state.configs[state.activeFile].current, path, value);
  refreshFieldState(fid);
  updateButtons();
  renderTabs();
}

function onToggle(fid, checked) {
  const { path } = state.fieldMap[fid];
  setNestedValue(state.configs[state.activeFile].current, path, checked);
  refreshFieldState(fid);
  updateButtons();
  renderTabs();
}

function convertNull(fid) {
  const { path } = state.fieldMap[fid];
  setNestedValue(state.configs[state.activeFile].current, path, '');
  state.fieldMap[fid].type = 'str';
  renderEditor();
  updateButtons();
  renderTabs();
}

function onArrayItemInput(fid, index, value) {
  const { path } = state.fieldMap[fid];
  const arr = getNestedValue(state.configs[state.activeFile].current, path);
  arr[index] = value;
  refreshFieldState(fid);
  updateButtons();
  renderTabs();
}

function removeArrayItem(fid, index) {
  const { path } = state.fieldMap[fid];
  getNestedValue(state.configs[state.activeFile].current, path).splice(index, 1);
  renderEditor(); updateButtons(); renderTabs();
}

function addArrayItem(fid) {
  const { path } = state.fieldMap[fid];
  getNestedValue(state.configs[state.activeFile].current, path).push('');
  renderEditor(); updateButtons(); renderTabs();
}

function resetField(fid) {
  const { path } = state.fieldMap[fid];
  const origValue = getNestedValue(state.configs[state.activeFile].original, path);
  setNestedValue(state.configs[state.activeFile].current, path, deepClone(origValue));
  renderEditor(); updateButtons(); renderTabs();
}

function refreshFieldState(fid) {
  const { path } = state.fieldMap[fid];
  const current = getNestedValue(state.configs[state.activeFile].current, path);
  const original = getNestedValue(state.configs[state.activeFile].original, path);
  const mod = !valEqual(current, original);
  const fieldEl = document.querySelector(`.field[data-fid="${fid}"]`);
  if (!fieldEl) return;
  fieldEl.classList.toggle('modified', mod);
  const inp = fieldEl.querySelector('input');
  if (inp) inp.classList.toggle('modified', mod);
  const resetBtn = fieldEl.querySelector('.field-reset');
  if (resetBtn) resetBtn.classList.toggle('visible', mod);
}

// ── Section toggle ─────────────────────────────────────────
function toggleSection(sectionEl) {
  sectionEl.classList.toggle('collapsed');
  const body = sectionEl.querySelector(':scope > .section-body');
  if (!sectionEl.classList.contains('collapsed')) {
    body.style.maxHeight = body.scrollHeight + 'px';
    setTimeout(() => { body.style.maxHeight = 'none'; }, 220);
  } else {
    body.style.maxHeight = body.scrollHeight + 'px';
    requestAnimationFrame(() => { body.style.maxHeight = '0'; });
  }
}

function applySectionHeights() {
  document.querySelectorAll('.section:not(.collapsed) > .section-body').forEach(b => { b.style.maxHeight = 'none'; });
  document.querySelectorAll('.section.collapsed > .section-body').forEach(b => { b.style.maxHeight = '0'; });
}

// ── Search / filter ────────────────────────────────────────
function applySearch() {
  const query = document.getElementById('search').value.toLowerCase().trim();
  document.querySelectorAll('.field').forEach(el => {
    const key = (el.dataset.key || '').toLowerCase();
    const input = el.querySelector('input');
    const val = input ? input.value.toLowerCase() : '';
    el.classList.toggle('hidden', query && !key.includes(query) && !val.includes(query));
  });
  document.querySelectorAll('.section').forEach(sec => {
    if (!query) { sec.style.display = ''; return; }
    const hasVisible = sec.querySelector('.field:not(.hidden)');
    sec.style.display = hasVisible ? '' : 'none';
    if (hasVisible) {
      sec.classList.remove('collapsed');
      const body = sec.querySelector(':scope > .section-body');
      if (body) body.style.maxHeight = 'none';
    }
  });
}

// ── Buttons ────────────────────────────────────────────────
function updateButtons() {
  const mod = isModified(state.activeFile);
  document.getElementById('save-btn').disabled = !mod;
  document.getElementById('reset-btn').disabled = !mod;
}

// ── Save (via postMessage) ─────────────────────────────────
function saveFile() {
  const filename = state.activeFile;
  const config = state.configs[filename];
  if (!config) return;

  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="btn-save-indicator">Saving...</span>';

  vscode.postMessage({ type: 'writeConfig', filename, data: config.current });
}

// ── Reset ──────────────────────────────────────────────────
function resetFile() {
  const config = state.configs[state.activeFile];
  if (!config) return;
  config.current = deepClone(config.original);
  renderEditor(); renderTabs(); updateButtons();
  toast('Reset ' + state.activeFile, 'success');
}

// ── Toast ──────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── Event delegation: config editor ───────────────────────
document.getElementById('config-editor').addEventListener('click', e => {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const { action, fid, index } = target.dataset;
  switch (action) {
    case 'toggle-section': toggleSection(target.closest('.section')); break;
    case 'convert-null':   convertNull(fid); break;
    case 'remove-item':    removeArrayItem(fid, Number(index)); break;
    case 'add-item':       addArrayItem(fid); break;
    case 'reset-field':    resetField(fid); break;
  }
});

document.getElementById('config-editor').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.action === 'toggle') onToggle(t.dataset.fid, t.checked);
});

document.getElementById('config-editor').addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.action === 'input') onInput(t.dataset.fid, t.value);
  else if (t.dataset.action === 'array-input') onArrayItemInput(t.dataset.fid, Number(t.dataset.index), t.value);
});

// ── Event delegation: file tabs ────────────────────────────
document.getElementById('file-tabs').addEventListener('click', e => {
  const tab = e.target.closest('[data-filename]');
  if (tab) selectFile(tab.dataset.filename);
});

// ── Event delegation: theme swatches ──────────────────────
document.getElementById('theme-swatches').addEventListener('click', e => {
  const swatch = e.target.closest('[data-theme]');
  if (swatch) selectTheme(swatch.dataset.theme);
});

// ── Static element listeners ───────────────────────────────
document.getElementById('reset-btn').addEventListener('click', resetFile);
document.getElementById('save-btn').addEventListener('click', saveFile);
document.getElementById('settings-btn').addEventListener('click', toggleSettings);
document.getElementById('settings-overlay').addEventListener('click', toggleSettings);
document.querySelector('.sp-close').addEventListener('click', toggleSettings);

document.getElementById('set-label-font').addEventListener('change', onSettingChange);
document.getElementById('set-field-font').addEventListener('change', onSettingChange);
document.getElementById('set-value-font').addEventListener('change', onSettingChange);
document.getElementById('set-font-size').addEventListener('input', onSettingChange);
document.getElementById('set-label-color').addEventListener('input', onSettingChange);
document.getElementById('set-field-color').addEventListener('input', onSettingChange);
document.getElementById('set-accent-color').addEventListener('input', onSettingChange);
document.getElementById('set-density').addEventListener('change', onSettingChange);
document.getElementById('set-badges').addEventListener('change', onSettingChange);
document.getElementById('set-counts').addEventListener('change', onSettingChange);
document.getElementById('set-autoexpand').addEventListener('change', onSettingChange);
document.getElementById('set-sortkeys').addEventListener('change', onSettingChange);

document.getElementById('export-cli').addEventListener('click', copyAsCLI);
document.getElementById('export-json').addEventListener('click', copyAsJSON);
document.getElementById('export-env').addEventListener('click', copyAsEnv);

document.getElementById('search').addEventListener('input', applySearch);

// ── Keyboard shortcuts ─────────────────────────────────────
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault();
    if (!document.getElementById('save-btn').disabled) saveFile();
  }
  if (e.key === 'Escape') {
    const panel = document.getElementById('settings-panel');
    if (panel.style.display === 'block') toggleSettings();
  }
});

// ── Go ─────────────────────────────────────────────────────
init();
