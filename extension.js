const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const yaml = require('./vendor/js-yaml.min.js');

let currentPanel;

function activate(context) {
  const cmd = vscode.commands.registerCommand('configDashboard.open', async (uri) => {
    try {
      // ── Reveal existing panel if open ──────────────────────
      if (currentPanel) {
        currentPanel.reveal(vscode.ViewColumn.One);
        return;
      }

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

      currentPanel = vscode.window.createWebviewPanel(
        'configDashboard',
        'Config Dashboard',
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

      currentPanel.onDidDispose(() => { currentPanel = undefined; }, null, context.subscriptions);

      const cssUri  = currentPanel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'webview.css'));
      const yamlUri = currentPanel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'vendor', 'js-yaml.min.js'));
      const jsUri   = currentPanel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'media', 'webview.js'));
      const cspSource = currentPanel.webview.cspSource;

      const htmlPath = path.join(context.extensionPath, 'webview.html');
      let html = fs.readFileSync(htmlPath, 'utf8');
      html = html
        .replace(/\{\{NONCE\}\}/g, nonce)
        .replace(/\{\{CSP_SOURCE\}\}/g, cspSource)
        .replace('{{CSS_URI}}',  cssUri.toString())
        .replace('{{YAML_URI}}', yamlUri.toString())
        .replace('{{JS_URI}}',   jsUri.toString());
      currentPanel.webview.html = html;

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
      currentPanel.webview.onDidReceiveMessage(async (msg) => {
        switch (msg.type) {
          case 'init': {
            const files = findYamlFiles(configDir, configDir);
            currentPanel.webview.postMessage({ type: 'init', files, configDir });
            break;
          }
          case 'readConfig': {
            try {
              const filePath = path.resolve(configDir, msg.filename);
              const safeBase = path.resolve(configDir) + path.sep;
              if (!filePath.startsWith(safeBase)) {
                currentPanel.webview.postMessage({ type: 'configData', error: 'Invalid path' });
                return;
              }
              const raw    = fs.readFileSync(filePath, 'utf8');
              const parsed = yaml.load(raw);
              currentPanel.webview.postMessage({ type: 'configData', filename: msg.filename, raw, parsed });
            } catch (e) {
              currentPanel.webview.postMessage({ type: 'configData', error: e.message });
            }
            break;
          }
          case 'writeConfig': {
            try {
              const filePath = path.resolve(configDir, msg.filename);
              const safeBase = path.resolve(configDir) + path.sep;
              if (!filePath.startsWith(safeBase)) {
                currentPanel.webview.postMessage({ type: 'writeResult', error: 'Invalid path' });
                return;
              }
              const output = yaml.dump(msg.data, { flowLevel: -1, sortKeys: false });
              fs.writeFileSync(filePath, output, 'utf8');
              currentPanel.webview.postMessage({ type: 'writeResult', success: true, filename: msg.filename });
            } catch (e) {
              currentPanel.webview.postMessage({ type: 'writeResult', error: e.message });
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
