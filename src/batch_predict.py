import os
import sys
import argparse
import glob
import csv
import json
import time
import cv2
from ultralytics import YOLO

# Fix for OMP error on Windows
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

def run_batch_inference(source_dir, model_path, conf_thres=0.25):
    try:
        # Check source directory
        if not os.path.isdir(source_dir):
            return {"error": f"Directory not found: {source_dir}"}

        # Create output directory
        output_dir = f"{source_dir}_output"
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        # Load model
        model = YOLO(model_path)

        # Find images
        # Manual case-insensitive search
        valid_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
        image_files = []
        
        # Walk to find images (optional: recursive?) 
        # For now, let's just do top-level to match typical user expectation for "Folder"
        # But robustly handle case
        try:
            for filename in os.listdir(source_dir):
                ext = os.path.splitext(filename)[1].lower()
                if ext in valid_extensions:
                    image_files.append(os.path.join(source_dir, filename))
        except Exception as e:
             return {"error": f"Failed to list directory: {str(e)}"}
        
        if not image_files:
             # Try recursive just in case user selected a parent folder
             for root, dirs, files in os.walk(source_dir):
                 for filename in files:
                    ext = os.path.splitext(filename)[1].lower()
                    if ext in valid_extensions:
                        image_files.append(os.path.join(root, filename))
                 if image_files: # If we found some in subfolders, stop there? Or collect all?
                     # Let's collect all if we went recursive
                     pass
        
        if not image_files:
             return {"error": f"No images found in {source_dir}. Supported formats: jpg, jpeg, png, bmp, webp"}

        total_images = len(image_files)
        processed_count = 0
        
        # CSV file setup
        csv_path = os.path.join(output_dir, 'results.csv')
        csv_data = []
        
        print(f"Starting batch processing of {total_images} images...", file=sys.stderr)

        for img_path in image_files:
            filename = os.path.basename(img_path)
            
            # Run inference
            results = model.predict(img_path, conf=conf_thres, save=False, verbose=False)
            result = results[0]
            
            # Count detections
            counts = {}
            for box in result.boxes:
                cls_id = int(box.cls[0])
                class_name = model.names[cls_id]
                counts[class_name] = counts.get(class_name, 0) + 1
            
            # Save annotated image
            annotated_frame = result.plot()
            output_path = os.path.join(output_dir, filename)
            cv2.imwrite(output_path, annotated_frame)
            
            # Record result
            row = {'filename': filename}
            row.update(counts)
            row['total'] = sum(counts.values())
            csv_data.append(row)
            
            processed_count += 1
            
            # Report progress
            if processed_count % 5 == 0 or processed_count == total_images:
                progress = int((processed_count / total_images) * 100)
                print(f"PROGRESS:{progress}", file=sys.stderr, flush=True)

        # Write CSV
        if csv_data:
            # Get all unique headers (class names)
            fieldnames = ['filename', 'total']
            all_classes = set()
            for row in csv_data:
                for k in row.keys():
                    if k not in fieldnames:
                        all_classes.add(k)
            fieldnames.extend(sorted(list(all_classes)))
            
            with open(csv_path, 'w', newline='') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                for row in csv_data:
                    # Fill missing keys with 0
                    for field in fieldnames:
                        if field not in row:
                            row[field] = 0
                    writer.writerow(row)

        return {
            "success": True,
            "processed_count": processed_count,
            "output_dir": output_dir,
            "csv_path": csv_path
        }

    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--source_dir', type=str, required=True, help='Path to input folder')
    parser.add_argument('--model', type=str, required=True, help='Path to model file')
    parser.add_argument('--conf', type=float, default=0.25, help='Confidence threshold')
    args = parser.parse_args()

    result = run_batch_inference(args.source_dir, args.model, args.conf)
    
    print("__JSON_START__")
    print(json.dumps(result))
    print("__JSON_END__")
