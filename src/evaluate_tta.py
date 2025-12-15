import os
import time
import glob
import argparse
import random
from ultralytics import YOLO
import pandas as pd

# Fix for OMP error on Windows
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

def evaluate_tta(model_path, images_dir, num_samples=5):
    if not os.path.exists(model_path):
        print(f"Error: Model not found at {model_path}")
        return

    # Load model
    print(f"Loading model from {model_path}...")
    model = YOLO(model_path)
    
    # Get images
    image_files = glob.glob(os.path.join(images_dir, '*.jpg')) + \
                  glob.glob(os.path.join(images_dir, '*.png')) + \
                  glob.glob(os.path.join(images_dir, '*.jpeg'))
    
    if not image_files:
        print(f"No images found in {images_dir}")
        return

    # Select random samples
    samples = random.sample(image_files, min(num_samples, len(image_files)))
    
    results_data = []

    print(f"\nRunning evaluation on {len(samples)} images...")
    print("-" * 80)

    for img_path in samples:
        img_name = os.path.basename(img_path)
        
        # Run without TTA
        start_t1 = time.time()
        res_normal = model.predict(source=img_path, save=False, conf=0.15, verbose=False, imgsz=1280)
        time_normal = time.time() - start_t1
        
        # Run with TTA
        start_t2 = time.time()
        res_tta = model.predict(source=img_path, save=False, conf=0.15, augment=True, verbose=False, imgsz=1280)
        time_tta = time.time() - start_t2
        
        # Extract metrics
        boxes_normal = res_normal[0].boxes
        conf_normal = boxes_normal.conf.mean().item() if len(boxes_normal) > 0 else 0.0
        count_normal = len(boxes_normal)
        
        boxes_tta = res_tta[0].boxes
        conf_tta = boxes_tta.conf.mean().item() if len(boxes_tta) > 0 else 0.0
        count_tta = len(boxes_tta)
        
        results_data.append({
            "Image": img_name,
            "Normal Count": count_normal,
            "TTA Count": count_tta,
            "Normal Conf": round(conf_normal, 4),
            "TTA Conf": round(conf_tta, 4),
            "Time Normal (s)": round(time_normal, 3),
            "Time TTA (s)": round(time_tta, 3),
            "Conf Improvement": round(conf_tta - conf_normal, 4)
        })

    # Create DataFrame for display
    df = pd.DataFrame(results_data)
    
    print("\nEvaluation Results:")
    print(df.to_string(index=False))
    
    print("\n" + "-" * 80)
    print(f"Average Time Normal: {df['Time Normal (s)'].mean():.3f}s")
    print(f"Average Time TTA:    {df['Time TTA (s)'].mean():.3f}s")
    print(f"Average Conf Improvement: {df['Conf Improvement'].mean():.4f}")
    print("-" * 80)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', type=str, default='runs/detect/train_v8n/weights/best.pt', help='Path to model file')
    parser.add_argument('--images', type=str, default='data/images/val', help='Path to images directory')
    parser.add_argument('--samples', type=int, default=5, help='Number of images to evaluate')
    args = parser.parse_args()
    
    evaluate_tta(args.model, args.images, args.samples)
