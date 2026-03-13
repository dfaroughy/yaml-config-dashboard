// ── VSCode API ─────────────────────────────────────────────
const vscode = acquireVsCodeApi();

// ── Polyfill ───────────────────────────────────────────────
const deepClone = typeof structuredClone !== 'undefined'
  ? structuredClone
  : v => JSON.parse(JSON.stringify(v));

// ── Theme definitions ──────────────────────────────────────
const DARK_BADGES = {
  '--badge-str-bg':'#1a3a2a',   '--badge-str-fg':'#3fb950',
  '--badge-float-bg':'#1a2a3a', '--badge-float-fg':'#58a6ff',
  '--badge-int-bg':'#101e30',   '--badge-int-fg':'#89cff0',
  '--badge-bool-bg':'#2a1a3a',  '--badge-bool-fg':'#bc8cff',
  '--badge-null-bg':'#2a2a1a',  '--badge-null-fg':'#d29922',
  '--badge-list-bg':'#2a1a2a',  '--badge-list-fg':'#f778ba',
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
            '--badge-str-bg':'#dcfce7',   '--badge-str-fg':'#15803d',
            '--badge-float-bg':'#dbeafe', '--badge-float-fg':'#1d4ed8',
            '--badge-int-bg':'#e0f2fe',   '--badge-int-fg':'#0369a1',
            '--badge-bool-bg':'#f3e8ff',  '--badge-bool-fg':'#7c3aed',
            '--badge-null-bg':'#fef3c7',  '--badge-null-fg':'#92400e',
            '--badge-list-bg':'#fce7f3',  '--badge-list-fg':'#be185d' }
  },
  desert: {
    label: 'Desert', bg: '#f5f0e8',
    defaults: { labelColor: '#5c3d2e', fieldColor: '#c07050', accentColor: '#c07050' },
    vars: { '--bg-0':'#f5f0e8','--bg-1':'#ede4d3','--bg-2':'#e0d5c0','--bg-3':'#c8bea8',
            '--border':'#c8bea8','--text-0':'#2d1a0e','--text-1':'#5c3d2e','--text-2':'#8b6050',
            '--badge-str-bg':'#e8f4e6',   '--badge-str-fg':'#2a6a2a',
            '--badge-float-bg':'#e6ecf4', '--badge-float-fg':'#1a4878',
            '--badge-int-bg':'#dceef8',   '--badge-int-fg':'#0a3060',
            '--badge-bool-bg':'#f0e8f4',  '--badge-bool-fg':'#5a1880',
            '--badge-null-bg':'#f8f0d8',  '--badge-null-fg':'#7a4a00',
            '--badge-list-bg':'#f4e8f0',  '--badge-list-fg':'#7a1840' }
  },
  sunset: {
    label: 'Sunset', bg: '#fff5f0',
    defaults: { labelColor: '#5c2810', fieldColor: '#d94f2a', accentColor: '#d94f2a' },
    vars: { '--bg-0':'#fff5f0','--bg-1':'#ffe8dc','--bg-2':'#ffd4c0','--bg-3':'#f5bca8',
            '--border':'#e8a890','--text-0':'#2d1008','--text-1':'#5c2810','--text-2':'#a04530',
            '--badge-str-bg':'#e8f4e0',   '--badge-str-fg':'#2a6a10',
            '--badge-float-bg':'#e0ecff', '--badge-float-fg':'#1a3a8a',
            '--badge-int-bg':'#d0e8ff',   '--badge-int-fg':'#0a2060',
            '--badge-bool-bg':'#f4e0f8',  '--badge-bool-fg':'#6a1080',
            '--badge-null-bg':'#fff0c0',  '--badge-null-fg':'#7a4800',
            '--badge-list-bg':'#ffe0f0',  '--badge-list-fg':'#8a1050' }
  },
};

// ── State ──────────────────────────────────────────────────
const state = {
  files: [],
  configs: {},
  activeFile: null,
  fieldMap: {},
  fieldCounter: 0,
  pinned: {},         // { filename: [ path[], ... ] }
  pathToFid: {},      // { JSON(path): fid } rebuilt on each renderEditor
  renderingFile: null, // set while renderNode runs, used by registerField
  _bgLoads: new Set(), // filenames being loaded just to populate pinned bar
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
  autoExpand: true,
  sortKeys: false,
  showSliders: true,
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
    if (prev && prev.settings) {
      settings = { ...defaultSettings, ...prev.settings };
    } else if (prev && prev.userDefaultSettings) {
      settings = { ...defaultSettings, ...prev.userDefaultSettings };
    }
  } catch {}
  applySettings();
  syncSettingsUI();
}

function saveAsUserDefault() {
  vscode.postMessage({ type: 'saveUserDefaults', settings: { ...settings } });
  toast('Saved as your default settings', 'success');
}

