const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getStaticStats: () => ipcRenderer.invoke('get-static-stats'),
  getDynamicStats: () => ipcRenderer.invoke('get-dynamic-stats'),
  startTraining: (config) => ipcRenderer.send('start-training', config),
  stopTraining: () => ipcRenderer.send('stop-training'),
  onTrainingLog: (callback) => ipcRenderer.on('training-log', (event, value) => callback(value)),
  onTrainingFinished: (callback) => ipcRenderer.on('training-finished', (event, code) => callback(code)),
  removeLogListener: () => ipcRenderer.removeAllListeners('training-log'),
  // Settings API
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // Testing / Inference API
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  openVideoDialog: () => ipcRenderer.invoke('dialog:openVideo'),
  openDirectoryDialog: () => ipcRenderer.invoke('dialog:openDirectory'),
  getModelList: () => ipcRenderer.invoke('get-model-list'),
  runInference: (path, options) => ipcRenderer.invoke('run:inference', path, options),
  runBatchInference: (path, options) => ipcRenderer.invoke('run:batch-inference', path, options),
  openCamera: (options) => ipcRenderer.invoke('run:live-camera', options),
  stopInference: () => ipcRenderer.send('stop-inference'),
  updateConfidence: (conf) => ipcRenderer.send('update-confidence', conf),
  onInferenceProgress: (callback) => ipcRenderer.on('inference-progress', (event, progress) => callback(progress)),
  onInferenceStream: (callback) => ipcRenderer.on('inference-stream', (event, frame) => callback(frame)),
  onCameraReady: (callback) => ipcRenderer.on('camera-ready', (event) => callback()),
  onInferenceData: (callback) => ipcRenderer.on('inference-data', (event, data) => callback(data)),
  removeProgressListeners: () => {
      ipcRenderer.removeAllListeners('inference-progress');
      ipcRenderer.removeAllListeners('inference-stream');
      ipcRenderer.removeAllListeners('inference-data');
  }
});
