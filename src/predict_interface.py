import sys
import os
import json
import argparse
import time
import cv2
import base64
from ultralytics import YOLO

# Fix for OMP error on Windows
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

def run_inference(image_path, model_path, conf_thres=0.15):
    try:
        # Check if file exists
        if not os.path.exists(image_path):
            return {"error": f"Image file not found: {image_path}"}

        # Load model
        # Use best.pt by default, fallback to last.pt if best doesn't exist
        if not os.path.exists(model_path):
             # Try fallback to last.pt
             fallback = model_path.replace('best.pt', 'last.pt')
             if os.path.exists(fallback):
                 model_path = fallback
             else:
                 return {"error": f"Model not found at {model_path}"}
        
        model = YOLO(model_path)

        # Inference
        start_time = time.time()
        # Lower confidence threshold to detect more objects
        # Increase imgsz to 1280 to better detect small dense objects (like whiteflies)
        results = model.predict(source=image_path, save=False, conf=0.05, iou=0.45, imgsz=1280)
        end_time = time.time()
        inference_time = round(end_time - start_time, 3)

        result = results[0]
        
        # Process detections
        detections = []
        for box in result.boxes:
            cls_id = int(box.cls[0])
            class_name = model.names[cls_id]
            confidence = float(box.conf[0])
            # xyxy format
            bbox = box.xyxy[0].tolist() # [x1, y1, x2, y2]
            bbox = [round(x) for x in bbox]
            
            detections.append({
                "class_name": class_name,
                "confidence": round(confidence, 4),
                "bbox": bbox
            })

        # Generate annotated image
        # We can use result.plot() which returns a BGR numpy array
        annotated_frame = result.plot()
        
        # Encode to base64 for easy display in Electron
        _, buffer = cv2.imencode('.jpg', annotated_frame)
        jpg_as_text = base64.b64encode(buffer).decode('utf-8')
        base64_image = f"data:image/jpeg;base64,{jpg_as_text}"

        output = {
            "image_path": image_path, # Return original path for reference
            "annotated_image": base64_image, # Base64 for display
            "detections": detections,
            "inference_time": inference_time,
            "object_count": len(detections)
        }
        
        return output

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=str, required=True, help='Path to image file')
    parser.add_argument('--model', type=str, default='runs/detect/train_v8n/weights/best.pt', help='Path to model file')
    parser.add_argument('--conf', type=float, default=0.15, help='Confidence threshold')
    args = parser.parse_args()

    # Redirect stderr to avoid polluting stdout (which is used for JSON)
    # YOLO prints a lot to stderr/stdout
    # In a real app, we might want to silence YOLO output or capture it separately.
    # For now, we will try to ensure only our JSON goes to stdout if possible, 
    # but YOLO logs to stdout too. 
    # We will wrap the output in a specific marker or just print the JSON at the very end.
    
    # Actually, we can assume the Electron app will parse the *last* line of stdout 
    # or look for a specific JSON structure. 
    # A better way is to print a special separator.
    
    result = run_inference(args.source, args.model, args.conf)
    
    # Print a unique separator that Electron can look for, 
    # or just print the JSON as the final output.
    print("__JSON_START__")
    print(json.dumps(result))
    print("__JSON_END__")
