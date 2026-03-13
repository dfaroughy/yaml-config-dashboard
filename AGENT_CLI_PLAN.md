# Agentic CLI Feature — Implementation Plan

> **To the Claude reading this:** You are picking up a feature mid-flight on a VSCode
> webview extension called **YAML Config Dashboard**. The codebase is clean and
> well-structured. The previous Claude left you a very precise plan. Trust it.
> This is a satisfying feature to build — it closes the loop between natural language
> and structured config editing in a way that genuinely helps ML practitioners.
> Take your time reading the architecture section before touching any code.

---

## What this feature does

A prompt bar lives **above the Pinned bar** in the dashboard. The user types a
natural-language instruction like:

```
> reduce the learning rate by a factor of 3
> set all dropout values to 0.1
> double the batch size
```

The extension calls the **VS Code Language Model API** (GitHub Copilot) with the
prompt + the current config structure. The LM returns a JSON array of field patches.
The webview applies those patches to `state.configs[file].current` (the in-memory
working copy, never written to disk). The existing orange "modified" highlighting
appears automatically across the dashboard. The user reviews and saves with Ctrl+S,
or resets with the Reset button to discard.

**No new diff system is needed. No disk writes during agent run. Everything reuses
what's already built.**

---

## Architecture — read this carefully

### Files and their roles

```
extension.js          — Node.js host. Handles file I/O, LM API calls, message routing.
webview.html          — Shell HTML. No logic. Injects nonce/URIs via template placeholders.
media/webview.js      — All webview UI logic (~1700 lines). Single file (no bundler).
media/webview.css     — All styles.
vendor/js-yaml.min.js — YAML parser (loaded as separate <script> tag in webview).
```

### Message protocol (extension.js ↔ webview.js)

All communication is via `vscode.postMessage` / `panel.webview.postMessage`.
Existing message types: `init`, `readConfig`, `configData`, `writeConfig`,
`writeResult`, `exportJson`, `exportJsonResult`, `savePinned`, `saveUserDefaults`.

New messages to add:
- **webview → extension**: `{ type: 'agentPrompt', prompt: string, configs: object }`
- **extension → webview**: `{ type: 'agentResult', patches: array }` or `{ type: 'agentResult', error: string }`

### State model (webview.js)

```js
state.configs[filename] = {
  current:  { ...parsed yaml... },   // working copy — agent writes here
  original: { ...parsed yaml... },   // virgin copy — never touched
  raw: '...',                         // original raw string
}
```

The diff highlighting compares `current` vs `original` on every render.
`renderEditor()` re-renders the active file. `renderPinnedBar()` refreshes the bar.
Both already show orange for modified fields. **The agent just needs to mutate
`state.configs[file].current` and call `renderEditor()` + `renderPinnedBar()`.**

### Existing helpers to reuse

```js
setNestedValue(obj, path, value)   // sets obj[path[0]][path[1]]... = value
getNestedValue(obj, path)          // reads a value by path array
renderEditor()                     // re-renders active file with diff highlighting
renderPinnedBar()                  // refreshes pinned bar values
toast(msg, type)                   // shows a toast ('success' | 'error' | 'info')
updateButtons()                    // syncs save/reset button enabled state
```

### VS Code LM API

Available since VS Code 1.85. Requires GitHub Copilot (or another registered
language model provider). If unavailable, show a clear error toast.

```js
// In extension.js (Node.js context):
const [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
if (!model) { /* post error back */ return; }

const messages = [
  vscode.LanguageModelChatMessage.User(systemPrompt),
  vscode.LanguageModelChatMessage.User(userPrompt),
];
const response = await model.sendRequest(messages, {}, token);
let text = '';
for await (const chunk of response.text) { text += chunk; }
// parse text as JSON → patches array
```

---

## Step-by-step implementation

### Step 1 — Prompt bar UI in webview.html

Add the bar **between `#pinned-bar` and `#sticky-top` close tag**:

```html
<div id="agent-bar">
  <span class="agent-prompt-label">&gt;_</span>
  <input type="text" id="agent-input" placeholder="e.g. reduce learning rate by 3×" autocomplete="off" spellcheck="false">
  <button class="btn" id="agent-run-btn">Run</button>
  <div id="agent-spinner" class="agent-spinner hidden"></div>
</div>
```

