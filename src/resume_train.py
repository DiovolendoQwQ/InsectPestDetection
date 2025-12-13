import os
from ultralytics import YOLO

# Fix for OMP error on Windows
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

def resume_training():
    # Load the last model
    model_path = 'runs/detect/train_v8n/weights/last.pt'
    if not os.path.exists(model_path):
        print(f"Error: {model_path} not found.")
        return

    print(f"Resuming training from {model_path}...")
    
    # Load model
    model = YOLO(model_path)
    
    # Resume training
    # The 'resume=True' argument automatically loads training args from the checkpoint
    results = model.train(resume=True)
    
    print("Training resumed and completed.")

if __name__ == '__main__':
    resume_training()
