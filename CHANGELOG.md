# Changelog

## [0.1.2] — 2026-03-13

### Added
- **Agentic CLI bar**: natural-language prompt bar powered by GitHub Copilot (VS Code LM API). Type an instruction like "reduce learning rate by a factor of 3" and the agent patches all matching fields across every loaded config file in-memory. Changes appear immediately as orange diff highlights; save or reset as usual.
- **Multi-file agent scope**: the agent pre-loads all YAML files in the folder before sending the request, so it can reason across and patch multiple files in a single prompt.
- **Agent response strip**: Copilot's one-sentence summary of what it changed is shown below the prompt bar after each run, along with a per-field diff list (old → new values).
- **Repo context in agent prompt**: the agent reads `README.md` from the config folder (or its parent) and includes it as context so Copilot understands the project.
- **Raw YAML context**: the full raw YAML of each config file is sent to Copilot alongside the flat field schema, improving accuracy on deeply nested hierarchical configs.
- **Inline pin buttons**: hovering over any field now reveals a minimalist pin icon and "pin"/"unpin" label on the right side of the row — replacing the previous right-click context menu.
- **Sub-section collapse buttons**: section headers now show a `[-]`/`[+]` button on hover that collapses or expands only the nested sub-sections within that section, leaving scalar fields visible.

### Changed
- Removed right-click context menu in favour of hover-reveal inline pin buttons.

---

## [0.1.1] — 2026-03-11

### Added
- Initial release
- Visual YAML editor with tabbed multi-file support
- Collapsible sections for nested configuration objects
- Type-aware controls: text inputs, boolean toggles, null badges, scalar lists, object arrays
- Per-field reset and full-file reset
- Real-time modification indicators on fields and tabs
- Search/filter across all parameter keys and values
- 5 built-in themes: Midnight, Slate, Nord, Forest, Light
- Customizable fonts, font size, label color, and accent color
- Layout density control: Compact / Comfortable / Spacious
- Export active config as CLI arguments, flat JSON, or environment variables
- Settings panel with all preferences persisted between sessions
- Keyboard shortcut `Ctrl/Cmd+S` to save the active file
- Right-click a folder in Explorer to open it directly in Config Dashboard