function resetToFactoryDefault() {
  settings = { ...defaultSettings };
  applySettings();
  saveSettings();
  syncSettingsUI();
  if (state.activeFile) renderEditor();
  toast('Reset to factory defaults', 'success');
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
  document.getElementById('set-sliders').checked = settings.showSliders;
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
  document.body.classList.toggle('hide-sliders', !settings.showSliders);
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
  settings.showSliders = document.getElementById('set-sliders').checked;

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

// ── Pinned-only export helpers ──────────────────────────────
function buildPinnedLeafPairs() {
  const result = [];
  for (const [file, paths] of Object.entries(state.pinned)) {
    const config = state.configs[file];
    if (!config) continue;
    for (const path of paths) {
      result.push({ key: String(path[path.length - 1]), val: getNestedValue(config.current, path) });
    }
  }
  return result;
}

function buildPinnedNestedObj() {
  const result = {};
  for (const [file, paths] of Object.entries(state.pinned)) {
    const config = state.configs[file];
    if (!config) continue;
    for (const path of paths) {
      const val = getNestedValue(config.current, path);
      let cur = result;
      for (let i = 0; i < path.length - 1; i++) {
        const k = path[i];
        if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
        cur = cur[k];
      }
      cur[path[path.length - 1]] = val;
    }
  }
  return result;
}

function copyPinnedAsCLI() {
  const pairs = buildPinnedLeafPairs();
  if (!pairs.length) { toast('No pinned fields', 'info'); return; }
  const args = pairs.map(({ key, val }) => {
    if (val === null) return `--${key} null`;
    if (val === true) return `--${key} true`;
    if (val === false) return `--${key} false`;
    if (Array.isArray(val)) return `--${key} ${val.join(',')}`;
    return `--${key} ${val}`;
  }).join(' \\\n  ');
  navigator.clipboard.writeText(args);
  toast('Copied CLI args to clipboard', 'success');
}

function copyPinnedAsJSON() {
  const obj = buildPinnedNestedObj();
  navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
  toast('Copied JSON to clipboard', 'success');
}

function copyPinnedAsEnv() {
  const pairs = buildPinnedLeafPairs();
  if (!pairs.length) { toast('No pinned fields', 'info'); return; }
  const envStr = pairs.map(({ key, val }) => {
    const envKey = key.toUpperCase();
    const envVal = Array.isArray(val) ? val.join(',') : String(val);
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
      // Apply persisted user defaults if no session settings exist yet
      if (msg.userDefaultSettings) {
        const prev = vscode.getState();
        if (!prev || !prev.settings) {
          settings = { ...defaultSettings, ...msg.userDefaultSettings };
          applySettings();
          saveSettings();
          syncSettingsUI();
        }
      }
      // Restore pinned fields from global state (persists across panel closes)
      if (msg.pinnedFields && Object.keys(msg.pinnedFields).length > 0) {
        state.pinned = msg.pinnedFields;
        const prev = vscode.getState() || {};
        vscode.setState({ ...prev, pinned: state.pinned });
      }
      renderTabs();
      if (state.files.length > 0) selectFile(state.files[0]);
      // Background-load configs for any pinned files not yet loaded
      for (const file of Object.keys(state.pinned)) {
        if (state.pinned[file].length && !state.configs[file] && file !== state.files[0]) {
          state._bgLoads.add(file);
          vscode.postMessage({ type: 'readConfig', filename: file });
        }
      }
      break;
    }
    case 'configData': {
      if (msg.error) {
        state._bgLoads.delete(msg.filename);
        toast('Error loading: ' + msg.error, 'error');
        return;
      }
      state.configs[msg.filename] = {
        original: deepClone(msg.parsed),
        current: deepClone(msg.parsed),
      };
      if (state._bgLoads.has(msg.filename)) {
        // Background load — just refresh pinned bar, keep active file as-is
        state._bgLoads.delete(msg.filename);
        renderPinnedBar();
      } else {
        state.activeFile = msg.filename;
        renderTabs();
        renderEditor();
        updateButtons();
      }
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
    case 'exportJsonResult': {
      if (msg.success) toast('Exported ' + msg.jsonFilename, 'success');
      else toast('Export failed: ' + (msg.error || 'Unknown'), 'error');
      break;
    }
  }
});

// ── Init ───────────────────────────────────────────────────
function init() {
  buildThemeSwatches();
  loadSettings();
  loadPinned();
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
    let label = f.replace(/\.ya?ml$/, '').replace(/ /g, '_');
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
  state.pathToFid = {};

  const main = document.getElementById('config-editor');
  const config = state.configs[state.activeFile];
  if (!config) { main.innerHTML = ''; return; }

  state.renderingFile = state.activeFile;
  const footerHtml = `<div class="editor-footer">` +
    `<hr class="editor-footer-sep">` +
    `<div class="editor-footer-row">` +
      `<button class="editor-export-btn" data-action="export-json-file" data-filename="${escapeHtml(state.activeFile)}">{} Export as JSON</button>` +
    `</div>` +
  `</div>`;
  main.innerHTML = renderNode(config.current, config.original, []) + footerHtml;
  state.renderingFile = null;

  if (settings.autoExpand) {
    main.querySelectorAll('.section').forEach(s => s.classList.remove('collapsed'));
  } else {
    main.querySelectorAll(':scope > .section').forEach(s => s.classList.remove('collapsed'));
  }
  renderPinnedBar();
  applySectionHeights();
  applySearch();
}

function renderAllFiles() {
  state.fieldMap = {};
  state.fieldCounter = 0;
  state.pathToFid = {};

  const main = document.getElementById('config-editor');
  let html = '';
  for (const file of state.files) {
    const config = state.configs[file];
    if (!config) continue;
    const fileLabel = escapeHtml(file.replace(/\.ya?ml$/i, ''));
    state.renderingFile = file;
    const body = renderNode(config.current, config.original, []);
    html += `<div class="section file-section">` +
      `<div class="section-header" data-action="toggle-section">` +
        `<span class="chevron">▶</span>` +
        `<span class="section-name">${fileLabel}</span>` +
      `</div>` +
      `<div class="section-body">${body}</div>` +
    `</div>`;
  }
  state.renderingFile = null;
  main.innerHTML = html || `<div class="empty-state"><p>No configs loaded</p></div>`;
  main.querySelectorAll('.section').forEach(s => s.classList.remove('collapsed'));
  applySectionHeights();
}

function registerField(path, type) {
  const id = 'f' + (state.fieldCounter++);
  const file = state.renderingFile || state.activeFile;
  state.fieldMap[id] = { path: [...path], type, file };
  if (file === state.activeFile) {
    state.pathToFid[JSON.stringify(path)] = id;
  }
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
  const type = typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? (Number.isInteger(value) ? 'int' : 'float') : 'str';
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
      const dispKey = escapeHtml(String(key));
      const hasNested = Object.values(val).some(v => v !== null && typeof v === 'object');
      const collapseBtn = hasNested ? `<button class="section-collapse-btn" data-action="toggle-subsections"><span class="scb-minus">[-]</span><span class="scb-plus">[+]</span></button>` : '';
      html += `<div class="section collapsed">
        <div class="section-header" data-action="toggle-section">
          <span class="chevron">&#9654;</span>
          <span class="section-name">${dispKey}</span>
          <span class="section-count">${childCount}</span>
          ${collapseBtn}
        </div>
        <div class="section-body">${renderObjectNode(val, orig, childPath)}</div>
      </div>`;
    } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null) {
      const dispKey = escapeHtml(String(key));
      html += `<div class="section collapsed">
        <div class="section-header" data-action="toggle-section">
          <span class="chevron">&#9654;</span>
          <span class="section-name">${dispKey}</span>
          <span class="section-count">${val.length} items</span>
          <button class="section-collapse-btn" data-action="toggle-subsections"><span class="scb-minus">[-]</span><span class="scb-plus">[+]</span></button>
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
    const label = escapeHtml(String(item.name || item.fn_key || `[${i}]`));
    const childCount = Object.keys(item).length;
    html += `<div class="section collapsed">
      <div class="section-header" data-action="toggle-section">
        <span class="chevron">&#9654;</span>
        <span class="section-name">${label}</span>
        <span class="section-count">${childCount}</span>
        <button class="section-collapse-btn" data-action="toggle-subsections"><span class="scb-minus">[-]</span><span class="scb-plus">[+]</span></button>
      </div>
      <div class="section-body">${renderObjectNode(item, origItem, [...path, i])}</div>
    </div>`;
  }
  return html;
}

function renderScalarField(path, value, original, type) {
  const key = path[path.length - 1];
  const dispKey = escapeHtml(String(key));
  const fid = registerField(path, type);
  const mod = !valEqual(value, original) ? ' modified' : '';
  const resetVisible = mod ? ' visible' : '';

  const isNum = type === 'int' || type === 'float';
  let inputHtml;
  if (type === 'bool') {
    const checked = value ? ' checked' : '';
    inputHtml = `<label class="toggle">
      <input type="checkbox" id="${fid}"${checked} data-action="toggle" data-fid="${fid}">
      <span class="toggle-slider"></span>
    </label>`;
  } else if (type === 'null') {
    inputHtml = `<span class="null-badge" data-action="convert-null" data-fid="${fid}" title="Click to set a value">null</span>`;
  } else {
    inputHtml = `<input type="text" id="${fid}" value="${escapeHtml(String(value))}" class="${mod ? 'modified' : ''}" data-action="input" data-fid="${fid}">`;
  }

  const typeBadge = `<span class="type-badge type-${type}">${type}</span>`;
  const origTitle = original !== undefined ? ` title="Original: ${escapeHtml(String(original))}"` : '';
  const origNum = typeof original === 'number' ? original : value;
  const sliderHtml = (isNum && isSliderField(origNum)) ? buildSliderHtml(fid, value, origNum) : '';

  return `<div class="field${mod}" data-fid="${fid}" data-key="${escapeHtml(String(key))}"${origTitle}>
    <span class="field-key">${dispKey} ${typeBadge}</span>
    <span class="field-input">${inputHtml}</span>
    ${sliderHtml}
    ${buildPinBtn(fid)}
    <button class="field-reset${resetVisible}" data-action="reset-field" data-fid="${fid}" title="Reset to original">&#8635;</button>
  </div>`;
}

function renderScalarArrayField(path, value, original) {
  const key = path[path.length - 1];
  const dispKey = escapeHtml(String(key));
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
    ${buildPinBtn(fid)}
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

// ── Pin button helpers ──────────────────────────────────────
const PIN_ICON_SVG = `<svg class="pin-icon" width="9" height="12" viewBox="0 0 9 12" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="4.5" cy="4" r="3"/><line x1="4.5" y1="7" x2="4.5" y2="11.5"/></svg>`;

function buildPinBtn(fid) {
  const entry = state.fieldMap[fid];
  const pinned = entry ? isPinnedPath(entry.path) : false;
  const label = pinned ? 'unpin' : 'pin';
  const cls = pinned ? ' pinned' : '';
  return `<button class="pin-btn${cls}" data-action="pin-field" data-fid="${fid}" title="${label}">${PIN_ICON_SVG}${label}</button>`;
}

function refreshPinButtons() {
  document.querySelectorAll('.pin-btn[data-fid]').forEach(btn => {
    const entry = state.fieldMap[btn.dataset.fid];
    const pinned = entry ? isPinnedPath(entry.path) : false;
    btn.classList.toggle('pinned', pinned);
    btn.title = pinned ? 'unpin' : 'pin';
    btn.childNodes[1].textContent = pinned ? 'unpin' : 'pin';
  });
}

// ── Pinned fields ───────────────────────────────────────────
function loadPinned() {
  const prev = vscode.getState();
  if (prev && prev.pinned) state.pinned = prev.pinned;
}

function savePinned() {
  const prev = vscode.getState() || {};
  vscode.setState({ ...prev, pinned: state.pinned });
  vscode.postMessage({ type: 'savePinned', pinned: state.pinned });
}

function pathKey(path) { return JSON.stringify(path); }

function isPinnedPath(path) {
  const pins = state.pinned[state.activeFile] || [];
  const k = pathKey(path);
  return pins.some(p => pathKey(p) === k);
}

function pinField(path) {
  if (!state.pinned[state.activeFile]) state.pinned[state.activeFile] = [];
  if (isPinnedPath(path)) return;
  state.pinned[state.activeFile].push([...path]);
  savePinned();
  renderPinnedBar();
  refreshPinButtons();
}

function unpinField(path) {
  const k = pathKey(path);
  for (const file of Object.keys(state.pinned)) {
    state.pinned[file] = state.pinned[file].filter(p => pathKey(p) !== k);
  }
  savePinned();
  renderPinnedBar();
  refreshPinButtons();
}

function renderPinnedBar() {
  const bar = document.getElementById('pinned-bar');
  const cards = [];
  for (const [file, paths] of Object.entries(state.pinned)) {
    for (const path of paths) {
      const config = state.configs[file];
      cards.push({
        file,
        path,
        value: config ? getNestedValue(config.current, path) : undefined,
        origValue: config ? getNestedValue(config.original, path) : undefined,
        loaded: !!config,
      });
    }
  }

  if (!cards.length) { bar.innerHTML = ''; return; }

  const rowsHtml = cards.map(({ file, path, value, origValue, loaded }) => {
    const fileLabel = escapeHtml(file.replace(/\.ya?ml$/i, ''));
    const leafKey = escapeHtml(String(path[path.length - 1]));
    const pData = escapeHtml(JSON.stringify(path));
    const fData = escapeHtml(file);
    const modified = loaded && !valEqual(value, origValue);
    const modCls = modified ? ' pin-modified' : '';

    // Breadcrumb: fold numeric indices into previous segment as [n]
    const crumbParts = [fileLabel];
    for (const seg of path.slice(0, -1)) {
      if (typeof seg === 'number') {
        crumbParts[crumbParts.length - 1] += `[${seg}]`;
      } else {
        crumbParts.push(escapeHtml(String(seg)));
      }
    }
    const crumb = crumbParts.join('<span class="pin-crumb-sep"> › </span>');

    let valueHtml;
    if (!loaded) {
      valueHtml = `<span class="pin-unloaded">—</span>`;
    } else if (typeof value === 'boolean') {
      valueHtml =
        `<label class="pin-toggle-wrap">` +
          `<input type="checkbox"${value ? ' checked' : ''} data-pf="${fData}" data-pp="${pData}" data-pa="toggle">` +
          `<span class="pin-track"></span>` +
        `</label>`;
    } else if (value === null || value === undefined) {
      valueHtml = `<span class="pin-null">null</span>`;
    } else if (typeof value === 'number' && typeof origValue === 'number') {
      const sliderHtml = buildPinSliderHtml(fData, pData, value, origValue);
      valueHtml =
        `<input class="pin-val-input${modCls}" type="text" value="${escapeHtml(String(value))}"` +
          ` data-pf="${fData}" data-pp="${pData}" data-pa="input">` +
        sliderHtml;
    } else {
      valueHtml =
        `<input class="pin-val-input${modCls}" type="text" value="${escapeHtml(String(value))}"` +
          ` data-pf="${fData}" data-pp="${pData}" data-pa="input">`;
    }

    return `<div class="pin-row${modCls}">` +
      `<div class="pin-crumb">${crumb}</div>` +
      `<div class="pin-field-line">` +
        `<span class="pin-name">${leafKey}</span>` +
        valueHtml +
        `<button class="unpin-btn" data-pf="${fData}" data-pp="${pData}" data-pa="unpin" title="Unpin">&#215;</button>` +
      `</div>` +
    `</div>`;
  }).join('');

  const exportRow = `<div class="pin-export-row">` +
    `<div class="pin-export-btn-wrap"><button class="pin-export-btn" id="pin-exp-cli">&gt;_</button><span class="pin-tip">CLI args</span></div>` +
    `<div class="pin-export-btn-wrap"><button class="pin-export-btn" id="pin-exp-json">{}</button><span class="pin-tip">Flat JSON</span></div>` +
    `<div class="pin-export-btn-wrap"><button class="pin-export-btn" id="pin-exp-env">$</button><span class="pin-tip">Env vars</span></div>` +
  `</div>`;

  bar.innerHTML =
    `<div class="pin-header-row">` +
      `<span class="pin-header">pinned</span>` +
      `<button class="pin-clear-btn" id="pin-clear-all" title="Remove all">&#215;</button>` +
    `</div>` +
    rowsHtml + exportRow;
  document.getElementById('pin-clear-all').addEventListener('click', () => {
    state.pinned = {};
    savePinned();
    renderPinnedBar();
    refreshPinButtons();
  });
  document.getElementById('pin-exp-cli').addEventListener('click', copyPinnedAsCLI);
  document.getElementById('pin-exp-json').addEventListener('click', copyPinnedAsJSON);
  document.getElementById('pin-exp-env').addEventListener('click', copyPinnedAsEnv);
}

