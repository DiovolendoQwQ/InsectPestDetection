const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getStaticStats: () => ipcRenderer.invoke('get-static-stats'),
  getDynamicStats: () => ipcRenderer.invoke('get-dynamic-stats'),
  startTraining: (config) => ipcRenderer.send('start-training', config),
  stopTraining: () => ipcRenderer.send('stop-training'),
  onTrainingLog: (callback) => ipcRenderer.on('training-log', (event, value) => callback(value)),
  onTrainingFinished: (callback) => ipcRenderer.on('training-finished', (event, code) => callback(code)),
  removeLogListener: () => ipcRenderer.removeAllListeners('training-log'),
  // Testing / Inference API
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  openVideoDialog: () => ipcRenderer.invoke('dialog:openVideo'),
  runInference: (path) => ipcRenderer.invoke('run:inference', path),
  onInferenceProgress: (callback) => ipcRenderer.on('inference-progress', (event, progress) => callback(progress)),
  onInferenceStream: (callback) => ipcRenderer.on('inference-stream', (event, frame) => callback(frame)),
  onInferenceData: (callback) => ipcRenderer.on('inference-data', (event, data) => callback(data)),
  removeProgressListeners: () => {
      ipcRenderer.removeAllListeners('inference-progress');
      ipcRenderer.removeAllListeners('inference-stream');
      ipcRenderer.removeAllListeners('inference-data');
  }
});
