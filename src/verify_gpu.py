import torch
import sys

def verify_gpu():
    print(f"PyTorch Version: {torch.__version__}")
    if torch.cuda.is_available():
        print("CUDA is available! ✅")
        print(f"Device Count: {torch.cuda.device_count()}")
        print(f"Current Device: {torch.cuda.current_device()}")
        print(f"Device Name: {torch.cuda.get_device_name(0)}")
        return True
    else:
        print("CUDA is NOT available. ❌ Using CPU.")
        return False

if __name__ == "__main__":
    verify_gpu()