function buildPinSliderHtml(fData, pData, currentVal, origVal) {
  if (Number.isInteger(origVal)) {
    const v = origVal;
    const startPow2 = isPow2Int(v);
    let sliderMin, sliderMax, sliderStep, sliderVal, sliderMode, tickHtml;
    if (startPow2) {
      const n = Math.round(Math.log2(v));
      sliderMin = Math.max(0, n - 5); sliderMax = n + 5; sliderStep = 1; sliderMode = 'pow2';
      sliderVal = (typeof currentVal === 'number' && currentVal > 0)
        ? Math.max(sliderMin, Math.min(sliderMax, Math.round(Math.log2(currentVal)))) : n;
      tickHtml = buildTickRuler(sliderMin, sliderMax, 'pow2');
    } else {
      const span = Math.abs(v) || 10;
      sliderMin = v >= 0 ? 0 : v - span; sliderMax = v + span;
      const intTicks = buildIntTickRuler(sliderMin, sliderMax);
      sliderStep = intTicks.step; sliderMode = 'int';
      sliderVal = Math.max(sliderMin, Math.min(sliderMax, typeof currentVal === 'number'
        ? Math.round(currentVal / sliderStep) * sliderStep : v));
      tickHtml = intTicks.html;
    }
    const log2Toggle = v >= 0
      ? `<label class="log-toggle-wrap" title="Log₂ scale">` +
          `<input type="checkbox" data-pa="pin-log2-cb" data-pf="${fData}" data-pp="${pData}"${startPow2 ? ' checked' : ''}>` +
          `<span class="log-track"></span><span class="log-label">log₂</span>` +
        `</label>`
      : '';
    return `<div class="num-slider-wrap">` +
      `<div class="pin-slider-col">` +
        `<input type="range" class="num-slider" data-pa="pin-slider"` +
          ` data-pf="${fData}" data-pp="${pData}" data-mode="${sliderMode}" data-orig="${v}"` +
          ` min="${sliderMin}" max="${sliderMax}" step="${sliderStep}" value="${sliderVal}">` +
        tickHtml +
      `</div>` +
      log2Toggle +
    `</div>`;
  }
  const v = origVal;
  const span = Math.abs(v) || 1;
  const min = v - span, max = v + span;
  const step = (2 * span) / 100;
  const val = Math.max(min, Math.min(max, currentVal));
  const logToggle = v > 0
    ? `<label class="log-toggle-wrap" title="Log scale">` +
        `<input type="checkbox" data-pa="pin-log-cb" data-pf="${fData}" data-pp="${pData}">` +
        `<span class="log-track"></span><span class="log-label">log</span>` +
      `</label>`
    : '';
  return `<div class="num-slider-wrap">` +
    `<div class="pin-slider-col">` +
      `<input type="range" class="num-slider" data-pa="pin-slider"` +
        ` data-pf="${fData}" data-pp="${pData}" data-mode="linear" data-orig="${v}"` +
        ` min="${min}" max="${max}" step="${step}" value="${val}">` +
      buildTickRuler(min, max, 'float') +
    `</div>` +
    logToggle +
  `</div>`;
}

