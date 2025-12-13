import os
import shutil
import random
from pathlib import Path

def split_dataset(root_dir, train_ratio=0.8, val_ratio=0.1, test_ratio=0.1):
    random.seed(42)
    
    images_dir = os.path.join(root_dir, 'images')
    labels_dir = os.path.join(root_dir, 'labels')
    
    # Ensure test directories exist
    for split in ['train', 'val', 'test']:
        os.makedirs(os.path.join(images_dir, split), exist_ok=True)
        os.makedirs(os.path.join(labels_dir, split), exist_ok=True)
        
    # Collect all image files
    all_images = []
    # Check existing splits
    for split in ['train', 'val', 'test']:
        split_img_dir = os.path.join(images_dir, split)
        if os.path.exists(split_img_dir):
            files = [os.path.join(split, f) for f in os.listdir(split_img_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp'))]
            all_images.extend(files)
            
    print(f"Total images found: {len(all_images)}")
    
    if len(all_images) == 0:
        print("No images found!")
        return

    # Shuffle
    random.shuffle(all_images)
    
    total = len(all_images)
    train_count = int(total * train_ratio)
    val_count = int(total * val_ratio)
    test_count = total - train_count - val_count
    
    train_files = all_images[:train_count]
    val_files = all_images[train_count:train_count+val_count]
    test_files = all_images[train_count+val_count:]
    
    print(f"Splitting into: Train={len(train_files)}, Val={len(val_files)}, Test={len(test_files)}")
    
    # Helper to move files
    def move_files(files, target_split):
        for rel_path in files:
            src_split, filename = os.path.split(rel_path)
            
            # Image paths
            src_img = os.path.join(images_dir, src_split, filename)
            dst_img = os.path.join(images_dir, target_split, filename)
            
            # Label paths
            label_name = os.path.splitext(filename)[0] + '.txt'
            src_label = os.path.join(labels_dir, src_split, label_name)
            dst_label = os.path.join(labels_dir, target_split, label_name)
            
            # Move image
            if src_img != dst_img:
                shutil.move(src_img, dst_img)
                
            # Move label if exists
            if os.path.exists(src_label):
                if src_label != dst_label:
                    shutil.move(src_label, dst_label)
            else:
                print(f"Warning: Label not found for {src_img}")

    print("Moving files...")
    move_files(train_files, 'train')
    move_files(val_files, 'val')
    move_files(test_files, 'test')
    print("Dataset split complete.")

if __name__ == '__main__':
    split_dataset('.')
