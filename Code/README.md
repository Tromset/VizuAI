# Code — application source

> 🧠 [Parent hub](../README.md) · [Variables](brain.yaml)

Files in this folder **talk to the machine**: source, manifests, and runtime configs. Agents should read [Agents/project.md](../Agents/project.md) and [Agents/objectives.md](../Agents/objectives.md) before changing anything here. Humans who want to run the app should open [getting-started.md](../getting-started.md) at the repo root — not a guide inside this folder.

`brain.yaml` in this folder is the navigation exception (brAIn rule 6), not application code.

## Files

| File | What it contains |
|---|---|
| [brain.yaml](brain.yaml) | Routing table for this folder |
| [package.json](package.json) | Electron app — `npm start` |
| [fableconfig.json](fableconfig.json) | Fable compiler config |

## Subfolders

| Path | Purpose |
|---|---|
| `src-fsharp/` | Fable 5.1 — link extraction, brain.yaml parsing, graph builder |
| `electron/` | Electron main process and preload |
| `public/` | Renderer UI (Gemini-inspired design) |
| `dist/` | Compiled mapper bundle (generated) |