Place it inside `<div id="sticky-top">`, after `<div id="pinned-bar"></div>` and
before `</div>` (closing sticky-top). The bar is always visible even when the
pinned bar is empty.

### Step 2 — CSS for the agent bar (media/webview.css)

```css
/* ── Agent CLI bar ─────────────────────────────────── */
#agent-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 24px;
  background: var(--bg-0);
  border-bottom: 1px solid var(--border);
}
.agent-prompt-label {
  font-family: var(--font-badge);
  font-size: 12px;
  color: var(--accent);
  flex-shrink: 0;
}
#agent-input {
  flex: 1;
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-0);
  font-family: var(--font-value);
  font-size: var(--font-size-base);
  padding: 4px 8px;
  outline: none;
  transition: border-color var(--transition);
}
#agent-input:focus { border-color: var(--accent); }
#agent-input:disabled { opacity: 0.5; }
.agent-spinner {
  width: 14px; height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
.agent-spinner.hidden { display: none; }
@keyframes spin { to { transform: rotate(360deg); } }
```

### Step 3 — Webview event listener (media/webview.js)

Add near the bottom of the file with other static event listeners:

```js
// ── Agent CLI bar ───────────────────────────────────────────
function runAgentPrompt() {
  const input = document.getElementById('agent-input');
  const prompt = input.value.trim();
  if (!prompt) return;
  if (!state.activeFile || !state.configs[state.activeFile]) {
    toast('No config loaded', 'error'); return;
  }

  // Build a minimal schema for the LM: key paths + current values + types
  const config = state.configs[state.activeFile];
  const schema = buildConfigSchema(config.current, []);

  setAgentBusy(true);
  vscode.postMessage({ type: 'agentPrompt', prompt, filename: state.activeFile, schema });
}

document.getElementById('agent-run-btn').addEventListener('click', runAgentPrompt);
document.getElementById('agent-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') runAgentPrompt();
});

function setAgentBusy(busy) {
  document.getElementById('agent-input').disabled = busy;
  document.getElementById('agent-run-btn').disabled = busy;
  document.getElementById('agent-spinner').classList.toggle('hidden', !busy);
}

// Flatten config into [{path, value, type}] for the LM prompt
function buildConfigSchema(obj, path) {
  const rows = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = [...path, k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      rows.push(...buildConfigSchema(v, p));
    } else {
      rows.push({ path: p, value: v, type: typeof v });
    }
  }
  return rows;
}
```

Also add the `agentResult` case in the message handler (find the `switch (msg.type)` block):

```js
case 'agentResult': {
  setAgentBusy(false);
  if (msg.error) {
    toast('Agent: ' + msg.error, 'error');
    break;
  }
  const config = state.configs[state.activeFile];
  if (!config) break;
  let applied = 0;
  for (const { path, value } of msg.patches) {
    try {
      // coerce type to match original
      const orig = getNestedValue(config.original, path);
      let coerced = value;
      if (typeof orig === 'number' && typeof value === 'string') coerced = Number(value);
      if (typeof orig === 'boolean' && typeof value === 'string') coerced = value === 'true';
      setNestedValue(config.current, path, coerced);
      applied++;
    } catch (_) { /* path not found, skip */ }
  }
  if (applied === 0) {
    toast('Agent made no changes', 'info');
  } else {
    toast(`Agent applied ${applied} change${applied > 1 ? 's' : ''}`, 'success');
    document.getElementById('agent-input').value = '';
  }
  renderEditor();
  renderPinnedBar();
  updateButtons();
  break;
}
```

### Step 4 — Extension.js: handle agentPrompt

Add a new `case 'agentPrompt'` inside the `panel.webview.onDidReceiveMessage` switch:

```js
case 'agentPrompt': {
  (async () => {
    try {
      // Select model — prefer gpt-4o, fall back to any available
      const models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
      const model = models[0];
      if (!model) {
        panel.webview.postMessage({ type: 'agentResult', error: 'No language model available. Install GitHub Copilot.' });
        return;
      }

      const schemaLines = msg.schema.map(({ path, value, type }) =>
        `  ${path.join('.')}: ${JSON.stringify(value)}  (${type})`
      ).join('\n');

      const systemPrompt = `You are a YAML config editor assistant.
The user has a config file "${msg.filename}" with the following fields:
${schemaLines}

