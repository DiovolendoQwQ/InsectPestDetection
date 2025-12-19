const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const si = require('systeminformation');
const glob = require('glob');
const Store = require('electron-store');
require('dotenv').config();

const store = new Store();

// Suppress security warnings in development
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false, // Don't show until ready
    backgroundColor: '#121212', // Set background to match dark theme
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: process.env.NODE_ENV !== 'development', // Disable webSecurity in dev to load local files
    },
  });

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, 'dist/index.html')}`;

  // In dev mode, load from localhost
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
      .catch(e => console.error('Failed to load localhost:', e));
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(startUrl)
      .catch(e => console.error('Failed to load local file:', e));
  }

  // Graceful showing
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

// --- IPC Handlers ---

// 1. Hardware Monitor
let cachedGpuInfo = null;

ipcMain.handle('get-static-stats', async () => {
  try {
    if (!cachedGpuInfo) {
      const gpu = await si.graphics();
      // Prefer discrete GPU (usually NVIDIA or AMD with more VRAM)
      // Sort by VRAM (descending) or look for NVIDIA keyword
      if (gpu.controllers.length > 0) {
        cachedGpuInfo = gpu.controllers.find(c => c.vendor.toLowerCase().includes('nvidia'))
          || gpu.controllers.find(c => c.vendor.toLowerCase().includes('amd'))
          || gpu.controllers[0];
      } else {
        cachedGpuInfo = { model: 'N/A' };
      }
    }
    const mem = await si.mem();
    return {
      gpu: cachedGpuInfo,
      memTotal: mem.total
    };
  } catch (error) {
    console.error('Error getting static stats:', error);
    return null;
  }
});

ipcMain.handle('get-dynamic-stats', async () => {
  try {
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    return {
      cpuLoad: cpu.currentLoad,
      memUsed: mem.used,
    };
  } catch (error) {
    console.error('Error getting dynamic stats:', error);
    return null;
  }
});

ipcMain.on('update-confidence', (event, conf) => {
    if (activeInferenceProcess && activeInferenceProcess.stdin) {
        // console.log(`Sending updated confidence: ${conf}`);
        activeInferenceProcess.stdin.write(`CONF:${conf}\n`);
    }
});

// Settings Handlers
ipcMain.handle('get-settings', async () => {
    return store.store;
});

ipcMain.handle('save-settings', async (event, settings) => {
    store.set(settings);
    return true;
});

// 2. Run Python Script (Training)
let pythonProcess = null;
let activeInferenceProcess = null;

ipcMain.on('stop-inference', () => {
    if (activeInferenceProcess) {
        console.log("Stopping active inference process...");
        activeInferenceProcess.kill();
        activeInferenceProcess = null;
    }
});

ipcMain.on('start-training', (event, args) => {
  let { pythonPath, scriptPath, params } = args;

  // 1. Check if pythonPath is passed in args (from frontend override)
  // 2. Check if pythonPath is in settings (electron-store)
  // 3. Fallback to process.env.PYTHON_PATH or 'python'
  
  if (!pythonPath || pythonPath.includes('D:\\Anaconda')) {
      const settingsPython = store.get('pythonPath');
      if (settingsPython && settingsPython.trim() !== '') {
          pythonPath = settingsPython;
      } else {
          pythonPath = process.env.PYTHON_PATH || 'python';
      }
  }

  // Construct arguments
  // Example params: { epochs: 50, batch: 16, data: 'data/data.yaml' }
  const cmdArgs = [scriptPath];
  if (params && params.epochs) {
    cmdArgs.push('--epochs', params.epochs.toString());
  }

  // Note: train.py needs to be modified to accept args or we pass them differently.
  // For now, let's assume we are calling a wrapper or the script uses argparse.
  // Or we can set environment variables.

  console.log(`Starting python process: ${pythonPath} ${scriptPath}`);

  // If params are passed as CLI args
  // For ultralytics CLI style: yolo train model=...
  // For our script src/train.py, it currently doesn't accept args well, 
  // but we can spawn the command directly if we want.
  // Let's assume we modify train.py to accept args or we use `yolo` cli.

  // However, for this demo, let's spawn the process

  // Set cwd to the project root (one level up from electron-app)
  const projectRoot = path.resolve(__dirname, '..');

  pythonProcess = spawn(pythonPath, cmdArgs, {
    cwd: projectRoot,
    env: { ...process.env, PYTHONUNBUFFERED: '1' } // Ensure stdout is flushed immediately
  });

  pythonProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`stdout: ${output}`);
    event.reply('training-log', output);
  });

  pythonProcess.stderr.on('data', (data) => {
    const output = data.toString();
    console.error(`stderr: ${output}`);
    event.reply('training-log', output); // stderr is also log
  });

  pythonProcess.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
    event.reply('training-finished', code);
    pythonProcess = null;
  });
});

ipcMain.on('stop-training', () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
  }
});

// 3. Inference & File Dialog
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'bmp', 'webp'] }
    ]
  });
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});

ipcMain.handle('dialog:openVideo', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Videos', extensions: ['mp4', 'avi', 'mov', 'mkv', 'webm'] }
    ]
  });
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});

ipcMain.handle('dialog:openDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (canceled) {
    return null;
  } else {
    return filePaths[0];
  }
});

ipcMain.handle('run:batch-inference', async (event, folderPath, options = {}) => {
  return new Promise((resolve) => {
    let pythonPath = process.env.PYTHON_PATH || 'python';
    
    // Check settings first
    const settingsPython = store.get('pythonPath');
    if (settingsPython && settingsPython.trim() !== '') {
        pythonPath = settingsPython;
    } else if (pythonPath.includes('D:\\Anaconda')) {
        pythonPath = 'python';
    }

    const scriptPath = 'src/batch_predict.py';
    const projectRoot = path.resolve(__dirname, '..');
    
    const args = [scriptPath, '--source_dir', folderPath];
    if (options.modelPath) {
        args.push('--model', options.modelPath);
    }
    
    console.log(`Starting batch inference on: ${folderPath}`);

    const child = spawn(pythonPath, args, {
      cwd: projectRoot,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    activeInferenceProcess = child;

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdoutData += chunk;
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderrData += output;
      console.log(`Batch Stderr: ${output}`);
      
      const match = output.match(/PROGRESS:(\d+)/);
      if (match) {
        const progress = parseInt(match[1]);
        event.sender.send('inference-progress', progress);
      }
    });

    child.on('close', (code) => {
      if (activeInferenceProcess === child) {
          activeInferenceProcess = null;
      }
      if (code !== 0) {
        console.error(`Batch inference failed with code ${code}`);
        resolve({ error: `Process exited with code ${code}`, details: stderrData });
        return;
      }

      try {
        const startMarker = "__JSON_START__";
        const endMarker = "__JSON_END__";
        
        const startIndex = stdoutData.indexOf(startMarker);
        const endIndex = stdoutData.indexOf(endMarker);

        if (startIndex !== -1 && endIndex !== -1) {
            const jsonStr = stdoutData.substring(startIndex + startMarker.length, endIndex).trim();
            const result = JSON.parse(jsonStr);
            resolve(result);
        } else {
            console.error("Could not find JSON markers in output");
            resolve({ error: "Invalid output format from batch script", raw: stdoutData });
        }
      } catch (e) {
        console.error("Failed to parse batch result:", e);
        resolve({ error: "Failed to parse result", details: e.message });
      }
    });
  });
});

ipcMain.handle('run:live-camera', async (event, options = {}) => {
  return new Promise((resolve) => {
    let pythonPath = process.env.PYTHON_PATH || 'python';
    
    // Check settings first
    const settingsPython = store.get('pythonPath');
    if (settingsPython && settingsPython.trim() !== '') {
        pythonPath = settingsPython;
    } else if (pythonPath.includes('D:\\Anaconda')) {
        pythonPath = 'python';
    }

    const scriptPath = 'src/live_camera.py';
    const projectRoot = path.resolve(__dirname, '..');
    
    const args = [scriptPath];
    if (options.modelPath) {
        args.push('--model', options.modelPath);
    }
    if (options.conf) {
        args.push('--conf', options.conf.toString());
    }
    
    console.log(`Starting live camera with model: ${options.modelPath}, conf: ${options.conf}`);

    // Kill any existing inference process
    if (activeInferenceProcess) {
        try {
            activeInferenceProcess.kill();
        } catch (e) {
            console.error("Failed to kill existing process:", e);
        }
        activeInferenceProcess = null;
    }

    const child = spawn(pythonPath, args, {
      cwd: projectRoot,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    activeInferenceProcess = child;

    let stdoutBuffer = '';

    child.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdoutBuffer += chunk;
        
        // Process buffered lines
        let newlineIndex;
        while ((newlineIndex = stdoutBuffer.indexOf('\n')) !== -1) {
            const line = stdoutBuffer.slice(0, newlineIndex).trim();
            stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
            
            if (line.startsWith('STREAM_FRAME:')) {
                const base64Data = line.substring('STREAM_FRAME:'.length);
                event.sender.send('inference-stream', `data:image/jpeg;base64,${base64Data}`);
                event.sender.send('camera-ready'); // Signal that camera is active
            }
        }
    });

    child.stderr.on('data', (data) => console.log(`Camera stderr: ${data}`));

    child.on('close', (code) => {
      console.log(`Camera process exited with code ${code}`);
      if (activeInferenceProcess === child) {
          activeInferenceProcess = null;
      }
      resolve({ success: code === 0 });
    });
  });
});

ipcMain.handle('get-model-list', async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const models = [];

  const globPromise = (pattern) => {
      return new Promise((resolve) => {
          glob(pattern, (err, files) => {
              if (err) {
                  console.error("Error scanning:", pattern, err);
                  resolve([]);
              } else {
                  resolve(files);
              }
          });
      });
  };

  const runsPath = path.join(projectRoot, 'runs/detect/**/weights/best.pt').replace(/\\/g, '/');
  const trainingPath = path.join(projectRoot, 'training_output/**/weights/best.pt').replace(/\\/g, '/');
  const rootPath = path.join(projectRoot, '*.pt').replace(/\\/g, '/');

  try {
      const [runsFiles, trainingFiles, rootFiles] = await Promise.all([
          globPromise(runsPath),
          globPromise(trainingPath),
          globPromise(rootPath)
      ]);

      // 1. Process runs/detect
      runsFiles.forEach(file => {
          const parts = file.split('/');
          const weightsIndex = parts.indexOf('weights');
          let runName = 'Unknown Run';
          if (weightsIndex > 0) {
              runName = parts[weightsIndex - 1];
          }
          models.push({
              name: `Runs: ${runName} (best.pt)`,
              path: path.resolve(file)
          });
      });

      // 2. Process training_output
      trainingFiles.forEach(file => {
          // Format: .../training_output/<run_id>/yolo_logs/train/weights/best.pt
          const parts = file.split('/');
          const outputIndex = parts.indexOf('training_output');
          let runName = 'Training Run';
          
          if (outputIndex >= 0 && parts.length > outputIndex + 1) {
              runName = parts[outputIndex + 1]; // e.g., run_20251216_...
          }
          
          models.push({
              name: `New: ${runName} (best.pt)`,
              path: path.resolve(file)
          });
      });

      // 3. Process root files
      rootFiles.forEach(file => {
          models.unshift({
              name: path.basename(file),
              path: path.resolve(file)
          });
      });

      // 4. Manually add yolov8s.pt
      models.unshift({
          name: "yolov8s.pt (Higher Accuracy)",
          path: "yolov8s.pt" 
      });

      return models;

  } catch (error) {
      console.error("Error in get-model-list:", error);
      return [];
  }
});

ipcMain.handle('run:inference', async (event, filePath, options = {}) => {
  return new Promise((resolve) => {
    let pythonPath = process.env.PYTHON_PATH || 'python';
    
    // Check settings first
    const settingsPython = store.get('pythonPath');
    if (settingsPython && settingsPython.trim() !== '') {
        pythonPath = settingsPython;
    } else if (pythonPath.includes('D:\\Anaconda')) {
        pythonPath = 'python';
    }

    const scriptPath = 'src/predict_interface.py';
    const projectRoot = path.resolve(__dirname, '..');
    
    // Command args
    const args = [scriptPath, '--source', filePath];
    
    if (options.modelPath) {
        args.push('--model', options.modelPath);
    }

    if (options.fps) {
        args.push('--target_fps', options.fps.toString());
    }
    
    if (options.quality) {
        if (options.quality === 'max') {
            args.push('--quality', 'max');
            args.push('--augment'); // Enable TTA
        } else {
            args.push('--quality', options.quality);
        }
    }

    console.log(`Starting inference on: ${filePath} with options:`, options);

    const child = spawn(pythonPath, args, {
      cwd: projectRoot,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    activeInferenceProcess = child;

    let stdoutData = '';
    let stderrData = '';

    let stdoutBuffer = '';

    child.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdoutBuffer += chunk;
      
      // Process buffered lines
      let newlineIndex;
      while ((newlineIndex = stdoutBuffer.indexOf('\n')) !== -1) {
          const line = stdoutBuffer.slice(0, newlineIndex).trim();
          stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
          
          if (line.startsWith('STREAM_FRAME:')) {
              const base64Data = line.substring('STREAM_FRAME:'.length);
              event.sender.send('inference-stream', `data:image/jpeg;base64,${base64Data}`);
          } else if (line.startsWith('STREAM_DATA:')) {
              try {
                  const jsonData = JSON.parse(line.substring('STREAM_DATA:'.length));
                  event.sender.send('inference-data', jsonData);
              } catch (e) {
                  console.error('Failed to parse STREAM_DATA:', e);
              }
          } else if (line.startsWith('__JSON_START__')) {
              // Start of JSON result
          } else if (line.startsWith('__JSON_END__')) {
              // End of JSON result
          } else if (line.startsWith('{') || line.startsWith('}')) {
              // JSON content, accumulate for final result parsing if needed
              // But we are parsing the whole stdoutBuffer at the end in current logic.
              // Actually, the current logic below parses `stdoutData` which accumulates everything.
              // So we just need to ensure we don't block the stream.
          }
      }
      
      stdoutData += chunk;
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderrData += output;
      console.log(`Inference Stderr: ${output}`);
      
      // Check for progress
      const match = output.match(/PROGRESS:(\d+)/);
      if (match) {
        const progress = parseInt(match[1]);
        event.sender.send('inference-progress', progress);
      }
    });

    child.on('close', (code) => {
      if (activeInferenceProcess === child) {
          activeInferenceProcess = null;
      }
      if (code !== 0) {
        console.error(`Inference failed with code ${code}`);
        // reject(new Error(`Process exited with code ${code}. Stderr: ${stderrData}`));
        // Return error object instead of rejecting to handle gracefully in frontend
        resolve({ error: `Process exited with code ${code}`, details: stderrData });
        return;
      }

      // Parse JSON from stdout
      // We look for __JSON_START__ and __JSON_END__
      try {
        const startMarker = "__JSON_START__";
        const endMarker = "__JSON_END__";
        
        const startIndex = stdoutData.indexOf(startMarker);
        const endIndex = stdoutData.indexOf(endMarker);

        if (startIndex !== -1 && endIndex !== -1) {
            const jsonStr = stdoutData.substring(startIndex + startMarker.length, endIndex).trim();
            const result = JSON.parse(jsonStr);
            resolve(result);
        } else {
            // Fallback: try to parse the whole output or find the last JSON object
            console.error("Could not find JSON markers in output");
            resolve({ error: "Invalid output format from inference script", raw: stdoutData });
        }
      } catch (e) {
        console.error("Failed to parse inference result:", e);
        resolve({ error: "Failed to parse result", details: e.message });
      }
    });
  });
});
