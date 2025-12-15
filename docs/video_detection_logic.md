# Video Detection Logic Documentation

## Overview

The video detection module in this project allows users to upload a video file, performs object detection on it using a YOLOv8 model, and provides real-time visual and data feedback.

## Architecture

The system consists of three main components:
1.  **Frontend (React/Electron)**: Handles user interaction, video playback, and real-time visualization.
2.  **IPC Layer (Electron Main Process)**: Manages the communication between the frontend and the backend python script.
3.  **Backend (Python)**: Executes the actual inference using YOLOv8 (with optional ONNX/TensorRT acceleration).

## Detailed Logic Flow

### 1. Model Loading & Optimization (`src/predict_interface.py`)

*   **Priority Loading**: The system attempts to load the model in the following order of preference to maximize performance:
    1.  **TensorRT Engine (`.engine`)**: Fastest inference speed.
    2.  **ONNX Model (`.onnx`)**: Optimized cross-platform format (requires `onnxruntime`).
    3.  **PyTorch Model (`.pt`)**: Default format, slowest but most compatible.
*   **Fallback Mechanism**: If loading an optimized model fails (e.g., due to missing libraries like `onnxruntime` or version mismatches), the system automatically falls back to the original `.pt` model to ensure stability.
*   **GPU Acceleration**: The script explicitly checks for CUDA availability (`torch.cuda.is_available()`) and sets `device='0'` if a GPU is present; otherwise, it defaults to CPU.

### 2. Video Processing & Inference (`src/predict_interface.py`)

*   **Input**: Takes a video file path as input.
*   **Frame Sampling (Optimization)**:
    *   To ensure real-time responsiveness and avoid processing every single frame (which can be computationally expensive), the system samples frames at a rate of **1 FPS** (Frame Per Second).
    *   It calculates a `frame_interval` based on the video's FPS and skips intermediate frames.
*   **Detection**:
    *   For each sampled frame, it runs `model.track()` (or `model.predict()` as fallback) to detect objects.
    *   **Filtering**: Detections with a confidence score lower than the threshold (default `0.25`) are strictly filtered out to prevent "ghost" detections.
*   **Real-time Data Streaming**:
    *   For every processed frame, a statistical summary is generated (e.g., "Aphid: 5, Ladybug: 1").
    *   This summary is serialized to JSON and printed to `STDOUT` with a special prefix: `STREAM_DATA:{...}`.
    *   Even if no objects are detected, an empty summary is sent to clear the frontend display.

### 3. Data Communication (IPC)

*   **Electron Main Process (`main.js`)**:
    *   Spawns the Python subprocess.
    *   Listens to `STDOUT` line-by-line.
    *   Parses lines starting with `STREAM_DATA:` and sends the JSON payload to the frontend via the `inference-data` channel.
    *   Parses lines starting with `PROGRESS:` to send progress updates via `inference-progress`.
*   **Preload Script (`preload.js`)**:
    *   Exposes `onInferenceData` and `onInferenceProgress` listeners to the renderer process safely.

### 4. Frontend Visualization (`Testing.jsx`)

*   **Video Player**: Uses a native HTML5 `<video>` element to play the uploaded video file directly. This ensures smooth playback at the original frame rate and quality.
*   **Canvas Overlay**:
    *   A `<canvas>` element is positioned exactly on top of the video player.
    *   **Synchronization**: The `onTimeUpdate` event of the video player triggers a redraw.
    *   **Drawing**: It finds the detection data corresponding to the current playback time (from the `frames_data` array received after inference) and draws bounding boxes and labels on the canvas.
*   **Real-time Table**:
    *   During the inference phase (before playback starts), the table listens to `inference-data` events.
    *   It updates in real-time to show the summary of what the model is currently seeing (e.g., "Time: 12.5s, Class: Aphid, Count: 10").
    *   This provides immediate feedback to the user that the system is working and what it is finding.

## Summary of UX Improvements

*   **No "Ghost" Data**: Strict confidence filtering ensures only valid detections are shown.
*   **Instant Feedback**: The table updates live during processing, so the user doesn't have to wait for the entire video to finish to see results.
*   **Smooth Playback**: By keeping the original video and using a lightweight canvas overlay, the playback experience is smooth and retains full quality.
*   **Robustness**: Automatic model fallback prevents crashes due to environment configuration issues.
