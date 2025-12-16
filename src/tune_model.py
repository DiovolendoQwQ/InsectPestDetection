import os
import itertools
from ultralytics import YOLO

# Fix for OMP error on Windows
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

def grid_search(data_yaml, base_model='yolov8n.pt', output_dir='tuning_results'):
    """
    Perform a simple grid search for hyperparameters.
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    # Hyperparameter Grid
    # Keep it small for demonstration as training takes time
    lrs = [0.01, 0.001]
    batch_sizes = [16, 32]
    epochs = 10 # Short epochs for tuning check, increase for real run
    
    best_map = 0
    best_params = {}
    
    results_log = []

    for lr, batch in itertools.product(lrs, batch_sizes):
        run_name = f"tune_lr{lr}_batch{batch}"
        print(f"\n--- Starting Trial: {run_name} ---")
        
        model = YOLO(base_model)
        
        try:
            results = model.train(
                data=data_yaml,
                epochs=epochs,
                batch=batch,
                lr0=lr,
                project=output_dir,
                name=run_name,
                exist_ok=True,
                verbose=False,
                workers=0 # Windows fix
            )
            
            # Validate
            metrics = model.val()
            current_map = metrics.box.map50
            
            print(f"Trial Result - mAP@0.5: {current_map}")
            
            results_log.append({
                "lr": lr,
                "batch": batch,
                "mAP_0.5": current_map,
                "mAP_0.5_0.95": metrics.box.map
            })
            
            if current_map > best_map:
                best_map = current_map
                best_params = {"lr": lr, "batch": batch}
                
        except Exception as e:
            print(f"Trial failed: {e}")

    # Save summary
    import json
    summary_path = os.path.join(output_dir, 'tuning_summary.json')
    with open(summary_path, 'w') as f:
        json.dump({
            "best_params": best_params,
            "best_mAP": best_map,
            "all_trials": results_log
        }, f, indent=4)
        
    print(f"\nTuning Complete. Best mAP: {best_map}")
    print(f"Best Params: {best_params}")
    print(f"Summary saved to {summary_path}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=str, default='data/data.yaml')
    parser.add_argument('--output_dir', type=str, default='tuning_results')
    
    args = parser.parse_args()
    
    grid_search(args.data, output_dir=args.output_dir)
