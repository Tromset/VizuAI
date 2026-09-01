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

## Usage

1. Click **Mapper un dossier** and select the root of your brAIn.
2. The app scans `.md` and `brain.yaml` files and extracts hyperlinks (`[text](file.md)`, wikilinks `[[page]]`).
3. The graph shows the connections: violet diamonds for `brain.yaml` files, blue circles for hubs (`README.md`), dashed edges for parent → child structure.
4. The sidebar shows the brAIn tree, stats, broken links, and orphan files.
5. **Appliquer les liens** updates the `links:` sections of detected `brain.yaml` files.

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
├── electron/         # Electron main process + preload
├── public/           # Renderer UI (HTML/CSS/JS)
├── test/             # Mapper unit tests (npm test)
└── package.json
```

Each of those folders may also contain a `brain.yaml` navigation card. That file is not application code; leave it there.

## Development

```bash
cd Code
npm test              # Mapper unit tests (pure Node)
npm run dev           # Electron with logs
```