// ── Numeric slider helpers ──────────────────────────────────
function isPow2Int(v) {
  return Number.isInteger(v) && v > 0 && (v & (v - 1)) === 0;
}

function isSliderField(origVal) {
  return typeof origVal === 'number';
}

function fmtTickLabel(v, mode) {
  if (mode === 'pow2') return v === 0 ? '1' : '2^' + v;
  if (!isFinite(v)) return '?';
  const abs = Math.abs(v);
  if (abs >= 10000) return (v / 1000).toFixed(0) + 'k';
  if (abs >= 100 || Number.isInteger(v)) return v.toFixed(0);
  if (abs >= 10) return v.toFixed(1);
  return parseFloat(v.toPrecision(2)).toString();
}

function buildTickRuler(minVal, maxVal, mode) {
  const W = 100;
  let lines = '';
  if (mode === 'pow2') {
    // One tick per integer exponent (these are the actual snap positions)
    const range = maxVal - minVal;
    for (let n = Math.ceil(minVal); n <= Math.floor(maxVal); n++) {
      const x = parseFloat(((n - minVal) / range * W).toFixed(2));
      lines += `<line x1="${x}" y1="0" x2="${x}" y2="4" stroke="currentColor" stroke-width="0.3"/>`;
    }
  } else {
    const nMajor = 10, nMinor = 4, total = nMajor * nMinor;
    for (let i = 0; i <= total; i++) {
      const x = parseFloat(((i / total) * W).toFixed(2));
      const big = i % nMinor === 0;
      lines += `<line x1="${x}" y1="0" x2="${x}" y2="${big ? 4 : 2}" stroke="currentColor" stroke-width="0.3"/>`;
    }
  }
  return `<div class="slider-ruler">` +
    `<svg class="tick-svg" viewBox="0 0 ${W} 5" preserveAspectRatio="none">${lines}</svg>` +
    `<div class="tick-labels">` +
    `<span>${fmtTickLabel(minVal, mode)}</span>` +
    `<span>${fmtTickLabel(maxVal, mode)}</span>` +
    `</div></div>`;
}

