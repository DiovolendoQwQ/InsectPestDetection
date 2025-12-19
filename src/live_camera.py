import cv2
import argparse
import sys
import os
import base64
import json
import time
import select
from ultralytics import YOLO

# Fix for OMP error on Windows
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

def run_live_camera(model_path, conf_thres=0.25):
    try:
        # Load model
        model = YOLO(model_path)
        
        # Open camera
        cap = cv2.VideoCapture(0)
        
        if not cap.isOpened():
            print("Error: Could not open camera.", file=sys.stderr)
            return
        
        # Set resolution
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        
        print("Camera started.", file=sys.stderr)
        
        current_conf = conf_thres

        # Set stdin to non-blocking (Windows needs special handling, but Python's select works on sockets mainly)
        # On Windows, select.select on sys.stdin might not work as expected for pipes.
        # However, for this simple case, we might need a thread to read stdin or use msvcrt on Windows.
        import threading
        import queue
        
        input_queue = queue.Queue()
        
        def read_stdin():
            while True:
                try:
                    line = sys.stdin.readline()
                    if line:
                        input_queue.put(line)
                    else:
                        break
                except:
                    break
        
        t = threading.Thread(target=read_stdin, daemon=True)
        t.start()

        while True:
            # Check for updates from stdin
            while not input_queue.empty():
                line = input_queue.get_nowait()
                if line.startswith("CONF:"):
                    try:
                        new_conf = float(line.strip().split(":")[1])
                        current_conf = new_conf
                        # print(f"Updated confidence to {current_conf}", file=sys.stderr)
                    except ValueError:
                        pass
            
            ret, frame = cap.read()
            if not ret:
                break
                
            # Inference
            results = model.predict(frame, conf=current_conf, verbose=False)
            result = results[0]
            
            # Plot results
            annotated_frame = result.plot()
            
            # Encode to JPEG
            _, buffer = cv2.imencode('.jpg', annotated_frame)
            jpg_as_text = base64.b64encode(buffer).decode('utf-8')
            
            # Print frame to stdout
            print(f"STREAM_FRAME:{jpg_as_text}")
            sys.stdout.flush()
            
            # Limit framerate slightly to prevent flooding electron
            time.sleep(0.03) 
                
    except Exception as e:
        # print(f"Error: {e}", file=sys.stderr)
        pass
    finally:
        if 'cap' in locals():
            cap.release()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', type=str, required=True, help='Path to model file')
    parser.add_argument('--conf', type=float, default=0.25, help='Confidence threshold')
    args = parser.parse_args()

    run_live_camera(args.model, args.conf)
