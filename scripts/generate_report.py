import os
import pandas as pd
import shutil
from pathlib import Path

def generate_report():
    train_dir = Path('runs/detect/train_v8n')
    val_dir = Path('runs/detect/val_v8n')
    
    report_lines = []
    report_lines.append("# YOLOv8 Training & Validation Report\n")

    # 1. Metrics from Training
    csv_path = train_dir / 'results.csv'
    if csv_path.exists():
        df = pd.read_csv(csv_path)
        df.columns = [c.strip() for c in df.columns]
        
        best_epoch = df['metrics/mAP50(B)'].idxmax()
        best_row = df.iloc[best_epoch]
        
        report_lines.append("## Best Metrics (Epoch {})".format(best_row['epoch']))
        report_lines.append(f"- **mAP@0.5**: {best_row['metrics/mAP50(B)']:.4f}")
        report_lines.append(f"- **mAP@0.5:0.95**: {best_row['metrics/mAP50-95(B)']:.4f}")
        report_lines.append(f"- **Precision**: {best_row['metrics/precision(B)']:.4f}")
        report_lines.append(f"- **Recall**: {best_row['metrics/recall(B)']:.4f}")
        report_lines.append("\n")
    else:
        report_lines.append("Error: results.csv not found.\n")

    # 2. Files Check
    report_lines.append("## Artifacts")
    
    artifacts_map = {
        'Confusion Matrix': val_dir / 'confusion_matrix.png',
        'F1 Curve': val_dir / 'F1_curve.png',
        'PR Curve': val_dir / 'PR_curve.png',
        'Results Plot': train_dir / 'results.png',
        'Train Batch Samples': train_dir / 'train_batch0.jpg',
        'Validation Predictions': val_dir / 'val_batch0_pred.jpg',
        'Best Weights': train_dir / 'weights/best.pt'
    }
    
    for name, path in artifacts_map.items():
        status = "✅ Found" if path.exists() else "❌ Missing"
        report_lines.append(f"- **{name}**: {status} ({path})")
    report_lines.append("\n")

    # 3. Dataset Quality Report
    quality_report_path = Path('docs/dataset_quality_report.txt')
    if quality_report_path.exists():
        report_lines.append("## Dataset Quality Summary")
        with open(quality_report_path, 'r') as f:
            content = f.read()
            report_lines.append("```")
            report_lines.append(content)
            report_lines.append("```")
    
    # Save final report
    with open('docs/final_report.md', 'w', encoding='utf-8') as f:
        f.write('\n'.join(report_lines))
    
    print("Final report generated: docs/final_report.md")

if __name__ == '__main__':
    generate_report()
