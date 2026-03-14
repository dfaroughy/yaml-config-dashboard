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

function resetFile() {
  const config = state.configs[state.activeFile];
  if (!config) return;
  config.current = deepClone(config.original);
  renderEditor(); renderTabs(); updateButtons();
  toast('Reset ' + state.activeFile, 'success');
}

// ── Message handler from extension host ────────────────────
window.addEventListener('message', event => {
  const msg = event.data;
  switch (msg.type) {
    case 'init': {
      state.files = msg.files;
      if (msg.defaultPromptTemplate) {
        state.defaultPromptTemplate = msg.defaultPromptTemplate;
      }
      if (msg.userDefaultSettings) {
        const prev = vscode.getState();
        if (!prev || !prev.settings) {
          settings = { ...defaultSettings, ...msg.userDefaultSettings };
          applySettings();
          saveSettings();
          syncSettingsUI();
        }
      }
      if (msg.pinnedFields && Object.keys(msg.pinnedFields).length > 0) {
        state.pinned = msg.pinnedFields;
        const prev = vscode.getState() || {};
        vscode.setState({ ...prev, pinned: state.pinned });
      }
      renderTabs();
      if (state.files.length > 0) {
        state.activeConfigFile = state.files[0];
        selectFile(state.files[0]);
      }
      if (state.files.length > 0) {
        vscode.postMessage({ type: 'classifyFiles', files: state.files });
      }
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
        raw: msg.raw || '',
      };
      if (state.fileTypes[msg.filename] === 'data') {
        lockAllFieldsInFile(msg.filename);
      }
      if (state._bgLoads.has(msg.filename)) {
        state._bgLoads.delete(msg.filename);
        renderPinnedBar();
      } else if (state._agentPending && state._agentPending.awaiting.has(msg.filename)) {
        state._agentPending.awaiting.delete(msg.filename);
        updateAgentModelLabel();
        if (state._agentPending.awaiting.size === 0) {
          const prompt = state._agentPending.prompt;
          state._agentPending = null;
          _executeAgentPrompt(prompt);
        }
      } else {
        state.activeFile = msg.filename;
        const isData = state.fileTypes[msg.filename] === 'data';
        if (isData) {
          state.activeDataFile = msg.filename;
        } else {
          state.activeConfigFile = msg.filename;
        }
        renderTabs();
        renderEditors();
        updateButtons();
        updateAgentModelLabel();
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
    case 'classifyResult': {
      if (msg.classifications) {
        state.fileTypes = msg.classifications;
        const configFiles = state.files.filter(f => state.fileTypes[f] !== 'data');
        const dataFiles = state.files.filter(f => state.fileTypes[f] === 'data');

        for (const f of dataFiles) {
          if (state.configs[f]) {
            lockAllFieldsInFile(f);
          }
        }

        if (state.activeConfigFile && state.fileTypes[state.activeConfigFile] === 'data') {
          state.activeDataFile = state.activeConfigFile;
          state.activeConfigFile = null;
        }
        if (!state.activeConfigFile || state.fileTypes[state.activeConfigFile] === 'data') {
          state.activeConfigFile = configFiles[0] || null;
        }
        state.activeFile = state.activeConfigFile || state.activeDataFile;

        if (state.activeConfigFile && !state.configs[state.activeConfigFile]) {
          vscode.postMessage({ type: 'readConfig', filename: state.activeConfigFile });
        }

        if (!state.activeDataFile && dataFiles.length > 0) {
          state.activeDataFile = dataFiles[0];
        }
        if (state.activeDataFile && !state.configs[state.activeDataFile]) {
          state._bgLoads.add(state.activeDataFile);
          vscode.postMessage({ type: 'readConfig', filename: state.activeDataFile });
        }

        document.getElementById('data-panel').classList.toggle('hidden', dataFiles.length === 0);
        renderTabs();
        renderEditors();
        updateButtons();
      }
      break;
    }
    case 'availableModels': {
      state.availableModels = (msg.models || []).filter(m =>
        !/^copilotcli/i.test(m.vendor) && !/^copilotcli/i.test(m.id)
      );
      if (!state.agentModelId || !state.availableModels.find(m => m.id === state.agentModelId)) {
        state.agentModelId = state.availableModels.length > 0 ? state.availableModels[0].id : '';
      }
      updateAgentModelLabel();
      break;
    }
    case 'agentResult': {
      setAgentBusy(false);
      const question = state._lastQuestion || '\u2026';

      if (msg.error) {
        toast('Agent: ' + msg.error, 'error');
        addChatEntry(question, 'Error: ' + msg.error, null, true);
        break;
      }
      if (msg.answer && (!msg.ops || msg.ops.length === 0)) {
        addChatEntry(question, msg.answer, null, false);
        break;
      }
      const ops = msg.ops || [];
      if (ops.length === 0) {
        addChatEntry(question, msg.summary || 'No changes needed.', [], false);
        toast('Agent made no changes', 'info');
        break;
      }

      const { results, diffs, affectedFiles } = executeOps(ops);
      const answerText = msg.answer || '';
      const summaryText = msg.summary || `Executed ${ops.length} operation${ops.length > 1 ? 's' : ''}.`;

      if (diffs.length > 0 || affectedFiles.size > 0) {
        toast(`Agent: ${ops.length} op${ops.length > 1 ? 's' : ''} across ${affectedFiles.size} file${affectedFiles.size > 1 ? 's' : ''}`, 'success');
      }

      const displayText = answerText ? answerText + '\n' + summaryText : summaryText;
      addChatEntry(question, displayText, diffs.length > 0 ? diffs : [], false);

      renderTabs();
      renderEditors();
      renderPinnedBar();
      updateButtons();

      const hasData = state.files.some(f => state.fileTypes[f] === 'data');
      document.getElementById('data-panel').classList.toggle('hidden', !hasData);
      break;
    }
  }
});

// ── Event delegation: editors ──────────────────────────────
function onEditorClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const { action, fid, index } = target.dataset;
  switch (action) {
    case 'toggle-section':       toggleSection(target.closest('.section')); break;
    case 'toggle-section-deep':  toggleSectionDeep(target.closest('.section')); break;
    case 'convert-null':     convertNull(fid); break;
    case 'remove-item':      removeArrayItem(fid, Number(index)); break;
    case 'add-item':         addArrayItem(fid); break;
    case 'reset-field':      resetField(fid); break;
    case 'lock-field': {
      const key = lockFieldKey(fid);
      if (key) {
        if (state.lockedFields.has(key)) {
          state.lockedFields.delete(key);
        } else {
          state.lockedFields.add(key);
        }
        renderEditors();
        updateButtons();
      }
      break;
    }
    case 'pin-field': {
      const entry = state.fieldMap[fid];
      if (entry) {
        if (isPinnedPath(entry.path, entry.file)) unpinField(entry.path);
        else pinField(entry.path, entry.file);
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
}
function onEditorChange(e) {
  const t = e.target;
  if (t.dataset.action === 'toggle') onToggle(t.dataset.fid, t.checked);
  else if (t.dataset.action === 'toggle-log-cb') toggleLogScale(t);
  else if (t.dataset.action === 'toggle-log2-cb') toggleLog2Scale(t);
}
function onEditorInput(e) {
  const t = e.target;
  if (t.dataset.action === 'input') onInput(t.dataset.fid, t.value);
  else if (t.dataset.action === 'array-input') onArrayItemInput(t.dataset.fid, Number(t.dataset.index), t.value);
  else if (t.dataset.action === 'num-slider') onSliderInput(t);
}

['config-editor', 'data-editor'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', onEditorClick);
  el.addEventListener('change', onEditorChange);
  el.addEventListener('input', onEditorInput);
});

// ── Event delegation: file tabs ────────────────────────────
document.getElementById('file-tabs').addEventListener('click', e => {
  const tab = e.target.closest('[data-filename]');
  if (tab) selectFile(tab.dataset.filename);
});
document.getElementById('data-tabs').addEventListener('click', e => {
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

// ── Panel collapse/expand ───────────────────────────────────
document.querySelectorAll('.dash-panel-header[data-action="toggle-panel"]').forEach(header => {
  header.addEventListener('click', e => {
    if (e.target.closest('.pin-clear-btn')) return;
    if (e.target.closest('nav')) return;
    header.closest('.dash-panel').classList.toggle('collapsed');
  });
});

// ── Pin clear-all ──────────────────────────────────────────
document.getElementById('pin-clear-all').addEventListener('click', () => {
  state.pinned = {};
  savePinned();
  renderPinnedBar();
  refreshPinButtons();
});

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
    const textInp = t.closest('.pin-row').querySelector('.pin-val-input');
    if (textInp) textInp.value = String(val);
  } else {
    const cur = getNestedValue(state.configs[file].current, path);
    const raw = t.value;
    val = typeof cur === 'number' ? (isNaN(Number(raw)) ? raw : Number(raw)) : raw;
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
  if (file === state.activeConfigFile || file === state.activeDataFile) {
    const fid = state.pathToFid[file + ':' + pathKey(path)];
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
    if (file === state.activeConfigFile || file === state.activeDataFile) {
      const fid = state.pathToFid[file + ':' + pathKey(path)];
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

// ── Settings listeners ─────────────────────────────────────
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

// ── Agent CLI bar listeners ─────────────────────────────────
document.getElementById('agent-run-btn').addEventListener('click', runAgentPrompt);
document.getElementById('agent-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); runAgentPrompt(); }
});
document.getElementById('agent-model-btn').addEventListener('click', showModelPicker);

// ── System prompt panel toggle ──────────────────────────────
document.getElementById('agent-sysprompt-btn').addEventListener('click', () => {
  const panel = document.getElementById('agent-sysprompt-panel');
  const btn = document.getElementById('agent-sysprompt-btn');
  const hidden = panel.classList.toggle('hidden');
  btn.classList.toggle('active', !hidden);
});
document.getElementById('sysprompt-reset').addEventListener('click', () => {
  const editor = document.getElementById('sysprompt-editor');
  if (editor) editor.value = '';
});

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

// ── Init ───────────────────────────────────────────────────
function init() {
  buildThemeSwatches();
  loadSettings();
  loadPinned();
  document.getElementById('pinned-panel-title').innerHTML = PIN_ICON_SVG + ' pinned';
  document.getElementById('config-panel-title').innerHTML = YAML_ICON_SVG + ' configs';
  document.getElementById('data-panel-title').innerHTML = DATA_ICON_SVG + ' data';
  document.getElementById('pinned-panel').classList.add('hidden');
  vscode.postMessage({ type: 'init' });
}

init();
