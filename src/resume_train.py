import os
import argparse
from ultralytics import YOLO

# Fix for OMP error on Windows
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

def resume_training():
    parser = argparse.ArgumentParser()
    parser.add_argument('--epochs', type=int, default=50, help='Total number of epochs')
    args = parser.parse_args()

    # Load the last model
    model_path = 'runs/detect/train_v8n/weights/last.pt'
    if not os.path.exists(model_path):
        print(f"Error: {model_path} not found.")
        return

    print(f"Resuming training from {model_path}...")
    
    # Load model
    model = YOLO(model_path)
    
    try:
        # Try to resume training
        # The 'resume=True' argument automatically loads training args from the checkpoint
        # We explicitly set data='data/data.yaml' to ensure it finds the dataset if path changed
        results = model.train(resume=True, data='data/data.yaml', epochs=args.epochs)
        print("Training resumed and completed.")
        
    except AssertionError as e:
        error_msg = str(e)
        if "finished" in error_msg:
            print("\nWarning: Previous training session has already finished.")
            print(f"Target epochs: {args.epochs}")
            
            # If user wants more epochs than currently finished
            # We can start a new training session initialized with weights from last.pt
            # But 'resume=True' doesn't support changing epochs easily if it thinks it's done.
            # So we load the weights and train as if it's a new run, but with pretrained weights.
            
            print("Starting fine-tuning / extended training...")
            # Note: When not using resume=True, we are starting a 'new' training but initializing weights.
            # We might want to keep the same project/name to overwrite or continue in same dir?
            # Usually it's safer to just let it create a new exp or force it.
            # Let's try to continue in the same directory if possible, or just standard train.
            
            model.train(data='data/data.yaml', epochs=args.epochs, project='runs/detect', name='train_v8n', exist_ok=True)
            print("Extended training completed.")
        else:
            raise e
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise e

if __name__ == '__main__':
    resume_training()
