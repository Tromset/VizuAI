# Code — application source

> 🧠 [Parent hub](../README.md) · [Variables](brain.yaml)

Implementation lives here. Agents should read [Agents/project.md](../Agents/project.md) and [Agents/objectives.md](../Agents/objectives.md) before adding code.

## Files

| File | What it contains |
|---|---|
| [getting-started.md](getting-started.md) | Install, run, and use brAIn Mapper |
| [brain.yaml](brain.yaml) | Routing table for this folder |
| [package.json](package.json) | Electron app — `npm start` |

## Subfolders

| Path | Purpose |
|---|---|
| `src/` | Core logic — link extraction, brain.yaml parsing, graph builder |
| `electron/` | Electron main process and preload |
| `public/` | Renderer UI (HTML/CSS/JS) |
| `test/` | Mapper unit tests — `npm test` |

## Quick start

```bash
cd Code
npm install
npm start
```
