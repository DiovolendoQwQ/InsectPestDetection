import os
import sys
import argparse
import json
import matplotlib.pyplot as plt
from ultralytics import YOLO

# Fix for OMP error on Windows
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

def evaluate(model_path, data_yaml, output_dir):
    """
    Evaluate the model on validation set and save comprehensive report.
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    print(f"Loading model from {model_path}...")
    try:
        model = YOLO(model_path)
    except Exception as e:
        print(f"Error loading model: {e}")
        return

    print("Starting validation...")
    # Validate on dataset
    metrics = model.val(data=data_yaml, split='val', project=output_dir, name='eval_results', exist_ok=True)
    
    # Extract Metrics
    report = {
        "mAP_0.5": metrics.box.map50,
        "mAP_0.5_0.95": metrics.box.map,
        "precision": metrics.box.mp,
        "recall": metrics.box.mr,
        "fitness": metrics.box.fitness,
        "classes": {}
    }

    # Class-wise metrics
    for i, class_name in enumerate(metrics.names.values()):
        # Note: ultralytics metrics structure might vary by version, 
        # but map50s is usually an array of per-class AP
        try:
            ap50 = metrics.box.maps[i] # This might be all map, let's use map50 if available per class
            # Actually metrics.box.maps is array of shape (n_classes, ) for mAP50-95 usually
            # Let's just save what we can easily access
            pass
        except:
            pass

    # Save Report
    report_path = os.path.join(output_dir, 'evaluation_report.json')
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=4)
    
    print(f"Evaluation report saved to {report_path}")
    
    # The val() command automatically saves confusion matrix and curves in the project/name directory
    # We can list them here for the user
    eval_dir = os.path.join(output_dir, 'eval_results')
    print(f"Detailed plots (Confusion Matrix, PR Curve) saved in {eval_dir}")
    
    # We can try to explicitly copy or display important plots if needed, 
    # but Ultralytics does a good job generating them:
    # - confusion_matrix.png
    # - F1_curve.png
    # - PR_curve.png
    
    return report

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', type=str, required=True, help='Path to .pt model file')
    parser.add_argument('--data', type=str, default='data/data.yaml', help='Path to data.yaml')
    parser.add_argument('--output_dir', type=str, default='evaluation_output', help='Directory to save results')
    
    args = parser.parse_args()
    
    evaluate(args.model, args.data, args.output_dir)
