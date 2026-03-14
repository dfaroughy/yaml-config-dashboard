// ── Agent schema builders ───────────────────────────────────
function buildFileSchema(obj, path) {
  const rows = [];
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const p = [...path, i];
      const item = obj[i];
      if (item !== null && typeof item === 'object') {
        rows.push(...buildFileSchema(item, p));
      } else {
        rows.push({ path: p, value: item, type: typeof item });
      }
    }
    return rows;
  }
  for (const [k, v] of Object.entries(obj)) {
    const p = [...path, k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      rows.push(...buildFileSchema(v, p));
    } else if (Array.isArray(v)) {
      rows.push(...buildFileSchema(v, p));
    } else {
      rows.push({ path: p, value: v, type: typeof v });
    }
  }
  return rows;
}

function buildAllSchemata() {
  return Object.entries(state.configs).map(([file, cfg]) => ({
    file,
    raw: cfg.raw || '',
    fields: buildFileSchema(cfg.current, []),
  })).filter(s => s.fields.length > 0);
}

function buildDashboardState() {
  return {
    fileTypes: { ...state.fileTypes },
    lockedFields: [...state.lockedFields],
    pinnedFields: { ...state.pinned },
    activeConfigFile: state.activeConfigFile,
    activeDataFile: state.activeDataFile,
  };
}

// ── Agent ops dispatch ─────────────────────────────────────
const agentOps = {
  setValue(file, path, value) {
    const config = state.configs[file];
    if (!config) return `file not found: ${file}`;
    path = normalizePath(path);
    const existing = getNestedValue(config.current, path);
    if (existing === undefined) return `path not found: ${JSON.stringify(path)}`;
    const orig = getNestedValue(config.original, path);
    let coerced = value;
    if (typeof orig === 'number' && typeof value !== 'number') {
      const n = Number(value); coerced = isNaN(n) ? value : n;
    } else if (typeof orig === 'boolean' && typeof value !== 'boolean') {
      coerced = String(value).toLowerCase() === 'true';
    }
    setNestedValue(config.current, path, coerced);
    return `${file}:${path.join('.')} = ${JSON.stringify(coerced)}`;
  },
  setFileType(file, type) {
    if (!state.configs[file] && !state.files.includes(file)) return `file not found: ${file}`;
    if (type !== 'config' && type !== 'data') return `invalid type: ${type} (must be "config" or "data")`;
    const oldType = state.fileTypes[file];
    state.fileTypes[file] = type;
    if (type === 'data' && oldType !== 'data') {
      lockAllFieldsInFile(file);
      if (state.activeConfigFile === file) {
        const configFiles = state.files.filter(f => state.fileTypes[f] !== 'data');
        state.activeConfigFile = configFiles[0] || null;
      }
      if (!state.activeDataFile) state.activeDataFile = file;
    } else if (type === 'config' && oldType === 'data') {
      for (const key of [...state.lockedFields]) {
        if (key.startsWith(file + ':')) state.lockedFields.delete(key);
      }
      if (state.activeDataFile === file) {
        const dataFiles = state.files.filter(f => state.fileTypes[f] === 'data');
        state.activeDataFile = dataFiles.find(f => f !== file) || null;
      }
      if (!state.activeConfigFile) state.activeConfigFile = file;
    }
    state.activeFile = state.activeConfigFile || state.activeDataFile;
    return `${file} \u2192 ${type}`;
  },
  lockField(file, path) {
    path = normalizePath(path);
    const key = file + ':' + JSON.stringify(path);
    state.lockedFields.add(key);
    return `locked ${file}:${path.join('.')}`;
  },
  unlockField(file, path) {
    path = normalizePath(path);
    const key = file + ':' + JSON.stringify(path);
    state.lockedFields.delete(key);
    return `unlocked ${file}:${path.join('.')}`;
  },
  pinField(file, path) {
    path = normalizePath(path);
    if (!state.pinned[file]) state.pinned[file] = [];
    const k = pathKey(path);
    if (!state.pinned[file].some(p => pathKey(p) === k)) {
      state.pinned[file].push([...path]);
      savePinned();
    }
    return `pinned ${file}:${path.join('.')}`;
  },
  unpinField(file, path) {
    path = normalizePath(path);
    const k = pathKey(path);
    if (state.pinned[file]) {
      state.pinned[file] = state.pinned[file].filter(p => pathKey(p) !== k);
      savePinned();
    }
    return `unpinned ${file}:${path.join('.')}`;
  },
  lockAllInFile(file) {
    if (!state.configs[file]) return `file not found: ${file}`;
    lockAllFieldsInFile(file);
    return `locked all fields in ${file}`;
  },
  unlockAllInFile(file) {
    if (!state.configs[file]) return `file not found: ${file}`;
    for (const key of [...state.lockedFields]) {
      if (key.startsWith(file + ':')) state.lockedFields.delete(key);
    }
    return `unlocked all fields in ${file}`;
  },
};

