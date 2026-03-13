# Config Dashboard

**Config Dashboard** is a Visual Studio Code extension that lets you visually browse and edit YAML configuration files — without writing YAML by hand.

It renders a tabbed, hierarchical form with type-aware controls for every parameter in your config files. Designed for ML experiment configs, but works with any YAML.

![Config Dashboard screenshot](https://raw.githubusercontent.com/dfaroughy/yaml-config-dashboard/main/Screenshot.png)

---

## Features

### Agentic CLI (Copilot-powered)

- **Natural-language config editing** — type a plain-English instruction in the prompt bar (e.g. *"reduce learning rate by half"*) and Copilot patches matching fields across all loaded files. Changes appear as orange diff highlights; save or reset as usual.
- **Q&A mode** — ask questions about your config data (e.g. *"what does sample_source control?"*) and get answers directly in the dashboard without modifying any files.
- **Multi-file scope** — the agent pre-loads every YAML file in the folder, so it can reason about and edit multiple configs in one prompt.
- **Repo-aware context** — the agent reads your `README.md` and the raw YAML of each file for accurate understanding of deeply nested configs.
- Requires **GitHub Copilot** extension and VS Code **1.85+**.

### Visual editor

- **Multi-file tabs** — open an entire folder and switch between files in one click
- **Hierarchical sections** — nested objects are rendered as collapsible sections with per-section expand/collapse buttons on top-level groups
- **Inline pinning** — hover any field to reveal a pin icon; pinned fields stay visible in a dedicated bar above the editor for quick access
- **Type-aware controls**
  - Strings and numbers → text inputs
  - Booleans → toggle switches
  - Null values → clickable badge that converts to a string on click
  - Scalar lists → editable items with add/remove buttons
  - Object arrays → collapsible sections per item
- **Search/filter** — filter all parameters by key name or value in real time
- **Modification tracking** — modified fields and tabs show an indicator dot; unsaved changes are never lost when switching tabs
- **Per-field reset** — hover any field to reveal a reset button that restores the original value
- **Full-file reset** — reset the entire file to its last-saved state
- **Export** — copy the active config as:
  - CLI arguments (`--key value`)
  - Flat JSON (dot-notation keys)
  - Environment variables (`KEY__NESTED=value`)
- **5 themes** — Midnight (default), Slate, Nord, Forest, Light
- **Customizable UI** — fonts, font size, label color, accent color, and layout density (Compact / Comfortable / Spacious)
- **Settings persistence** — all UI preferences are saved between sessions

---

## Usage

### Open via Command Palette

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run **Config Dashboard: Open**
3. Select the folder containing your YAML files

### Open via keyboard shortcut

Press `Ctrl+Shift+Y` (`Cmd+Shift+Y` on macOS).

### Open via Explorer context menu

Right-click any folder in the Explorer sidebar and select **Config Dashboard: Open**.

---

## Editing configs

- Click a tab to load that file
- Expand a section by clicking its header
- Edit any value using the provided control
- Modified fields are highlighted in orange
- Press `Ctrl+S` / `Cmd+S` to save, or click the **Save** button
- Click **Reset** to discard all unsaved changes in the active file

---

## Settings

Open the settings panel with the gear icon (⚙) in the top-right corner.

| Setting | Options |
|---|---|
| Theme | Midnight, Slate, Nord, Forest, Light |
| Label font | Share Tech, Courier New, Roboto Mono, JetBrains Mono, Source Code Pro, Fira Mono, System Sans |
| Value font | Same options as label font |
| Font size | 10 – 18 px |
| Label color | Color picker |
| Accent color | Color picker |
| Density | Compact, Comfortable, Spacious |
| Type badges | Show/hide type labels on each field |
| Section counts | Show/hide child count in section headers |
| Auto-expand all sections | Expand everything on file load |
| Sort keys alphabetically | Override YAML key order |

---

## Export formats

With the config loaded, open the Settings panel (⚙) and use the Export section.

**CLI args** — useful for passing configs to scripts:
```
--model.lr 0.001 \
  --model.hidden_size 256 \
  --training.epochs 100
```

**Flat JSON** — dot-notation keys, single-level object:
```json
{
  "model.lr": 0.001,
  "model.hidden_size": 256,
  "training.epochs": 100
}
```

**Environment variables** — uppercase, double-underscore separators:
```
MODEL__LR=0.001
MODEL__HIDDEN_SIZE=256
TRAINING__EPOCHS=100
```

---

## Requirements

- Visual Studio Code **1.85.0** or later
- YAML files must use `.yaml` or `.yml` extension
- **Agentic CLI** requires the [GitHub Copilot](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot) extension

---

## Known limitations

- Config Dashboard edits **scalar values** (strings, numbers, booleans, nulls, and scalar lists) and **existing nested structures**. It does not support adding new top-level keys or restructuring the YAML schema.
- Multi-root workspaces: the folder picker defaults to the first workspace root.
- Fonts listed in the Settings panel that are not installed on your system will silently fall back to the system monospace font.

---

## Release notes

See [CHANGELOG.md](CHANGELOG.md).

---

## License

MIT
