const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const si = require('systeminformation');
require('dotenv').config();

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

// 2. Run Python Script (Training)
let pythonProcess = null;

ipcMain.on('start-training', (event, args) => {
  let { pythonPath, scriptPath, params } = args;

  // If pythonPath is not provided or hardcoded fallback was used in frontend, use env var
  if (!pythonPath || pythonPath.includes('D:\\Anaconda')) {
      pythonPath = process.env.PYTHON_PATH || 'python';
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

ipcMain.handle('run:inference', async (event, imagePath) => {
  return new Promise((resolve, reject) => {
    let pythonPath = process.env.PYTHON_PATH || 'python';
    // If fallback logic is needed, check default paths or 'python'
    if (pythonPath.includes('D:\\Anaconda')) pythonPath = 'python';

    const scriptPath = 'src/predict_interface.py';
    const projectRoot = path.resolve(__dirname, '..');
    
    // Command args
    const args = [scriptPath, '--source', imagePath];

    console.log(`Starting inference on: ${imagePath}`);

    const child = spawn(pythonPath, args, {
      cwd: projectRoot,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderrData += data.toString();
      console.log(`Inference Stderr: ${data}`);
    });

    child.on('close', (code) => {
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