function buildLogTickRuler(logMin, logMax) {
  const realMin = Math.exp(logMin);
  const realMax = Math.exp(logMax);
  const logRange = logMax - logMin;
  const W = 100;
  const minExp = Math.floor(Math.log10(realMin));
  const maxExp = Math.ceil(Math.log10(realMax));
  let lines = '';
  for (let e = minExp; e <= maxExp; e++) {
    for (const [m, big] of [[1,true],[2,false],[3,false],[4,false],[5,false],[6,false],[7,false],[8,false],[9,false]]) {
      const v = m * Math.pow(10, e);
      if (v < realMin * 0.999 || v > realMax * 1.001) continue;
      const x = parseFloat(((Math.log(v) - logMin) / logRange * W).toFixed(2));
      lines += `<line x1="${x}" y1="0" x2="${x}" y2="${big ? 4 : 2}" stroke="currentColor" stroke-width="0.3"/>`;
    }
  }
  return `<div class="slider-ruler">` +
    `<svg class="tick-svg" viewBox="0 0 ${W} 5" preserveAspectRatio="none">${lines}</svg>` +
    `<div class="tick-labels">` +
    `<span>${fmtTickLabel(realMin, 'float')}</span>` +
    `<span>${fmtTickLabel(realMax, 'float')}</span>` +
    `</div></div>`;
}

