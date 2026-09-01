# Getting started — brAIn Mapper

> 🧠 [Hub](README.md) · [Variables](brain.yaml) · [Project context](../Agents/project.md)

Application Electron pour cartographier un dossier brAIn : détection automatique des hyperliens Markdown et mise à jour des `brain.yaml`.

## Prérequis

- Node.js 18+

## Installation

```bash
cd Code
npm install
```

## Lancement

```bash
npm start
```

## Utilisation

1. Cliquez sur **Mapper un dossier** et sélectionnez la racine de votre brAIn.
2. L'app scanne les fichiers `.md` et `brain.yaml`, extrait les hyperliens (`[texte](fichier.md)`, wikilinks `[[page]]`).
3. Le graphe affiche les connexions : losanges violets pour les `brain.yaml`, cercles bleus pour les hubs (`README.md`), arêtes pointillées pour la structure parent → enfant.
4. La sidebar montre l'arborescence brAIn, les statistiques, les liens cassés et les fichiers orphelins.
5. **Appliquer les liens** met à jour les sections `links:` des `brain.yaml` détectés.

## Architecture

| Couche | Technologie | Rôle |
|---|---|---|
| Logique métier | **JavaScript** ([src/mapper.js](src/mapper.js)) | Extraction de liens, parsing brain.yaml, graphe |
| Shell desktop | **Electron** | Scan fichiers, IPC, fenêtre |
| Visualisation | **Cytoscape.js** | Graphe interactif des hyperliens |

Aucun modèle IA n'est intégré à l'application : c'est un outil local, hors-ligne, sans clé d'API.

## Structure

```
Code/
├── src/mapper.js     # Cœur : liens, brain.yaml, graphe
├── electron/         # Process principal Electron + preload
├── public/           # UI renderer (HTML/CSS/JS)
├── test/             # Tests du mapper (npm test)
└── package.json
```

## Développement

```bash
npm test              # Tests unitaires du mapper (Node pur)
npm run dev           # Electron avec logs
```
