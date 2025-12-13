# Electron Machine Learning Application

A modern desktop application for managing machine learning workflows, specifically designed for Insect Pest Detection using YOLOv8.

## Features

*   **System Dashboard**: Real-time monitoring of CPU, Memory, and GPU usage.
*   **Model Training**: Graphical interface to configure and start YOLOv8 training.
*   **Log Viewer**: Integrated terminal to view training progress in real-time.
*   **Extensible Architecture**: Built with Electron, React, and Material UI.

## Prerequisites

*   Node.js (v16+)
*   Anaconda / Miniconda (for Python environment)
*   A configured `yolov8_env` conda environment (see root README.md)

## Installation

1.  Navigate to the `electron-app` directory:
    ```bash
    cd electron-app
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

## Running the Application

1.  Start the application in development mode:
    ```bash
    npm run dev
    ```

## Building for Production

1.  Build the application:
    ```bash
    npm run build
    ```
    (Note: You may need to configure `electron-builder` in `package.json` for specific platform targets).

## Configuration

*   **Python Path**: Currently hardcoded in `src/App.jsx`. Please update `pythonPath` variable to point to your `yolov8_env` python executable if different from default.
