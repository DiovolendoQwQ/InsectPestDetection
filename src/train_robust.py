import os
import argparse
from datetime import datetime
from ultralytics import YOLO
import torch

# Fix for OMP error on Windows
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

def train_robust(epochs=200, batch=16, data='data/data.yaml', output_dir='training_output_robust'):
    """
    Train YOLOv8 with strong data augmentation to improve generalization 
    from Lab environment to Natural environment.
    """
    
    # Check Device
    device = 0 if torch.cuda.is_available() else 'cpu'
    print(f"🚀 Training Device: {device}")

    # Create output directory
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = os.path.join(output_dir, f"run_robust_{timestamp}")
    
    print(f"Starting ROBUST training... Output will be saved to {run_dir}")

    # Load model
    model = YOLO('yolov8s.pt') 

    # Train with Strong Augmentations
    # These parameters are tuned for domain generalization (Lab -> Wild)
    results = model.train(
        data=data, 
        epochs=epochs, 
        batch=batch,
        imgsz=640,
        project=os.path.join(run_dir, 'logs'),
        name='train',
        exist_ok=True,
        workers=0,
        device=device,
        patience=50,
        
        # --- Strong Augmentation Hyperparameters ---
        # 1. Photometric Distortions (Simulate lighting conditions)
        hsv_h=0.05,  # Adjust Hue (color)
        hsv_s=0.7,   # Adjust Saturation (intensity)
        hsv_v=0.6,   # Adjust Value (brightness) - Crucial for outdoor shadows/sun
        
        # 2. Geometric Distortions (Simulate camera angles and positions)
        degrees=10.0,    # Rotation (+/- 10 degrees)
        translate=0.2,   # Translation (+/- 20%)
        scale=0.8,       # Scaling (gain 0.8) - Important for distance variation
        shear=2.0,       # Shear (+/- 2 degrees)
        perspective=0.0005, # Perspective effect
        
        # 3. Flips (Insects can be in any orientation)
        fliplr=0.5,      # Horizontal Flip
        flipud=0.5,      # Vertical Flip (Enable this! Insects don't care about gravity)
        
        # 4. Advanced Mosaic/Mixup (Simulate clutter and occlusion)
        mosaic=1.0,      # Mosaic (4 images stitched) - 100% probability
        mixup=0.15,      # Mixup (Blend images) - 15% probability
        copy_paste=0.0,  # Copy-paste (requires segments usually, keeping 0 for safety)
        
        # 5. Blur/Noise (Simulate camera focus issues)
        # Note: YOLOv8 might not expose 'blur' directly in args easily without cfg file, 
        # but standard args cover most needs.
    )
    
    print(f"Robust training completed. Check results in {run_dir}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--epochs', type=int, default=200)
    parser.add_argument('--batch', type=int, default=16)
    parser.add_argument('--data', type=str, default='data/data.yaml')
    
    args = parser.parse_args()
    
    train_robust(epochs=args.epochs, batch=args.batch, data=args.data)
