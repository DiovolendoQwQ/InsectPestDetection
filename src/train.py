import os
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

from ultralytics import YOLO

def train():
    # Load model
    model = YOLO('yolov8n.pt')  # load a pretrained model (recommended for training)

    # Train the model
    # epochs=50, batch size will be auto-tuned or default (16), 
    # we can try to log them.
    results = model.train(
        data='data/data.yaml', 
        epochs=50, 
        imgsz=640,
        project='runs/detect',
        name='train_v8n',
        exist_ok=True,
        workers=0 # Fix for Windows
    )
    
    # Print hyperparameters used
    print(f"Training completed.")
    print(f"Initial Learning Rate (lr0): {results.args['lr0']}")
    print(f"Batch Size: {results.args['batch']}")
    
    # Evaluate on validation set
    metrics = model.val()
    print(f"mAP@0.5: {metrics.box.map50}")
    print(f"mAP@0.5:0.95: {metrics.box.map}")

if __name__ == '__main__':
    train()
