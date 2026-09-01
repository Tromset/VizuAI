# Getting started — brAIn Mapper

> 🧠 [Hub](README.md) · [Variables](brain.yaml) · [Project context](../Agents/project.md)

Application Electron pour cartographier un dossier brAIn : détection automatique des hyperliens Markdown et mise à jour des `brain.yaml`.

## Prérequis

- Node.js 18+
- .NET SDK 10+ (pour compiler Fable 5.1)

## Installation

```bash
cd Code
npm install
dotnet tool install --global fable --version 5.1.0
```

## Lancement

```bash
npm start
```

Cela compile Fable 5.1, bundle le mapper, puis ouvre l'application Electron.

## Utilisation

1. Cliquez sur **Mapper un dossier** et sélectionnez la racine de votre brAIn.
2. L'app scanne les fichiers `.md` et `brain.yaml`, extrait les hyperliens (`[texte](fichier.md)`, liens hub `🧠`, wikilinks `[[page]]`).
3. Le graphe Cytoscape affiche les connexions entre fichiers.
4. La sidebar montre l'arborescence brAIn, les statistiques et les fichiers orphelins.
5. **Appliquer les liens** met à jour les sections `links:` des `brain.yaml` détectés.

## Architecture

| Couche | Technologie | Rôle |
|---|---|---|
| Logique métier | **Fable 5.1** (F#) | Extraction de liens, parsing brain.yaml, graphe |
| Design tokens | **Gemini 3.1 Pro / 3.7 Flash** (via `GeminiDesign.fs`) | Layout + CSS variables Material |
| Shell desktop | **Electron** | Scan fichiers, IPC, fenêtre |
| Visualisation | **Cytoscape.js** | Graphe interactif des hyperliens |

Fable orchestre Gemini pour le design : `GeminiDesign.fs` simule le pipeline Pro (layout) → Flash (tokens).

## Structure

```
Code/
├── src-fsharp/       # Sources F# (Fable 5.1)
├── dist/mapper.cjs   # Bundle CommonJS pour Electron
├── electron/         # Process principal Electron
├── public/           # UI renderer (HTML/CSS/JS)
└── package.json
```

## Développement

```bash
npm run build:fable   # Compile F# → JS
npm run build:bundle  # Bundle esbuild → dist/mapper.cjs
npm run dev           # Build + Electron avec logs
```
