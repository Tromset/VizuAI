const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const mapper = require('../src/mapper');
const vault = require('../src/vault');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'brAIn Mapper',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0F172A',
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
    title: 'Ouvrir un coffre brAIn',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('map-folder', async (_event, folderPath) => {
  const files = vault.scanMappedFiles(folderPath);
  return mapper.mapFolder(folderPath, files);
});

ipcMain.handle('vault-tree', async (_event, folderPath) => {
  return vault.buildTree(folderPath);
});

ipcMain.handle('vault-read', async (_event, { rootPath, relPath }) => {
  return vault.readFile(rootPath, relPath);
});

ipcMain.handle('vault-write', async (_event, { rootPath, relPath, content }) => {
  return vault.writeFile(rootPath, relPath, content);
});

ipcMain.handle('vault-search', async (_event, { rootPath, query }) => {
  return vault.search(rootPath, query);
});

ipcMain.handle('apply-updates', async (_event, { rootPath, updates }) => {
  for (const update of updates || []) {
    const fullPath = require('path').join(rootPath, update.yamlPath);
    const fs = require('fs');
    if (!fs.existsSync(fullPath)) continue;

    const links = {};
    for (const { key, value } of update.newLinks || []) links[key] = value;

    const content = fs.readFileSync(fullPath, 'utf8');
    fs.writeFileSync(fullPath, mapper.updateYamlLinks(content, links), 'utf8');
  }

  return true;
});
