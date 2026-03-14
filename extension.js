const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const yaml = require('./vendor/js-yaml.min.js');

const panels = new Map(); // configDir -> WebviewPanel

async function sendModelList(panel) {
  if (!vscode.lm) return;
  try {
    const allModels = await vscode.lm.selectChatModels({});
    const modelList = (allModels || []).map(m => ({
      id: m.id, vendor: m.vendor, family: m.family, name: m.name || m.family,
    }));
    panel.webview.postMessage({ type: 'availableModels', models: modelList });
  } catch { /* ignore */ }
}

function activate(context) {
  const cmd = vscode.commands.registerCommand('configDashboard.open', async (uri) => {
    try {
      // ── Folder picker ──────────────────────────────────────
      let configDir;
      if (uri && uri.fsPath) {
        // Invoked from Explorer context menu on a folder
        configDir = uri.fsPath;
      } else {
        const defaultUri = vscode.workspace.workspaceFolders?.[0]?.uri;
        const folders = await vscode.window.showOpenDialog({
          canSelectFolders: true,
          canSelectFiles: false,
          canSelectMany: false,
          openLabel: 'Select Config Folder',
          defaultUri,
        });
        if (!folders || folders.length === 0) return;
        configDir = folders[0].fsPath;
      }

      // ── Reveal existing panel for this folder ──────────────
      if (panels.has(configDir)) {
        panels.get(configDir).reveal(vscode.ViewColumn.One);
        return;
      }

      // ── Check folder contains YAML files ───────────────────
      const hasYaml = (function scanDir(dir) {
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return false; }
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          if (entry.isFile() && /\.ya?ml$/.test(entry.name)) return true;
          if (entry.isDirectory() && scanDir(path.join(dir, entry.name))) return true;
        }
        return false;
      })(configDir);

      if (!hasYaml) {
        vscode.window.showInformationMessage('Config Dashboard: No YAML files found in this folder.');
        return;
      }

      // ── Resource URIs ──────────────────────────────────────
      const nonce = crypto.randomBytes(16).toString('hex');
      const folderName = path.basename(configDir).replace(/ /g, '_');

      const panel = vscode.window.createWebviewPanel(
        'configDashboard',
        folderName,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, 'media'),
            vscode.Uri.joinPath(context.extensionUri, 'vendor'),
          ],
        }
      );

      panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'logo_2D.png');
      panels.set(configDir, panel);
      panel.onDidDispose(() => { panels.delete(configDir); }, null, context.subscriptions);

      const mediaUri = (file) => panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', file));
      const cssUri     = mediaUri('webview.css');
      const yamlUri    = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'vendor', 'js-yaml.min.js'));
      const utilsUri   = mediaUri('utils.js');
      const stateUri   = mediaUri('state.js');
      const slidersUri = mediaUri('sliders.js');
      const rendererUri = mediaUri('renderer.js');
      const agentUri   = mediaUri('agent.js');
      const eventsUri  = mediaUri('events.js');
      const cspSource  = panel.webview.cspSource;

      const htmlPath = path.join(context.extensionPath, 'webview.html');
      let html = fs.readFileSync(htmlPath, 'utf8');
      html = html
        .replace(/\{\{NONCE\}\}/g, nonce)
        .replace(/\{\{CSP_SOURCE\}\}/g, cspSource)
        .replace('{{CSS_URI}}',      cssUri.toString())
        .replace('{{YAML_URI}}',     yamlUri.toString())
        .replace('{{UTILS_URI}}',    utilsUri.toString())
        .replace('{{STATE_URI}}',    stateUri.toString())
        .replace('{{SLIDERS_URI}}',  slidersUri.toString())
        .replace('{{RENDERER_URI}}', rendererUri.toString())
        .replace('{{AGENT_URI}}',    agentUri.toString())
        .replace('{{EVENTS_URI}}',   eventsUri.toString());
      panel.webview.html = html;

      // ── Recursive YAML file discovery ──────────────────────
      function findYamlFiles(dir, base) {
        let results = [];
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
        catch { return results; }
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const fullPath = path.join(dir, entry.name);
          const relPath  = path.relative(base, fullPath);
          if (entry.isDirectory()) {
            results.push(...findYamlFiles(fullPath, base));
          } else if (entry.isFile() && /\.ya?ml$/.test(entry.name)) {
            results.push(relPath);
          }
        }
        return results.sort();
      }

      // ── Message handler ────────────────────────────────────
      panel.webview.onDidReceiveMessage(async (msg) => {
        switch (msg.type) {
          case 'init': {
            const files = findYamlFiles(configDir, configDir);
            const userDefaultSettings = context.globalState.get('userDefaultSettings', null);
            const pinnedKey = 'pinnedFields:' + configDir;
            const pinnedFields = context.workspaceState.get(pinnedKey, {});
            const defaultPromptTemplate = fs.readFileSync(
              path.join(context.extensionPath, 'media', 'system-prompt.txt'), 'utf8'
            );
            panel.webview.postMessage({ type: 'init', files, configDir, userDefaultSettings, pinnedFields, defaultPromptTemplate });
            sendModelList(panel);
            break;
          }
          case 'listModels': {
            sendModelList(panel);
            break;
          }
          case 'saveUserDefaults': {
            context.globalState.update('userDefaultSettings', msg.settings);
            break;
          }
          case 'savePinned': {
            const pinnedKey = 'pinnedFields:' + configDir;
            context.workspaceState.update(pinnedKey, msg.pinned);
            break;
          }
          case 'readConfig': {
            try {
              const filePath = path.resolve(configDir, msg.filename);
              const safeBase = path.resolve(configDir) + path.sep;
              if (!filePath.startsWith(safeBase)) {
                panel.webview.postMessage({ type: 'configData', error: 'Invalid path' });
                return;
              }
              const raw    = fs.readFileSync(filePath, 'utf8');
              const docs   = yaml.loadAll(raw);
              const docKey = docs.length === 1 ? null : msg.filename.replace(/\.ya?ml$/i, '');
              const parsed = docKey ? { [docKey]: docs } : docs[0];
              panel.webview.postMessage({ type: 'configData', filename: msg.filename, raw, parsed });
            } catch (e) {
              panel.webview.postMessage({ type: 'configData', error: e.message });
            }
            break;
          }
          case 'writeConfig': {
            try {
              const filePath = path.resolve(configDir, msg.filename);
              const safeBase = path.resolve(configDir) + path.sep;
              if (!filePath.startsWith(safeBase)) {
                panel.webview.postMessage({ type: 'writeResult', error: 'Invalid path' });
                return;
              }
              let output;
              const docKey = msg.filename.replace(/\.ya?ml$/i, '');
              if (msg.data && Array.isArray(msg.data[docKey])) {
                output = msg.data[docKey].map(d => yaml.dump(d, { flowLevel: -1, sortKeys: false })).join('---\n');
              } else {
                output = yaml.dump(msg.data, { flowLevel: -1, sortKeys: false });
              }
              fs.writeFileSync(filePath, output, 'utf8');
              panel.webview.postMessage({ type: 'writeResult', success: true, filename: msg.filename });
            } catch (e) {
              panel.webview.postMessage({ type: 'writeResult', error: e.message });
            }
            break;
          }
          case 'classifyFiles': {
            (async () => {
              try {
                if (!vscode.lm) {
                  panel.webview.postMessage({ type: 'classifyResult', classifications: {} });
                  return;
                }
                const family = 'gpt-4o';
                const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family });
                const model = models && models[0];
                if (!model) {
                  panel.webview.postMessage({ type: 'classifyResult', classifications: {} });
                  return;
                }

                // Gather repo context
                let repoContext = '';
                const readmeCandidates = ['README.md', 'readme.md', 'README.txt'];
                const searchDirs = [configDir, path.dirname(configDir)];
                for (const dir of searchDirs) {
                  for (const fname of readmeCandidates) {
                    try {
                      repoContext = fs.readFileSync(path.join(dir, fname), 'utf8').slice(0, 2000);
                      break;
                    } catch { /* not found */ }
                  }
                  if (repoContext) break;
                }

                // Build file summaries (first 500 chars of each)
                const fileSummaries = msg.files.map(f => {
                  try {
                    const content = fs.readFileSync(path.resolve(configDir, f), 'utf8');
                    return `[${f}]\n${content.slice(0, 500)}`;
                  } catch { return `[${f}]\n(could not read)`; }
                }).join('\n\n');

                const contextSection = repoContext
                  ? `\nPROJECT CONTEXT (from README):\n${repoContext}\n`
                  : '';

                const systemPrompt =
`You are classifying YAML files in a project directory. For each file, determine if it is:
- "config": Contains editable parameters, settings, hyperparameters, configuration options, pipeline definitions
- "data": Contains datasets, measurements, results, tables of numerical values, experimental data, HEPData submissions
${contextSection}
FILES:
${fileSummaries}

Return ONLY a JSON object mapping each filename to "config" or "data". Example:
{"train_config.yaml": "config", "results.yaml": "data"}
No markdown, no explanation — just the JSON object.`;

                const messages = [
                  vscode.LanguageModelChatMessage.User(systemPrompt),
                ];

                const tokenSource = new vscode.CancellationTokenSource();
                const response = await model.sendRequest(messages, {}, tokenSource.token);

                let raw = '';
                for await (const chunk of response.text) { raw += chunk; }

                let text = raw.trim();
                text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

                const classifications = JSON.parse(text);
                panel.webview.postMessage({ type: 'classifyResult', classifications });
              } catch (e) {
                // Silently fall back — all files treated as config
                panel.webview.postMessage({ type: 'classifyResult', classifications: {} });
              }
            })();
            break;
          }
          case 'agentPrompt': {
            (async () => {
              try {
                // ── Select model ──────────────────────────────
                if (!vscode.lm) {
                  panel.webview.postMessage({ type: 'agentResult', error: 'Language Model API not available. Update VS Code to 1.85+.' });
                  return;
                }
                // Try to find the exact model by id, then fall back to family match
                const modelId = msg.modelId;
                let allModels = await vscode.lm.selectChatModels({});
                let model = modelId
                  ? (allModels || []).find(m => m.id === modelId)
                  : null;
                if (!model) {
                  // Fallback: match by family (backward compat)
                  const family = msg.modelFamily || 'gpt-4o';
                  const byFamily = await vscode.lm.selectChatModels({ family });
                  model = byFamily && byFamily[0];
                }
                if (!model && allModels && allModels.length > 0) {
                  model = allModels[0]; // last resort: use any available model
                }
                if (!model) {
                  panel.webview.postMessage({ type: 'agentResult', error: 'No language model available. Install GitHub Copilot or another LM extension.' });
                  return;
                }

                // ── Context budget based on model capacity ───
                // model.maxInputTokens is exposed by VS Code LM API
                const maxTokens = model.maxInputTokens || 4000;
                // Reserve ~25% for response + user prompt + template overhead
                const usableTokens = Math.floor(maxTokens * 0.75);
                // Rough heuristic: 1 token ≈ 4 chars
                const charBudget = usableTokens * 4;

                // Allocate budget across components:
                //   README: 10%, Fields: 60%, Raw YAML: 25%, State: 5%
                const readmeBudget = Math.floor(charBudget * 0.10);
                const fieldCharBudget = Math.floor(charBudget * 0.60);
                const rawCharBudget = Math.floor(charBudget * 0.25);

                // ── Gather repo context (README + file list) ──
                let repoContext = '';
                const readmeCandidates = ['README.md', 'readme.md', 'README.txt', 'readme.txt'];
                const searchDirs = [configDir, path.dirname(configDir)];
                for (const dir of searchDirs) {
                  for (const fname of readmeCandidates) {
                    try {
                      const content = fs.readFileSync(path.join(dir, fname), 'utf8');
                      repoContext = content.slice(0, readmeBudget);
                      break;
                    } catch { /* not found */ }
                  }
                  if (repoContext) break;
                }

                // ── Build multi-file schema string ────────────
                const schemata = msg.schemata;
                const numFiles = schemata.length || 1;
                // Field budget: ~80 chars per field line on average
                const totalFieldBudget = Math.max(50, Math.floor(fieldCharBudget / 80));
                const totalFields = schemata.reduce((s, f) => s + f.fields.length, 0);
                // Raw YAML budget per file
                const rawLimitPerFile = Math.floor(rawCharBudget / numFiles);

                const schemaBlock = schemata.map(({ file, raw, fields }) => {
                  // Proportional budget per file, minimum 10
                  const budget = Math.max(10, Math.round((fields.length / Math.max(totalFields, 1)) * totalFieldBudget));
                  const truncated = fields.length > budget;
                  const rawSection = raw
                    ? `  RAW YAML:\n${raw.slice(0, rawLimitPerFile).split('\n').map(l => '    ' + l).join('\n')}` +
                      (raw.length > rawLimitPerFile ? `\n    ... (truncated, ${raw.length} chars total)` : '') + '\n'
                    : '';
                  const lines = fields.slice(0, budget).map(({ path, value, type }) =>
                    `    ${JSON.stringify(path)}  =  ${JSON.stringify(value)}  (${type})`
                  ).join('\n');
                  const truncNote = truncated ? `\n    ... (${fields.length - budget} more fields, ${fields.length} total)` : '';
                  return `  [${file}]\n${rawSection}  FIELDS (${fields.length} total):\n${lines}${truncNote}`;
                }).join('\n\n');

                // ── Dashboard state ───────────────────────────
                const ds = msg.dashboardState || {};

                // Format pinned fields as readable list
                const pinnedEntries = [];
                for (const [file, paths] of Object.entries(ds.pinnedFields || {})) {
                  for (const p of (paths || [])) {
                    pinnedEntries.push(`  - ${file} → ${(p || []).join('.')}`);
                  }
                }
                const pinnedBlock = pinnedEntries.length
                  ? `Pinned fields (${pinnedEntries.length}):\n${pinnedEntries.join('\n')}`
                  : 'Pinned fields: none';

                // Format locked fields as readable list
                const lockedList = (ds.lockedFields || []).slice(0, 50);
                const lockedBlock = lockedList.length
                  ? `Locked fields (${lockedList.length}): ${lockedList.map(k => k.replace(':', ' → ')).join(', ')}`
                  : 'Locked fields: none';

                const stateBlock = `
CURRENT DASHBOARD STATE:
  File classifications: ${JSON.stringify(ds.fileTypes || {})}
  Active config tab: ${ds.activeConfigFile || '(none)'}
  Active data tab: ${ds.activeDataFile || '(none)'}
  ${pinnedBlock}
  ${lockedBlock}`;

                // ── System prompt from template ─────────────
                const contextSection = repoContext
                  ? `REPO CONTEXT (from README):\n${repoContext}`
                  : '';

                // Always use the built-in template; append user's additional instructions
                const template = fs.readFileSync(
                  path.join(context.extensionPath, 'media', 'system-prompt.txt'), 'utf8'
                );

                let systemPrompt = template
                  .replace('{{REPO_CONTEXT}}', contextSection)
                  .replace('{{SCHEMA_BLOCK}}', schemaBlock)
                  .replace('{{DASHBOARD_STATE}}', stateBlock.trim());

                if (msg.additionalPrompt) {
                  systemPrompt += '\n\nADDITIONAL USER INSTRUCTIONS:\n' + msg.additionalPrompt;
                }

                const messages = [
                  vscode.LanguageModelChatMessage.User(systemPrompt),
                  vscode.LanguageModelChatMessage.User(msg.prompt),
                ];

                // ── Stream response ───────────────────────────
                const tokenSource = new vscode.CancellationTokenSource();
                const response = await model.sendRequest(messages, {}, tokenSource.token);

                let raw = '';
                for await (const chunk of response.text) { raw += chunk; }

                // ── Strip accidental markdown fences ─────────
                let text = raw.trim();
                text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

                // ── Parse response ────────────────────────────
                let parsed;
                try {
                  parsed = JSON.parse(text);
                  if (typeof parsed !== 'object' || parsed === null) throw new Error('Not an object');
                  if (!Array.isArray(parsed.ops)) {
                    // Backward compat: convert old patches format to ops
                    if (Array.isArray(parsed.patches)) {
                      parsed.ops = parsed.patches.map(p => ({
                        fn: 'setValue',
                        args: [p.file, p.path, p.value],
                      }));
                    } else {
                      parsed.ops = [];
                    }
                  }
                } catch (e) {
                  panel.webview.postMessage({
                    type: 'agentResult',
                    error: `Could not parse model response: ${e.message}. Raw: "${text.slice(0, 200)}"`
                  });
                  return;
                }

                panel.webview.postMessage({
                  type: 'agentResult',
                  answer: parsed.answer || '',
                  summary: parsed.summary || '',
                  ops: parsed.ops,
                });

              } catch (e) {
                panel.webview.postMessage({ type: 'agentResult', error: e.message || String(e) });
              }
            })();
            break;
          }
          case 'openUrl': {
            const url = msg.url;
            if (url && /^https?:\/\//.test(url)) {
              vscode.env.openExternal(vscode.Uri.parse(url));
            }
            break;
          }
          case 'exportJson': {
            try {
              const filePath = path.resolve(configDir, msg.filename);
              const safeBase = path.resolve(configDir) + path.sep;
              if (!filePath.startsWith(safeBase)) {
                panel.webview.postMessage({ type: 'exportJsonResult', error: 'Invalid path' });
                return;
              }
              const jsonFilename = msg.filename.replace(/\.ya?ml$/i, '.json');
              const jsonPath = path.resolve(configDir, jsonFilename);
              fs.writeFileSync(jsonPath, JSON.stringify(msg.data, null, 2), 'utf8');
              panel.webview.postMessage({ type: 'exportJsonResult', success: true, jsonFilename });
            } catch (e) {
              panel.webview.postMessage({ type: 'exportJsonResult', error: e.message });
            }
            break;
          }
        }
      }, undefined, context.subscriptions);

    } catch (e) {
      vscode.window.showErrorMessage(`Config Dashboard: ${e.message}`);
    }
  });

  context.subscriptions.push(cmd);
}

function deactivate() {}

module.exports = { activate, deactivate };