function niceIntStep(range) {
  if (range <= 0) return 1;
  const raw = range / 8;
  const candidates = [1, 2, 4, 5, 8, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  for (const c of candidates) if (c >= raw) return c;
  return candidates[candidates.length - 1];
}

function buildIntTickRuler(min, max) {
  const range = max - min;
  const step = niceIntStep(range);
  const ticks = [];
  const first = Math.ceil(min / step) * step;
  for (let v = first; v <= max; v += step) ticks.push(v);
  if (!ticks.length || ticks[0] > min) ticks.unshift(min);
  if (ticks[ticks.length - 1] < max) ticks.push(max);
  const W = 100;
  let lines = '';
  for (const v of ticks) {
    const x = parseFloat(((v - min) / range * W).toFixed(2));
    lines += `<line x1="${x}" y1="0" x2="${x}" y2="4" stroke="currentColor" stroke-width="0.3"/>`;
  }
  return {
    step,
    html: `<div class="slider-ruler">` +
      `<svg class="tick-svg" viewBox="0 0 ${W} 5" preserveAspectRatio="none">${lines}</svg>` +
      `<div class="tick-labels"><span>${fmtTickLabel(min, 'float')}</span><span>${fmtTickLabel(max, 'float')}</span></div>` +
      `</div>`
  };
}

function buildSliderHtml(fid, currentVal, origVal) {
  // All integers: discrete snap slider with optional log₂ toggle
  if (Number.isInteger(origVal)) {
    const v = origVal;
    const startPow2 = isPow2Int(v);
    let sliderMin, sliderMax, sliderStep, sliderVal, sliderMode, tickHtml;
    if (startPow2) {
      const n = Math.round(Math.log2(v));
      sliderMin = Math.max(0, n - 5);
      sliderMax = n + 5;
      sliderStep = 1;
      sliderMode = 'pow2';
      sliderVal = (typeof currentVal === 'number' && currentVal > 0)
        ? Math.max(sliderMin, Math.min(sliderMax, Math.round(Math.log2(currentVal)))) : n;
      tickHtml = buildTickRuler(sliderMin, sliderMax, 'pow2');
    } else {
      const span = Math.abs(v) || 10;
      sliderMin = v >= 0 ? 0 : v - span;
      sliderMax = v + span;
      const intTicks = buildIntTickRuler(sliderMin, sliderMax);
      sliderStep = intTicks.step;
      sliderMode = 'int';
      sliderVal = Math.max(sliderMin, Math.min(sliderMax, typeof currentVal === 'number'
        ? Math.round(currentVal / sliderStep) * sliderStep : v));
      tickHtml = intTicks.html;
    }
    const log2Toggle = v >= 0
      ? `<label class="log-toggle-wrap" title="Log₂ scale">
          <input type="checkbox" data-action="toggle-log2-cb" data-fid="${fid}"${startPow2 ? ' checked' : ''}>
          <span class="log-track"></span>
          <span class="log-label">log₂</span>
        </label>`
      : '';
    return `<div class="num-slider-wrap">
      <div class="slider-col">
        <input type="range" class="num-slider" data-action="num-slider"
          data-fid="${fid}" data-mode="${sliderMode}" data-orig="${v}"
          min="${sliderMin}" max="${sliderMax}" step="${sliderStep}" value="${sliderVal}">
        ${tickHtml}
      </div>
      ${log2Toggle}
    </div>`;
  }
  // float — linear by default, log toggle if positive
  const v = origVal;
  const span = Math.abs(v) || 1;
  const min = v - span;
  const max = v + span;
  const step = (2 * span) / 100;
  const cur = Math.max(min, Math.min(max, typeof currentVal === 'number' ? currentVal : v));
  const logToggle = v > 0
    ? `<label class="log-toggle-wrap" title="Log scale">
        <input type="checkbox" data-action="toggle-log-cb" data-fid="${fid}">
        <span class="log-track"></span>
        <span class="log-label">log</span>
      </label>`
    : '';
  return `<div class="num-slider-wrap">
    <div class="slider-col">
      <input type="range" class="num-slider" data-action="num-slider"
        data-fid="${fid}" data-mode="linear" data-orig="${v}"
        min="${min}" max="${max}" step="${step}" value="${cur}">
      ${buildTickRuler(min, max, 'float')}
    </div>
    ${logToggle}
  </div>`;
}

function syncSlider(fid, numVal) {
  const slider = document.querySelector(`.num-slider[data-fid="${fid}"]`);
  if (!slider || typeof numVal !== 'number' || isNaN(numVal)) return;
  const mode = slider.dataset.mode;
  const min = parseFloat(slider.min), max = parseFloat(slider.max);
  let sv;
  if (mode === 'pow2')        sv = numVal > 0 ? Math.round(Math.log2(numVal)) : min;
  else if (mode === 'log')    sv = numVal > 0 ? Math.log(numVal) : min;
  else if (mode === 'int')    sv = Math.round(numVal);
  else                        sv = numVal;
  slider.value = Math.max(min, Math.min(max, sv));
}

function onSliderInput(slider) {
  const { fid, mode } = slider.dataset;
  const sv = parseFloat(slider.value);
  let val;
  if (mode === 'pow2')        val = Math.pow(2, Math.round(sv));
  else if (mode === 'log')    val = parseFloat(Math.exp(sv).toPrecision(4));
  else if (mode === 'int')    val = Math.round(sv);
  else                        val = parseFloat(sv.toPrecision(6));
  const input = document.getElementById(fid);
  if (input) input.value = String(val);
  const { path } = state.fieldMap[fid];
  setNestedValue(state.configs[state.activeFile].current, path, val);
  refreshFieldState(fid);
  updateButtons();
  renderTabs();
}

function replaceRuler(sliderCol, newHtml) {
  const tmp = document.createElement('div');
  tmp.innerHTML = newHtml;
  const oldRuler = sliderCol.querySelector('.slider-ruler');
  if (oldRuler) oldRuler.replaceWith(tmp.firstElementChild);
  else sliderCol.appendChild(tmp.firstElementChild);
}

function toggleLogScale(cb) {
  const { fid } = cb.dataset;
  const sliderCol = cb.closest('.num-slider-wrap').querySelector('.slider-col');
  const slider = sliderCol.querySelector('.num-slider');
  const origVal = parseFloat(slider.dataset.orig);
  const textInput = document.getElementById(fid);
  const curVal = textInput ? parseFloat(textInput.value) : origVal;
  if (cb.checked) {
    slider.dataset.mode = 'log';
    const logMin = Math.log(origVal / 10);
    const logMax = Math.log(origVal * 10);
    slider.min = logMin; slider.max = logMax;
    slider.step = (logMax - logMin) / 100;
    slider.value = curVal > 0 ? Math.log(curVal) : logMin;
    replaceRuler(sliderCol, buildLogTickRuler(logMin, logMax));
  } else {
    slider.dataset.mode = 'linear';
    const span = Math.abs(origVal) || 1;
    const linMin = origVal - span, linMax = origVal + span;
    slider.min = linMin; slider.max = linMax;
    slider.step = (2 * span) / 100;
    slider.value = Math.max(linMin, Math.min(linMax, curVal));
    replaceRuler(sliderCol, buildTickRuler(linMin, linMax, 'float'));
  }
}

function toggleLog2Scale(cb) {
  const { fid } = cb.dataset;
  const sliderCol = cb.closest('.num-slider-wrap').querySelector('.slider-col');
  const slider = sliderCol.querySelector('.num-slider');
  const origVal = parseInt(slider.dataset.orig);
  const textInput = document.getElementById(fid);
  const curVal = textInput ? Number(textInput.value) : origVal;
  if (cb.checked) {
    const refN = curVal > 0 ? Math.round(Math.log2(curVal))
               : origVal > 0 ? Math.round(Math.log2(origVal)) : 3;
    const minN = Math.max(0, refN - 5);
    const maxN = refN + 5;
    const curN = curVal > 0 ? Math.max(minN, Math.min(maxN, Math.round(Math.log2(curVal)))) : minN;
    slider.dataset.mode = 'pow2';
    slider.min = minN; slider.max = maxN; slider.step = 1; slider.value = curN;
    replaceRuler(sliderCol, buildTickRuler(minN, maxN, 'pow2'));
  } else {
    slider.dataset.mode = 'int';
    const span = Math.abs(origVal) || 10;
    const min = origVal >= 0 ? 0 : origVal - span;
    const max = origVal + span;
    const intTicks = buildIntTickRuler(min, max);
    slider.min = min; slider.max = max; slider.step = intTicks.step;
    slider.value = Math.max(min, Math.min(max, Math.round(curVal / intTicks.step) * intTicks.step));
    replaceRuler(sliderCol, intTicks.html);
  }
}

// ── Input handlers ─────────────────────────────────────────
function onInput(fid, rawValue) {
  const { path, type, file } = state.fieldMap[fid];
  let value;
  const isNum = type === 'int' || type === 'float';
  if (isNum) {
    if (rawValue === '' || rawValue === '-' || rawValue === '.') value = rawValue;
    else { const n = Number(rawValue); value = isNaN(n) ? rawValue : n; }
  } else { value = rawValue; }
  setNestedValue(state.configs[file].current, path, value);
  if (isNum) syncSlider(fid, typeof value === 'number' ? value : NaN);
  refreshFieldState(fid);
  updateButtons();
  renderTabs();
}

function onToggle(fid, checked) {
  const { path, file } = state.fieldMap[fid];
  setNestedValue(state.configs[file].current, path, checked);
  refreshFieldState(fid);
  updateButtons();
  renderTabs();
}

function convertNull(fid) {
  const { path, file } = state.fieldMap[fid];
  setNestedValue(state.configs[file].current, path, '');
  state.fieldMap[fid].type = 'str';
  renderEditor();
  updateButtons();
  renderTabs();
}

function onArrayItemInput(fid, index, value) {
  const { path, file } = state.fieldMap[fid];
  const arr = getNestedValue(state.configs[file].current, path);
  arr[index] = value;
  refreshFieldState(fid);
  updateButtons();
  renderTabs();
}

function removeArrayItem(fid, index) {
  const { path, file } = state.fieldMap[fid];
  getNestedValue(state.configs[file].current, path).splice(index, 1);
  renderEditor(); updateButtons(); renderTabs();
}

function addArrayItem(fid) {
  const { path, file } = state.fieldMap[fid];
  getNestedValue(state.configs[file].current, path).push('');
  renderEditor(); updateButtons(); renderTabs();
}

function resetField(fid) {
  const { path, file } = state.fieldMap[fid];
  const origValue = getNestedValue(state.configs[file].original, path);
  setNestedValue(state.configs[file].current, path, deepClone(origValue));
  renderEditor(); updateButtons(); renderTabs();
}

function refreshFieldState(fid) {
  const { path, file } = state.fieldMap[fid];
  const current = getNestedValue(state.configs[file].current, path);
  const original = getNestedValue(state.configs[file].original, path);
  const mod = !valEqual(current, original);
  const fieldEl = document.querySelector(`.field[data-fid="${fid}"]`);
  if (!fieldEl) return;
  fieldEl.classList.toggle('modified', mod);
  const inp = fieldEl.querySelector('input[data-action="input"]');
  if (inp) inp.classList.toggle('modified', mod);
  const resetBtn = fieldEl.querySelector('.field-reset');
  if (resetBtn) resetBtn.classList.toggle('visible', mod);

  // Live badge update: detect int ↔ float transitions as the user types
  const curType = state.fieldMap[fid].type;
  if ((curType === 'int' || curType === 'float') && inp) {
    const raw = inp.value;
    const parsed = Number(raw);
    if (!isNaN(parsed) && raw.trim() !== '') {
      const newType = (raw.includes('.') || raw.toLowerCase().includes('e')) ? 'float' : 'int';
      if (newType !== curType) {
        state.fieldMap[fid].type = newType;
        const badge = fieldEl.querySelector('.type-badge');
        if (badge) { badge.className = `type-badge type-${newType}`; badge.textContent = newType; }
      }
    }
  }
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

function toggleSubsections(sectionEl) {
  const body = sectionEl.querySelector(':scope > .section-body');
  if (!body) return;
  const children = Array.from(body.querySelectorAll(':scope > .section'));
  if (!children.length) return;
  const anyExpanded = children.some(s => !s.classList.contains('collapsed'));
  children.forEach(s => {
    s.classList.toggle('collapsed', anyExpanded);
    const b = s.querySelector(':scope > .section-body');
    if (b) b.style.maxHeight = anyExpanded ? '0' : 'none';
  });
  sectionEl.classList.toggle('subsecs-hidden', anyExpanded);
}

function applySectionHeights() {
  document.querySelectorAll('.section:not(.collapsed) > .section-body').forEach(b => { b.style.maxHeight = 'none'; });
  document.querySelectorAll('.section.collapsed > .section-body').forEach(b => { b.style.maxHeight = '0'; });
}

// ── Search / filter ────────────────────────────────────────
function applySearch() {
  const query = document.getElementById('search').value.toLowerCase().trim();
  const wasMulti = state._searchMulti;
  if (!query) {
    if (wasMulti) { state._searchMulti = false; renderEditor(); return; }
    document.querySelectorAll('.field').forEach(el => el.classList.remove('hidden'));
    document.querySelectorAll('.section').forEach(sec => { sec.style.display = ''; });
    return;
  }
  if (!wasMulti) {
    state._searchMulti = true;
    renderAllFiles();
  }
  document.querySelectorAll('.field').forEach(el => {
    const key = (el.dataset.key || '').toLowerCase();
    const input = el.querySelector('input');
    const val = input ? input.value.toLowerCase() : '';
    el.classList.toggle('hidden', !key.includes(query) && !val.includes(query));
  });
  document.querySelectorAll('.section').forEach(sec => {
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
  const activeMod = isModified(state.activeFile);
  const anyMod = state.files.some(f => state.configs[f] && isModified(f));
  document.getElementById('save-btn').disabled = !anyMod;
  document.getElementById('reset-btn').disabled = !activeMod;
  const indicator = document.querySelector('.btn-save-indicator');
  if (indicator) {
    const n = state.files.filter(f => state.configs[f] && isModified(f)).length;
    indicator.textContent = n > 1 ? `Save all (${n})` : 'Save';
  }
}

// ── Save (via postMessage) ─────────────────────────────────
function saveFile() {
  const modifiedFiles = state.files.filter(f => state.configs[f] && isModified(f));
  if (!modifiedFiles.length) return;

  const saveBtn = document.getElementById('save-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="btn-save-indicator">Saving...</span>';

  for (const filename of modifiedFiles) {
    vscode.postMessage({ type: 'writeConfig', filename, data: state.configs[filename].current });
  }
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
    case 'toggle-section':      toggleSection(target.closest('.section')); break;
    case 'toggle-subsections':  toggleSubsections(target.closest('.section')); break;
    case 'convert-null':     convertNull(fid); break;
    case 'remove-item':      removeArrayItem(fid, Number(index)); break;
    case 'add-item':         addArrayItem(fid); break;
    case 'reset-field':      resetField(fid); break;
    case 'pin-field': {
      const entry = state.fieldMap[fid];
      if (entry) {
        if (isPinnedPath(entry.path)) unpinField(entry.path);
        else pinField(entry.path);
      }
      break;
    }
    case 'export-json-file': {
      const filename = target.dataset.filename;
      const cfg = state.configs[filename];
      if (cfg) vscode.postMessage({ type: 'exportJson', filename, data: cfg.current });
      break;
    }
  }
});

document.getElementById('config-editor').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.action === 'toggle') onToggle(t.dataset.fid, t.checked);
  else if (t.dataset.action === 'toggle-log-cb') toggleLogScale(t);
  else if (t.dataset.action === 'toggle-log2-cb') toggleLog2Scale(t);
});

