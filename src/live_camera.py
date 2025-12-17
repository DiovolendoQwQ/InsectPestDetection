import cv2
import argparse
import sys
import os
from ultralytics import YOLO

# Fix for OMP error on Windows
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

def run_live_camera(model_path, conf_thres=0.25):
    try:
        print(f"Loading model: {model_path}...", file=sys.stderr)
        model = YOLO(model_path)
        
        print("Opening camera (Source 0)...", file=sys.stderr)
        cap = cv2.VideoCapture(0)
        
        if not cap.isOpened():
            print("Error: Could not open camera.", file=sys.stderr)
            return
        
        # Set resolution (optional, can adjust based on performance)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        
        print("Camera started. Press 'q' in the window to exit.", file=sys.stderr)
        
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Error: Failed to read frame.", file=sys.stderr)
                break
                
            # Inference
            # verbose=False to keep stdout clean
            results = model.predict(frame, conf=conf_thres, verbose=False)
            result = results[0]
            
            # Plot results on the frame
            annotated_frame = result.plot()
            
            # Add instruction text
            cv2.putText(annotated_frame, "Press 'q' to exit", (10, 30), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            
            # Show in native window
            cv2.imshow("Live Detection", annotated_frame)
            
            # Check for exit key
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
                
        cap.release()
        cv2.destroyAllWindows()
        print("Camera session ended.", file=sys.stderr)
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', type=str, required=True, help='Path to model file')
    parser.add_argument('--conf', type=float, default=0.25, help='Confidence threshold')
    args = parser.parse_args()

    run_live_camera(args.model, args.conf)
