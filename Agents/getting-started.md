# Getting started — VizuAI development

> 🧠 [Hub](README.md) · [Variables](brain.yaml) · [Project context](../Agents/project.md)

How to scaffold and run VizuAI. Update this file once the stack is chosen.

## Recommended next steps

1. Pick a stack (e.g. Next.js + D3, or Python + Plotly).
2. Create `src/` under this folder with its own `README.md` and `brain.yaml`.
3. Add a `package.json` or `pyproject.toml` — keep machine configs as JSON/TOML (rule 5); link them from the hub.

## Local development (placeholder)

```bash
# After scaffolding:
# npm install && npm run dev
# or: uv sync && uv run python -m vizuai
```

## Folder conventions

| Path | Purpose |
|---|---|
| `src/` | Application source |
| `tests/` | Test suites |
| `config/` | Machine-readable configs (`.json`) — link from hub, do not convert to Markdown |

When adding a subfolder, always add `README.md` + `brain.yaml` and link it from this hub.