document.getElementById('config-editor').addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.action === 'input') onInput(t.dataset.fid, t.value);
  else if (t.dataset.action === 'array-input') onArrayItemInput(t.dataset.fid, Number(t.dataset.index), t.value);
  else if (t.dataset.action === 'num-slider') onSliderInput(t);
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

// ── Pinned bar event handlers ───────────────────────────────
document.getElementById('pinned-bar').addEventListener('input', e => {
  const t = e.target;
  const file = t.dataset.pf;
  const pa = t.dataset.pa;
  if (pa !== 'input' && pa !== 'pin-slider') return;
  const path = JSON.parse(t.dataset.pp);
  if (!state.configs[file]) return;

  let val;
  if (pa === 'pin-slider') {
    const mode = t.dataset.mode;
    const sv = parseFloat(t.value);
    val = (mode === 'int') ? Math.round(sv) : parseFloat(sv.toPrecision(6));
    // sync text input in same row
    const textInp = t.closest('.pin-row').querySelector('.pin-val-input');
    if (textInp) textInp.value = String(val);
  } else {
    const cur = getNestedValue(state.configs[file].current, path);
    const raw = t.value;
    val = typeof cur === 'number' ? (isNaN(Number(raw)) ? raw : Number(raw)) : raw;
    // sync pin slider in same row
    const pinSlider = t.closest('.pin-row').querySelector('.num-slider[data-pa="pin-slider"]');
    if (pinSlider && typeof val === 'number') {
      const mode = pinSlider.dataset.mode;
      const min = parseFloat(pinSlider.min), max = parseFloat(pinSlider.max), step = parseFloat(pinSlider.step);
      pinSlider.value = Math.max(min, Math.min(max, mode === 'int' ? Math.round(val / step) * step : val));
    }
  }

  setNestedValue(state.configs[file].current, path, val);
  const mod = !valEqual(val, getNestedValue(state.configs[file].original, path));
  t.classList.toggle('pin-modified', mod);
  t.closest('.pin-row').classList.toggle('pin-modified', mod);
  if (file === state.activeFile) {
    const fid = state.pathToFid[pathKey(path)];
    if (fid) {
      const inp = document.getElementById(fid);
      if (inp) inp.value = String(val);
      syncSlider(fid, typeof val === 'number' ? val : NaN);
      refreshFieldState(fid);
    }
    updateButtons(); renderTabs();
  }
});