function executeOps(ops) {
  const results = [];
  const diffs = [];
  const affectedFiles = new Set();

  for (const op of ops) {
    const fn = agentOps[op.fn];
    if (!fn) { results.push(`unknown op: ${op.fn}`); continue; }
    const args = op.args || [];
    if (op.fn === 'setValue' && args.length >= 3) {
      const [file, rawPath, value] = args;
      const config = state.configs[file];
      if (config) {
        const path = normalizePath(rawPath);
        const oldVal = getNestedValue(config.current, path);
        if (oldVal !== undefined) {
          diffs.push({ file, path, oldVal, newVal: value });
          affectedFiles.add(file);
        }
      }
    } else {
      affectedFiles.add(args[0] || '');
    }
    const result = fn.apply(null, args);
    results.push(result);
  }
  return { results, diffs, affectedFiles };
}

// ── Agent UI helpers ───────────────────────────────────────
function setAgentBusy(busy) {
  const input = document.getElementById('agent-input');
  const btn   = document.getElementById('agent-run-btn');
  const spin  = document.getElementById('agent-spinner');
  if (input) input.disabled = busy;
  if (btn)   btn.disabled   = busy;
  if (spin)  spin.classList.toggle('hidden', !busy);
}

function updateAgentModelLabel() {
  const el = document.getElementById('agent-model-label');
  if (!el) return;
  const m = state.availableModels.find(m => m.id === state.agentModelId);
  el.textContent = m ? m.family : state.agentModelId || 'auto';
}

function showModelPicker() {
  const btn = document.getElementById('agent-model-btn');
  const existing = document.getElementById('agent-model-menu');
  if (existing) { existing.remove(); return; }

  vscode.postMessage({ type: 'listModels' });

  const models = state.availableModels.filter(m =>
    !/^copilotcli/i.test(m.vendor) && !/^copilotcli/i.test(m.id)
  );
  if (!models.length) {
    toast('No language models found', 'error');
    return;
  }

  const menu = document.createElement('div');
  menu.id = 'agent-model-menu';
  menu.className = 'agent-model-menu';
  menu.innerHTML = models.map(m => {
    const label = m.vendor + ' / ' + m.family;
    const sel = m.id === state.agentModelId ? ' selected' : '';
    return `<div class="agent-model-option${sel}" data-model-id="${escapeHtml(m.id)}" title="${escapeHtml(m.id)}">${escapeHtml(label)}</div>`;
  }).join('');
  const rect = btn.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = (rect.bottom + 4) + 'px';
  menu.style.right = (window.innerWidth - rect.right) + 'px';
  document.body.appendChild(menu);
  menu.addEventListener('click', e => {
    const opt = e.target.closest('.agent-model-option');
    if (!opt) return;
    state.agentModelId = opt.dataset.modelId;
    updateAgentModelLabel();
    menu.remove();
  });
  setTimeout(() => {
    document.addEventListener('click', function dismiss(e) {
      if (!menu.contains(e.target) && e.target !== btn) {
        menu.remove();
        document.removeEventListener('click', dismiss);
      }
    });
  }, 0);
}

// ── Chat log with typing animation ──────────────────────────
let _typingTimer = null;
const CHAT_MAX = 5;

function updateChatOpacities(log) {
  const entries = log.querySelectorAll('.chat-entry');
  const n = entries.length;
  entries.forEach((el, i) => {
    el.style.opacity = (n - i) / n;
  });
}

