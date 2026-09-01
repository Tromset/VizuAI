const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('brainMapper', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  mapFolder: (path) => ipcRenderer.invoke('map-folder', path),
  applyUpdates: (rootPath, updates) =>
    ipcRenderer.invoke('apply-updates', { rootPath, updates }),
  getDesignTheme: () => ipcRenderer.invoke('get-design-theme'),
  readFile: (path) => ipcRenderer.invoke('read-file', path),
});
