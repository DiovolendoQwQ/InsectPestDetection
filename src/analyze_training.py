import os
import pandas as pd
import matplotlib.pyplot as plt
import argparse

def analyze_training(results_path):
    if not os.path.exists(results_path):
        print(f"Error: {results_path} not found.")
        return

    try:
        # Load data (YOLOv8 results.csv often has leading spaces in headers)
        df = pd.read_csv(results_path)
        df.columns = [c.strip() for c in df.columns]
        
        # Plotting
        plt.figure(figsize=(12, 5))
        
        # Loss Curves
        plt.subplot(1, 2, 1)
        if 'train/box_loss' in df.columns and 'val/box_loss' in df.columns:
            plt.plot(df['epoch'], df['train/box_loss'], label='Train Box Loss')
            plt.plot(df['epoch'], df['val/box_loss'], label='Val Box Loss')
            plt.title('Box Loss')
            plt.xlabel('Epoch')
            plt.ylabel('Loss')
            plt.legend()
        else:
            plt.title('Loss metrics not found')

        # Metrics
        plt.subplot(1, 2, 2)
        if 'metrics/mAP50(B)' in df.columns:
            plt.plot(df['epoch'], df['metrics/mAP50(B)'], label='mAP@0.5')
            if 'metrics/mAP50-95(B)' in df.columns:
                plt.plot(df['epoch'], df['metrics/mAP50-95(B)'], label='mAP@0.5:0.95')
            plt.title('mAP Metrics')
            plt.xlabel('Epoch')
            plt.ylabel('mAP')
            plt.legend()
        else:
            plt.title('mAP metrics not found')

        plt.tight_layout()
        
        output_plot = results_path.replace('.csv', '_analysis.png')
        plt.savefig(output_plot)
        print(f"Analysis plot saved to {output_plot}")
        
        # Convergence Check
        # Simple heuristic: slope of last 5 epochs of mAP
        if len(df) > 5:
            last_5 = df['metrics/mAP50(B)'].tail(5)
            slope = (last_5.iloc[-1] - last_5.iloc[0]) / 5
            print(f"\nConvergence Analysis:")
            print(f"mAP Slope (last 5 epochs): {slope:.4f}")
            if slope < 0.001:
                print("-> Model appears to have converged.")
            else:
                print("-> Model is still improving.")
        
    except Exception as e:
        print(f"Failed to analyze results: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('results_csv', type=str, help='Path to results.csv')
    args = parser.parse_args()
    
    analyze_training(args.results_csv)
