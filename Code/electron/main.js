const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let mapper = null;

const SKIP_DIRS = new Set(['.git', 'node_modules', 'bin', 'obj', 'dist', '.cursor', 'src', 'src-fsharp']);
const SKIP_FILES = new Set(['package-lock.json']);

async function loadMapper() {
  try {
    mapper = require('../dist/mapper.cjs');
  } catch (err) {
    console.error('Failed to load Fable mapper:', err.message);
    mapper = null;
  }
}

function classifyFile(relPath) {
  if (relPath.endsWith('brain.yaml') || relPath.endsWith('brain.yml')) return true;
  if (relPath.endsWith('.md')) return true;
  return false;
}

function scanFolder(rootPath, currentPath, files = []) {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      scanFolder(rootPath, path.join(currentPath, entry.name), files);
    } else {
      if (SKIP_FILES.has(entry.name)) continue;
      const fullPath = path.join(currentPath, entry.name);
      const relPath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
      if (!classifyFile(relPath)) continue;
      const content = fs.readFileSync(fullPath, 'utf-8');
      files.push([relPath, content]);
    }
  }

  return files;
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
    backgroundColor: '#F8F9FA',
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
  loadMapper();
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
  if (!mapper || !mapper.mapFolder) {
    throw new Error('Fable mapper not loaded. Run npm run build first.');
  }
  const files = scanFolder(folderPath, folderPath);
  return mapper.mapFolder(folderPath, files);
});

ipcMain.handle('apply-updates', async (_event, { rootPath, updates }) => {
  if (!updates || updates.length === 0) return false;

  for (const update of updates) {
    const fullPath = path.join(rootPath, update.yamlPath);
    if (!fs.existsSync(fullPath)) continue;

    let content = fs.readFileSync(fullPath, 'utf-8');
    const linkStart = content.indexOf('links:');

    const formatLinks = (links) => {
      const entries = (links || []).map((l) => `  "${l.key}": "${l.value}"`);
      if (entries.length === 0) return 'links: {}';
      return 'links:\n' + entries.join('\n');
    };

    const newSection = formatLinks(update.newLinks || []);

    if (linkStart < 0) {
      content = content.trimEnd() + '\n' + newSection + '\n';
    } else {
      const after = content.substring(linkStart);
      const lines = after.split('\n');
      let endIdx = 1;
      for (let i = 1; i < lines.length; i++) {
        const t = lines[i].trimStart();
        if (t.startsWith('"') || (t.includes(': ') && !t.startsWith('#'))) {
          endIdx = i + 1;
        } else if (t && !t.startsWith('#') && !t.startsWith('-')) {
          break;
        }
      }
      const before = content.substring(0, linkStart);
      const rest = lines.slice(endIdx).join('\n');
      content = before + newSection + '\n' + rest;
    }

    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  return true;
});

ipcMain.handle('get-design-theme', () => {
  if (!mapper || !mapper.getDesignTheme) return null;
  return mapper.getDesignTheme();
});

ipcMain.handle('read-file', async (_event, filePath) => {
  try {
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
});
