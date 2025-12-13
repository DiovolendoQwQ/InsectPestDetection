import os
import yaml
import glob
from pathlib import Path
from PIL import Image
from tqdm import tqdm
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np

def check_dataset(data_yaml_path):
    print(f"Checking dataset using {data_yaml_path}...")
    
    with open(data_yaml_path, 'r') as f:
        data = yaml.safe_load(f)
        
    root_dir = Path(data_yaml_path).parent.absolute()
    
    splits = ['train', 'val', 'test']
    class_names = data['names']
    nc = data['nc']
    
    report_lines = []
    class_counts = {name: 0 for name in class_names}
    
    for split in splits:
        if split not in data:
            print(f"Warning: {split} not found in data.yaml")
            continue
            
        img_dir = root_dir / data[split]
        label_dir = root_dir / 'labels' / split
        
        if not img_dir.exists():
            print(f"Error: Image directory {img_dir} does not exist.")
            continue
            
        print(f"\nChecking {split} split...")
        
        images = list(img_dir.glob('*.*'))
        valid_images = [i for i in images if i.suffix.lower() in ['.jpg', '.jpeg', '.png', '.bmp']]
        
        report_lines.append(f"\n--- {split.upper()} SET ---")
        report_lines.append(f"Images found: {len(valid_images)}")
        
        missing_labels = 0
        corrupt_images = 0
        empty_labels = 0
        label_errors = 0
        
        for img_path in tqdm(valid_images):
            # Check image
            try:
                with Image.open(img_path) as img:
                    img.verify() 
            except Exception as e:
                corrupt_images += 1
                report_lines.append(f"Corrupt image: {img_path} - {e}")
                continue
                
            # Check label
            label_path = label_dir / (img_path.stem + '.txt')
            if not label_path.exists():
                missing_labels += 1
                # report_lines.append(f"Missing label: {img_path.name}") # Too verbose if many
                continue
                
            if label_path.stat().st_size == 0:
                empty_labels += 1
                continue
                
            try:
                with open(label_path, 'r') as f:
                    lines = f.readlines()
                    for line in lines:
                        parts = line.strip().split()
                        if len(parts) != 5:
                            label_errors += 1
                            continue
                        cls_id = int(parts[0])
                        if cls_id < 0 or cls_id >= nc:
                            report_lines.append(f"Invalid class ID {cls_id} in {label_path.name}")
                            label_errors += 1
                        else:
                            class_counts[class_names[cls_id]] += 1
                        
                        # Check normalized coordinates
                        if not all(0 <= float(x) <= 1 for x in parts[1:]):
                             report_lines.append(f"Coordinates not normalized in {label_path.name}")
                             label_errors += 1
                             
            except Exception as e:
                report_lines.append(f"Error reading label {label_path.name}: {e}")
                label_errors += 1

        report_lines.append(f"Missing labels: {missing_labels}")
        report_lines.append(f"Corrupt images: {corrupt_images}")
        report_lines.append(f"Empty labels: {empty_labels}")
        report_lines.append(f"Label format errors: {label_errors}")

    # Statistics
    report_lines.append("\n--- Class Distribution ---")
    df = pd.DataFrame(list(class_counts.items()), columns=['Class', 'Count'])
    report_lines.append(df.to_string())
    
    # Save report
    with open('docs/dataset_quality_report.txt', 'w') as f:
        f.write('\n'.join(report_lines))
        
    # Plot distribution
    plt.figure(figsize=(12, 6))
    sns.barplot(x='Count', y='Class', data=df)
    plt.title('Class Distribution')
    plt.tight_layout()
    plt.savefig('docs/class_distribution.png')
    
    print("\nQuality check complete. Report saved to docs/dataset_quality_report.txt and docs/class_distribution.png")
    print("Report Summary:")
    print('\n'.join(report_lines))

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=str, default='data.yaml', help='Path to data.yaml')
    args = parser.parse_args()
    
    check_dataset(args.data)
