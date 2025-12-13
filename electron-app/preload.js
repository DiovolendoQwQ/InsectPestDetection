const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getStaticStats: () => ipcRenderer.invoke('get-static-stats'),
  getDynamicStats: () => ipcRenderer.invoke('get-dynamic-stats'),
  startTraining: (config) => ipcRenderer.send('start-training', config),
  stopTraining: () => ipcRenderer.send('stop-training'),
  onTrainingLog: (callback) => ipcRenderer.on('training-log', (event, value) => callback(value)),
  onTrainingFinished: (callback) => ipcRenderer.on('training-finished', (event, code) => callback(code)),
  removeLogListener: () => ipcRenderer.removeAllListeners('training-log'),
});
