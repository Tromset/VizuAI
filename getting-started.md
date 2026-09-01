# Getting started — brAIn Mapper

> 🧠 [Hub](README.md) · [Variables](brain.yaml) · [Project context](Agents/project.md)

How to install, run, and use brAIn Mapper, the Electron app that maps a brAIn folder: it detects Markdown hyperlinks and can update `brain.yaml` `links:` sections.

This file talks to **you**. Agent context lives in [Agents/](Agents/README.md). Source the machine runs lives in [Code/](Code/README.md).

## Prerequisites

- Node.js 18+

## Installation

```bash
cd Code
npm install
```

## Launch

```bash
npm start
```

## Browser (same UI, no Electron)

```bash
npm run web
```

Opens on [http://127.0.0.1:5173](http://127.0.0.1:5173) with this repository as the default vault (`VAULT_PATH` to override).

## Usage

1. Click **Ouvrir un coffre** and select the root of your brAIn (in the browser, enter an absolute path).
2. The left ribbon switches **Fichiers**, **Graphe**, and **Problèmes**. The file tree is the full vault.
3. Click a file to open it in the editor. Edit in place, **Enregistrer** or `Ctrl+S`. Markdown has **Aperçu**.
4. `Ctrl+P` opens the file switcher. The title-bar field filters the tree by name.
5. The graph maps Markdown hyperlinks (`[text](file.md)`, `[[page]]`) and `brain.yaml` structure.
6. **Appliquer les liens** writes suggested `links:` sections into detected `brain.yaml` files.

## Architecture

| Layer | Technology | Role |
|---|---|---|
| Domain logic | **JavaScript** ([Code/src/mapper.js](Code/src/mapper.js)) | Link extraction, brain.yaml parsing, graph |
| Desktop shell | **Electron** | File scan, IPC, window |
| Visualization | **Cytoscape.js** | Interactive hyperlink graph |

No AI model is embedded in the app: it is a local, offline tool with no API key.

## Where the code lives

```
Code/                 # machine-addressed source (this repo)
├── src/mapper.js     # Core: links, brain.yaml parsing, graph
├── src/vault.js      # Vault tree, read/write, search
├── electron/         # Electron main process + preload
├── public/           # Renderer UI (HTML/CSS/JS)
├── server.js         # Browser/dev HTTP server (npm run web)
├── test/             # Unit tests (npm test)
└── package.json
```

Each of those folders may also contain a `brain.yaml` navigation card. That file is not application code; leave it there.

## Development

```bash
cd Code
npm test              # Mapper unit tests (pure Node)
npm run dev           # Electron with logs
```