document.getElementById('pinned-bar').addEventListener('change', e => {
  const t = e.target;
  const pa = t.dataset.pa;
  if (pa === 'toggle') {
    const file = t.dataset.pf;
    const path = JSON.parse(t.dataset.pp);
    if (!state.configs[file]) return;
    setNestedValue(state.configs[file].current, path, t.checked);
    if (file === state.activeFile) {
      const fid = state.pathToFid[pathKey(path)];
      if (fid) refreshFieldState(fid);
      updateButtons(); renderTabs();
    }
  } else if (pa === 'pin-log-cb') {
    const pinRow = t.closest('.pin-row');
    const sliderCol = pinRow.querySelector('.pin-slider-col');
    const slider = sliderCol.querySelector('.num-slider');
    const origVal = parseFloat(slider.dataset.orig);
    const textInput = pinRow.querySelector('.pin-val-input');
    const curVal = textInput ? parseFloat(textInput.value) : origVal;
    if (t.checked) {
      slider.dataset.mode = 'log';
      const logMin = Math.log(origVal / 10), logMax = Math.log(origVal * 10);
      slider.min = logMin; slider.max = logMax; slider.step = (logMax - logMin) / 100;
      slider.value = curVal > 0 ? Math.log(curVal) : logMin;
      replaceRuler(sliderCol, buildLogTickRuler(logMin, logMax));
    } else {
      slider.dataset.mode = 'linear';
      const span = Math.abs(origVal) || 1;
      const linMin = origVal - span, linMax = origVal + span;
      slider.min = linMin; slider.max = linMax; slider.step = (2 * span) / 100;
      slider.value = Math.max(linMin, Math.min(linMax, curVal));
      replaceRuler(sliderCol, buildTickRuler(linMin, linMax, 'float'));
    }
  } else if (pa === 'pin-log2-cb') {
    const pinRow = t.closest('.pin-row');
    const sliderCol = pinRow.querySelector('.pin-slider-col');
    const slider = sliderCol.querySelector('.num-slider');
    const origVal = parseInt(slider.dataset.orig);
    const textInput = pinRow.querySelector('.pin-val-input');
    const curVal = textInput ? Number(textInput.value) : origVal;
    if (t.checked) {
      const refN = curVal > 0 ? Math.round(Math.log2(curVal)) : origVal > 0 ? Math.round(Math.log2(origVal)) : 3;
      const minN = Math.max(0, refN - 5), maxN = refN + 5;
      const curN = curVal > 0 ? Math.max(minN, Math.min(maxN, Math.round(Math.log2(curVal)))) : minN;
      slider.dataset.mode = 'pow2';
      slider.min = minN; slider.max = maxN; slider.step = 1; slider.value = curN;
      replaceRuler(sliderCol, buildTickRuler(minN, maxN, 'pow2'));
    } else {
      slider.dataset.mode = 'int';
      const span = Math.abs(origVal) || 10;
      const min = origVal >= 0 ? 0 : origVal - span, max = origVal + span;
      const intTicks = buildIntTickRuler(min, max);
      slider.min = min; slider.max = max; slider.step = intTicks.step;
      slider.value = Math.max(min, Math.min(max, Math.round(curVal / intTicks.step) * intTicks.step));
      replaceRuler(sliderCol, intTicks.html);
    }
  }
});

document.getElementById('pinned-bar').addEventListener('click', e => {
  const btn = e.target.closest('[data-pa="unpin"]');
  if (!btn) return;
  const file = btn.dataset.pf;
  const path = JSON.parse(btn.dataset.pp);
  if (!state.pinned[file]) return;
  const k = pathKey(path);
  state.pinned[file] = state.pinned[file].filter(p => pathKey(p) !== k);
  savePinned();
  renderPinnedBar();
  refreshPinButtons();
});
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
document.getElementById('set-sliders').addEventListener('change', onSettingChange);

document.getElementById('save-defaults-btn').addEventListener('click', saveAsUserDefault);
document.getElementById('reset-defaults-btn').addEventListener('click', resetToFactoryDefault);

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
