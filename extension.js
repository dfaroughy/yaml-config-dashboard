const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const yaml = require('./vendor/js-yaml.min.js');

const panels = new Map(); // configDir -> WebviewPanel

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

      const cssUri  = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'webview.css'));
      const yamlUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'vendor', 'js-yaml.min.js'));
      const jsUri   = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'webview.js'));
      const cspSource = panel.webview.cspSource;

      const htmlPath = path.join(context.extensionPath, 'webview.html');
      let html = fs.readFileSync(htmlPath, 'utf8');
      html = html
        .replace(/\{\{NONCE\}\}/g, nonce)
        .replace(/\{\{CSP_SOURCE\}\}/g, cspSource)
        .replace('{{CSS_URI}}',  cssUri.toString())
        .replace('{{YAML_URI}}', yamlUri.toString())
        .replace('{{JS_URI}}',   jsUri.toString());
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
            const pinnedFields = context.globalState.get('pinnedFields', {});
            panel.webview.postMessage({ type: 'init', files, configDir, userDefaultSettings, pinnedFields });
            break;
          }
          case 'saveUserDefaults': {
            context.globalState.update('userDefaultSettings', msg.settings);
            break;
          }
          case 'savePinned': {
            context.globalState.update('pinnedFields', msg.pinned);
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
              const parsed = yaml.load(raw);
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
              const output = yaml.dump(msg.data, { flowLevel: -1, sortKeys: false });
              fs.writeFileSync(filePath, output, 'utf8');
              panel.webview.postMessage({ type: 'writeResult', success: true, filename: msg.filename });
            } catch (e) {
              panel.webview.postMessage({ type: 'writeResult', error: e.message });
            }
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
                const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
                const model = models && models[0];
                if (!model) {
                  panel.webview.postMessage({ type: 'agentResult', error: 'No language model available. Install GitHub Copilot and sign in.' });
                  return;
                }

                // ── Gather repo context (README + file list) ──
                let repoContext = '';
                const readmeCandidates = ['README.md', 'readme.md', 'README.txt', 'readme.txt'];
                const searchDirs = [configDir, path.dirname(configDir)];
                for (const dir of searchDirs) {
                  for (const fname of readmeCandidates) {
                    try {
                      const content = fs.readFileSync(path.join(dir, fname), 'utf8');
                      repoContext = content.slice(0, 3000); // cap at 3k chars
                      break;
                    } catch { /* not found */ }
                  }
                  if (repoContext) break;
                }

                // ── Build multi-file schema string ────────────
                const schemata = msg.schemata; // [{file, fields:[{path,value,type}]}]
                const schemaBlock = schemata.map(({ file, raw, fields }) => {
                  const rawSection = raw
                    ? `  RAW YAML:\n${raw.slice(0, 2000).split('\n').map(l => '    ' + l).join('\n')}\n`
                    : '';
                  const lines = fields.slice(0, 150).map(({ path, value, type }) =>
                    `    ${JSON.stringify(path)}  =  ${JSON.stringify(value)}  (${type})`
                  ).join('\n');
                  return `  [${file}]\n${rawSection}  PATCHABLE FIELDS:\n${lines}`;
                }).join('\n\n');

                // ── System prompt ─────────────────────────────
                const contextSection = repoContext
                  ? `\nREPO CONTEXT (from README):\n${repoContext}\n`
                  : '';

                const systemPrompt =
`You are an expert config editor for software and machine learning projects.
${contextSection}
CONFIG FILES IN SCOPE:
${schemaBlock}

The user will give a natural-language instruction to modify one or more config values.

Return a JSON object with exactly two keys — nothing else, no markdown, no prose:
{
  "summary": "<one concise sentence describing what you changed and why>",
  "patches": [
    { "file": "<filename>", "path": ["key", "nested_key", ...], "value": <new_value> },
    ...
  ]
}

RULES:
- "file" must exactly match one of the filenames listed above.
- "path" must be a JSON array of strings copied exactly from the schema above (e.g. ["training","optimizer","lr"]). NEVER use dot notation like "training.optimizer.lr".
- "value" must preserve the original type: number→number, boolean→boolean, string→string.
- Apply numeric instructions precisely: "reduce by factor of 3" = divide by 3, "double" = ×2, "halve" = ÷2, "set to X" = replace with X, "increase by 10%" = multiply by 1.1.
- If a field appears in multiple files and the user doesn't specify which, patch all of them.
- If the instruction is ambiguous or no fields match, return an empty patches array.
- Only include fields that actually need to change.
- The "summary" should be human-readable and mention the field name(s) and new value(s).
- Return ONLY the JSON object. Any other text will break the parser.`;

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
                  if (!Array.isArray(parsed.patches)) throw new Error('Missing patches array');
                } catch (e) {
                  // Fallback: maybe the model returned a bare array (old behaviour)
                  try {
                    const arr = JSON.parse(text);
                    if (Array.isArray(arr)) {
                      parsed = { summary: '', patches: arr };
                    } else {
                      throw new Error('Unrecognised format');
                    }
                  } catch {
                    panel.webview.postMessage({
                      type: 'agentResult',
                      error: `Could not parse model response: ${e.message}. Raw: "${text.slice(0, 150)}"`
                    });
                    return;
                  }
                }

                panel.webview.postMessage({
                  type: 'agentResult',
                  summary: parsed.summary || '',
                  patches: parsed.patches,
                });

              } catch (e) {
                panel.webview.postMessage({ type: 'agentResult', error: e.message || String(e) });
              }
            })();
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
