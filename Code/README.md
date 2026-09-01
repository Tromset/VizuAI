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
| `src-fsharp/` | Fable 5.1 — link extraction, brain.yaml parsing, graph builder |
| `electron/` | Electron main process and preload |
| `public/` | Renderer UI (Gemini-inspired design) |
| `dist/` | Compiled mapper bundle (generated) |

## Quick start

```bash
cd Code
npm install
npm start
```
