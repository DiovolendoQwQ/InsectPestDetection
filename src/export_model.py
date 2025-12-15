import argparse
import os
import sys
from ultralytics import YOLO

def export_model(model_path, format='onnx'):
    """
    Exports a YOLOv8 model to the specified format.
    
    Args:
        model_path (str): Path to the .pt model file.
        format (str): Target format ('onnx' or 'engine').
    """
    if not os.path.exists(model_path):
        print(f"Error: Model file not found at {model_path}")
        return

    print(f"Loading model from {model_path}...")
    model = YOLO(model_path)
    
    print(f"Exporting model to {format}...")
    try:
        # Export the model
        # For TensorRT ('engine'), we need device=0
        device = '0' if format == 'engine' else 'cpu' 
        # Actually export usually runs on CPU for ONNX but let's see. 
        # Ultralytics handles this.
        
        # dynamic=True is often good for ONNX to handle different batch sizes/img sizes, 
        # but for TensorRT fixed size is usually required or optimized.
        # Let's use defaults first.
        
        if format == 'engine':
            export_path = model.export(format=format, device=0)
        else:
            export_path = model.export(format=format)
            
        print(f"✅ Export successful! Saved to: {export_path}")
        return export_path
    except Exception as e:
        print(f"❌ Export failed: {str(e)}")
        return None

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export YOLOv8 model")
    parser.add_argument('--model', type=str, required=True, help='Path to .pt model file')
    parser.add_argument('--format', type=str, default='onnx', choices=['onnx', 'engine'], help='Target format')
    
    args = parser.parse_args()
    
    export_model(args.model, args.format)
