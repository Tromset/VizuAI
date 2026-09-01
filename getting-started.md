# Getting started — brAIn Mapper

> 🧠 [Hub](README.md) · [Variables](brain.yaml) · [Project context](Agents/project.md)

How to install, run, and use brAIn Mapper, the Electron app that maps a brAIn folder: it detects Markdown hyperlinks and can update `brain.yaml` `links:` sections.

This file talks to **you**. Agent context lives in [Agents/](Agents/README.md). Source the machine runs lives in [Code/](Code/README.md).

## Prerequisites

- Node.js 18+
- .NET SDK 10+ (to compile Fable 5.1)

## Installation

```bash
cd Code
npm install
dotnet tool install --global fable --version 5.1.0
```

## Launch

```bash
npm start
```

This compiles Fable 5.1, bundles the mapper, then opens the Electron app.

## Usage

1. Click **Mapper un dossier** and select the root of your brAIn.
2. The app scans `.md` and `brain.yaml` files and extracts hyperlinks (`[text](file.md)`, hub links `🧠`, wikilinks `[[page]]`).
3. The Cytoscape graph shows connections between files.
4. The sidebar shows the brAIn tree, stats, and orphan files.
5. **Appliquer les liens** updates the `links:` sections of detected `brain.yaml` files.

## Architecture

| Layer | Technology | Role |
|---|---|---|
| Domain logic | **Fable 5.1** (F#) | Link extraction, brain.yaml parsing, graph |
| Design tokens | **Gemini 3.1 Pro / 3.7 Flash** (via `GeminiDesign.fs`) | Layout + Material CSS variables |
| Desktop shell | **Electron** | File scan, IPC, window |
| Visualization | **Cytoscape.js** | Interactive hyperlink graph |

Fable orchestrates Gemini for design: `GeminiDesign.fs` simulates the Pro (layout) → Flash (tokens) pipeline.

## Where the code lives

```
Code/                 # machine-addressed source (this repo)
├── src-fsharp/       # F# sources (Fable 5.1)
├── dist/mapper.cjs   # CommonJS bundle for Electron (generated)
├── electron/         # Electron main process
├── public/           # Renderer UI (HTML/CSS/JS)
└── package.json
```

Each of those folders may also contain a `brain.yaml` navigation card. That file is not application code; leave it there.

## Development

```bash
cd Code
npm run build:fable   # Compile F# → JS
npm run build:bundle  # Bundle esbuild → dist/mapper.cjs
npm run dev           # Build + Electron with logs
```