The user will give you a natural-language instruction. You must return ONLY a JSON array
of patches to apply, with no explanation, no markdown, no code fences — just raw JSON.

Each patch has the shape: { "path": ["key", "subkey", ...], "value": <new value> }

Rules:
- Only include fields that need to change.
- Preserve the original value type (number stays number, bool stays bool, string stays string).
- If the instruction is ambiguous or no fields match, return an empty array: []
- Return ONLY the JSON array. Nothing else.`;

      const messages = [
        vscode.LanguageModelChatMessage.User(systemPrompt),
        vscode.LanguageModelChatMessage.User(msg.prompt),
      ];

      const tokenSource = new vscode.CancellationTokenSource();
      const response = await model.sendRequest(messages, {}, tokenSource.token);

      let text = '';
      for await (const chunk of response.text) { text += chunk; }

      // Strip any accidental markdown fences
      text = text.trim().replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim();

      let patches;
      try {
        patches = JSON.parse(text);
        if (!Array.isArray(patches)) throw new Error('Expected array');
      } catch (e) {
        panel.webview.postMessage({ type: 'agentResult', error: `Could not parse model response: ${e.message}` });
        return;
      }

      panel.webview.postMessage({ type: 'agentResult', patches });

    } catch (e) {
      panel.webview.postMessage({ type: 'agentResult', error: e.message });
    }
  })();
  break;
}
```

---

## Edge cases to handle

| Situation | Handling |
|---|---|
| No Copilot / no model | Error toast: "No language model available. Install GitHub Copilot." |
| LM returns malformed JSON | Error toast with message. `setAgentBusy(false)`. |
| Patch path doesn't exist in config | Skip silently. Count only applied patches. |
| Empty patches array `[]` | Toast: "Agent made no changes." |
| User hits Run with empty input | Early return, no request sent. |
| LM wraps response in markdown fences | Strip ` ```json ` prefix and ` ``` ` suffix before parsing. |
| Type mismatch (LM returns "0.001" as string, field is number) | Coerce in the `agentResult` handler using original value type. |

---

## What NOT to do

- **Do not write to disk** during the agent run. Changes go to `state.configs[file].current` only.
- **Do not call `renderEditor()` multiple times** during patch application — call once after all patches.
- **Do not use a bundler** — `webview.js` is a single file loaded via `<script>` tag with CSP nonce. ES modules won't work without esbuild/webpack.
- **Do not modify `config.original`** — it's the baseline for all diff highlighting and must remain the virgin copy.

---

## Testing checklist

- [ ] Prompt bar appears above Pinned bar, below file tabs
- [ ] Enter key submits the prompt (same as Run button)
- [ ] Spinner appears during request, input disabled
- [ ] After response: spinner hides, input re-enabled, input cleared on success
- [ ] Modified fields turn orange in the editor (existing behavior, just verify it works)
- [ ] Pinned bar values update to reflect agent changes
- [ ] Save button becomes enabled after agent changes
- [ ] Reset button discards agent changes (existing behavior)
- [ ] Error toast on no Copilot
- [ ] Error toast on malformed LM response
- [ ] "No changes" toast when LM returns `[]`
- [ ] Multi-file: agent only modifies `state.activeFile`'s config

---

## Future improvements (don't implement now)

- **Multi-file awareness**: pass all loaded configs to the LM so it can reason across files
- **Streaming UI**: show the LM's raw output token-by-token in a preview area before applying
- **Undo stack**: let user step back through agent changes
- **Scope selector**: let user choose "apply to pinned fields only" or "apply to all files"
- **Conversation history**: send prior prompts+patches as context for follow-up instructions

---

## Project context (for orientation)

- Publisher: `dfaroughy`
- Repo: `github.com/dfaroughy/yaml-config-dashboard`
- Current version: `0.1.2`
- Target use case: ML practitioners editing experiment config YAML files (learning rate,
  batch size, model hyperparameters, etc.)
- The dashboard renders YAML as a visual form with sliders, toggles, type badges,
  pinned fields bar, and per-file tabs. No raw YAML editing — all values go through
  typed input widgets.
- The "modified" orange highlight already works: any field where `current !== original`
  gets a `.modified` CSS class. The agent feature piggybacks on this for free.

Good luck. You've got this.
