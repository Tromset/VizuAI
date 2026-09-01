const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const mapper = require('../src/mapper');

let mainWindow = null;

const SKIP_DIRS = new Set(['.git', 'node_modules', '.cursor', 'dist', 'bin', 'obj']);

/**
 * Collecte récursivement les documents (.md, brain.yaml) avec leur contenu,
 * ainsi que les chemins de tous les fichiers (pour la résolution des liens).
 */
function scanFolder(rootPath, currentPath, result = { docs: [], allPaths: [] }) {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      scanFolder(rootPath, path.join(currentPath, entry.name), result);
    } else if (entry.isFile()) {
      const fullPath = path.join(currentPath, entry.name);
      const relPath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
      result.allPaths.push(relPath);
      if (mapper.classifyFile(relPath) !== 'other') {
        result.docs.push([relPath, fs.readFileSync(fullPath, 'utf-8')]);
      }
    }
  }

  return result;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'brAIn Mapper',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0B0E14',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'public', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Sélectionner un dossier brAIn à mapper',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('map-folder', async (_event, folderPath) => {
  const { docs, allPaths } = scanFolder(folderPath, folderPath);
  return mapper.mapFolder(folderPath, docs, allPaths);
});

ipcMain.handle('apply-updates', async (_event, { rootPath, updates }) => {
  for (const update of updates || []) {
    const fullPath = path.join(rootPath, update.yamlPath);
    if (!fs.existsSync(fullPath)) continue;

    const links = {};
    for (const { key, value } of update.newLinks || []) links[key] = value;

    const content = fs.readFileSync(fullPath, 'utf-8');
    fs.writeFileSync(fullPath, mapper.updateYamlLinks(content, links), 'utf-8');
  }

  return true;
});
