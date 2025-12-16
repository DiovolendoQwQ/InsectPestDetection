import os
import shutil
import json
import argparse
from datetime import datetime

# Fix for OMP error on Windows
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

from ultralytics import YOLO
import torch

def train(epochs=150, batch=16, data='data/data.yaml', output_dir='training_output'):
    # Check Device
    device = 0 if torch.cuda.is_available() else 'cpu'
    device_name = torch.cuda.get_device_name(0) if device == 0 else "CPU"
    print(f"🚀 Training Device: {device} ({device_name})")

    # Create output directory
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = os.path.join(output_dir, f"run_{timestamp}")
    if not os.path.exists(run_dir):
        os.makedirs(run_dir)
        
    print(f"Starting training... Output will be saved to {run_dir}")

    # Load model
    model = YOLO('yolov8s.pt')  # load a pretrained model

    # Train the model
    # Use 'project' and 'name' to direct Ultralytics output to our folder
    # Ultralytics creates a subdirectory 'name' inside 'project'
    project_path = os.path.join(run_dir, 'yolo_logs')
    run_name = 'train'
    
    results = model.train(
        data=data, 
        epochs=epochs, 
        batch=batch,
        imgsz=640,
        project=project_path,
        name=run_name,
        exist_ok=True,
        workers=0, # Fix for Windows
        patience=50, # Early stopping
        device=device # Force GPU if available
    )
    
    # 3. Result Management - Organize files
    
    # Path where YOLO saved results
    yolo_res_dir = os.path.join(project_path, run_name)
    weights_dir = os.path.join(yolo_res_dir, 'weights')
    
    # Copy best weights to root of run_dir for easy access
    best_pt = os.path.join(weights_dir, 'best.pt')
    if os.path.exists(best_pt):
        shutil.copy(best_pt, os.path.join(run_dir, 'best_model.pt'))
        print(f"Best model copied to {os.path.join(run_dir, 'best_model.pt')}")
        
    # Generate Training Report
    metrics = model.val() # Validate to get final metrics
    
    report = {
        "timestamp": timestamp,
        "config": {
            "epochs": epochs,
            "batch": batch,
            "data": data,
            "base_model": "yolov8s.pt"
        },
        "metrics": {
            "mAP_0.5": metrics.box.map50,
            "mAP_0.5_0.95": metrics.box.map,
            "precision": metrics.box.mp,
            "recall": metrics.box.mr
        },
        "training_args": str(results.args) if hasattr(results, 'args') else "N/A"
    }
    
    report_path = os.path.join(run_dir, 'training_report.json')
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=4)
        
    print(f"Training report saved to {report_path}")
    print(f"Full logs and plots are in {yolo_res_dir}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--epochs', type=int, default=150)
    parser.add_argument('--batch', type=int, default=16)
    parser.add_argument('--data', type=str, default='data/data.yaml')
    parser.add_argument('--output_dir', type=str, default='training_output')
    
    args = parser.parse_args()
    
    train(epochs=args.epochs, batch=args.batch, data=args.data, output_dir=args.output_dir)
