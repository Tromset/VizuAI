const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('brainMapper', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  mapFolder: (path) => ipcRenderer.invoke('map-folder', path),
  applyUpdates: (rootPath, updates) =>
    ipcRenderer.invoke('apply-updates', { rootPath, updates }),
  vaultTree: (rootPath) => ipcRenderer.invoke('vault-tree', rootPath),
  readFile: (rootPath, relPath) =>
    ipcRenderer.invoke('vault-read', { rootPath, relPath }),
  writeFile: (rootPath, relPath, content) =>
    ipcRenderer.invoke('vault-write', { rootPath, relPath, content }),
  search: (rootPath, query) =>
    ipcRenderer.invoke('vault-search', { rootPath, query }),
});