function addChatEntry(question, answerText, diffs, isError) {
  const log = document.getElementById('agent-chat-log');
  if (!log) return;

  if (_typingTimer) { clearInterval(_typingTimer); _typingTimer = null; }
  log.querySelectorAll('.typing-cursor').forEach(c => c.remove());

  while (log.querySelectorAll('.chat-entry').length >= CHAT_MAX) {
    const oldest = log.querySelector('.chat-entry:last-child');
    if (oldest) oldest.remove(); else break;
  }

  const entry = document.createElement('div');
  entry.className = 'chat-entry' + (isError ? ' chat-entry-error' : '');

  const qDiv = document.createElement('div');
  qDiv.className = 'chat-entry-question';
  qDiv.innerHTML = `<span class="chat-q-label">&gt;</span> <span class="chat-q-text">${escapeHtml(question)}</span><button class="chat-entry-dismiss" title="Remove">&times;</button>`;
  entry.appendChild(qDiv);
  qDiv.querySelector('.chat-entry-dismiss').addEventListener('click', () => {
    entry.remove();
    updateChatOpacities(log);
    if (!log.querySelectorAll('.chat-entry').length) {
      log.classList.add('hidden');
    }
  });

  const aDiv = document.createElement('div');
  aDiv.className = 'chat-entry-answer';
  entry.appendChild(aDiv);

  const dContainer = document.createElement('div');
  dContainer.className = 'chat-entry-diffs';
  entry.appendChild(dContainer);

  log.prepend(entry);
  log.classList.remove('hidden');
  log.scrollTop = 0;
  updateChatOpacities(log);

  const fullText = answerText || '';
  if (!fullText) {
    renderDiffsInto(dContainer, diffs);
    wireLinks(entry);
    return;
  }

  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  aDiv.appendChild(cursor);

  let i = 0;
  const speed = Math.max(8, Math.min(25, 1200 / fullText.length));
  _typingTimer = setInterval(() => {
    if (i < fullText.length) {
      const chunk = fullText.slice(i, i + 3);
      cursor.insertAdjacentText('beforebegin', chunk);
      i += 3;
    } else {
      clearInterval(_typingTimer);
      _typingTimer = null;
      cursor.remove();
      aDiv.innerHTML = linkifyUrls(fullText);
      wireLinks(entry);
      renderDiffsInto(dContainer, diffs);
    }
  }, speed);
}

function renderDiffsInto(container, diffs) {
  if (!diffs || diffs.length === 0) return;
  container.innerHTML = diffs.map(({ file, path, oldVal, newVal }) =>
    `<div class="agent-diff-line">` +
      `<span class="agent-diff-file">${escapeHtml(file)}</span>` +
      `<span class="agent-diff-key">${escapeHtml(path.join('.'))}</span>` +
      `<span class="agent-diff-old">${escapeHtml(String(oldVal))}</span>` +
      `<span class="agent-diff-arrow">\u2192</span>` +
      `<span class="agent-diff-new">${escapeHtml(String(newVal))}</span>` +
    `</div>`
  ).join('');
}

function wireLinks(container) {
  container.querySelectorAll('a.agent-link').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      vscode.postMessage({ type: 'openUrl', url: a.href });
    });
  });
}

// ── Agent prompt execution ──────────────────────────────────
function _executeAgentPrompt(prompt) {
  const schemata = buildAllSchemata();
  if (!schemata.length) {
    setAgentBusy(false);
    toast('No configs loaded', 'error');
    return;
  }
  const syspromptEditor = document.getElementById('sysprompt-editor');
  const additionalPrompt = syspromptEditor && syspromptEditor.value.trim() ? syspromptEditor.value.trim() : null;
  vscode.postMessage({ type: 'agentPrompt', prompt, schemata, dashboardState: buildDashboardState(), modelId: state.agentModelId, additionalPrompt });
}

function runAgentPrompt() {
  const input  = document.getElementById('agent-input');
  const prompt = (input ? input.value : '').trim();
  if (!prompt) return;
  if (!state.files.length) { toast('No config files found', 'error'); return; }

  setAgentBusy(true);
  state._lastQuestion = prompt;
  input.value = '';

  const missing = state.files.filter(f => !state.configs[f]);
  if (missing.length === 0) {
    _executeAgentPrompt(prompt);
    return;
  }
  state._agentPending = { prompt, awaiting: new Set(missing) };
  for (const f of missing) vscode.postMessage({ type: 'readConfig', filename: f });
}
