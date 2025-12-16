import sys
import os
import json
import argparse
import time
import cv2
import base64
from ultralytics import YOLO
import numpy as np

# Fix for OMP error on Windows
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

# Global variables
SAHI_AVAILABLE = False
try:
    from sahi import AutoDetectionModel
    from sahi.predict import get_sliced_prediction
    SAHI_AVAILABLE = True
except ImportError:
    pass

def run_inference(source_path, model_path, conf_thres=0.25, augment=False, target_fps=1, quality='medium'):
    try:
        # Determine settings based on quality
        imgsz = 640
        if quality == 'low':
            imgsz = 320
        elif quality == 'high':
            imgsz = 1280
        elif quality == 'max':
            imgsz = 1280 # Max resolution
            augment = True # Force augment if not already passed (though main.js passes it too)
            
        # Check if file exists
        if not os.path.exists(source_path):
            return {"error": f"File not found: {source_path}"}

        # Load model
        # Support loading ONNX/TensorRT if available
        # Check if an optimized model exists in the same directory
        original_model_path = model_path
        base_model_path = os.path.splitext(model_path)[0]
        onnx_path = base_model_path + ".onnx"
        engine_path = base_model_path + ".engine"
        
        # Check environment capabilities
        onnx_available = False
        try:
            import onnxruntime
            onnx_available = True
        except ImportError:
            print("Warning: onnxruntime module not found. Disabling ONNX support.", file=sys.stderr)

        # Prefer Engine > ONNX > PT
        if os.path.exists(engine_path):
            print(f"Loading optimized TensorRT model: {engine_path}", file=sys.stderr)
            model_path = engine_path
        elif os.path.exists(onnx_path) and onnx_available:
            print(f"Loading optimized ONNX model: {onnx_path}", file=sys.stderr)
            model_path = onnx_path
        elif not os.path.exists(model_path):
             fallback = model_path.replace('best.pt', 'last.pt')
             if os.path.exists(fallback):
                 model_path = fallback
             else:
                 return {"error": f"Model not found at {model_path}"}
        
        # Load YOLO model with explicit GPU device if available
        # Check if CUDA is available
        import torch
        device = '0' if torch.cuda.is_available() else 'cpu'
        
        # Note: If using SAHI, we load model differently
        try:
            model = YOLO(model_path)
        except Exception as e:
            # If loading optimized model fails (e.g. onnxruntime version mismatch), fallback to PT
            if model_path != original_model_path:
                print(f"Warning: Failed to load optimized model ({str(e)}). Falling back to {original_model_path}", file=sys.stderr)
                model_path = original_model_path
                model = YOLO(model_path)
            else:
                raise e
        
        # Determine if source is video or image
        ext = os.path.splitext(source_path)[1].lower()
        is_video = ext in ['.mp4', '.avi', '.mov', '.mkv', '.webm']

        start_time = time.time()

        if is_video:
            # Video Inference - Standard YOLO Tracking (SAHI is too slow for video usually)
            cap = cv2.VideoCapture(source_path)
            if not cap.isOpened():
                return {"error": "Could not open video source"}

            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

            # Output path
            # Use .webm for better compatibility with Electron/Chromium
            dir_name = os.path.dirname(source_path)
            base_name = os.path.splitext(os.path.basename(source_path))[0]
            output_path = os.path.join(dir_name, f"{base_name}_detected.webm")

            # Codec
            # No longer writing video to file to save time
            # We will return frame-by-frame detection data instead
            
            frame_count = 0
            detections_summary = {} # class -> count
            frames_data = [] # Store per-frame detection data
            
            # Reduce frame rate based on target_fps
            # If target_fps is <= 0 (e.g. -1), use frame_interval = 1 (Native FPS)
            if target_fps <= 0:
                frame_interval = 1
            else:
                frame_interval = int(fps / target_fps)
                if frame_interval < 1: frame_interval = 1

            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Skip frames to achieve 1 fps processing
                if frame_count % frame_interval != 0:
                    frame_count += 1
                    continue

                # Inference on frame
                try:
                    # Use predict() instead of track() for performance on video stream
                    # Tracking is computationally expensive and not strictly necessary for simple counting
                    results = model.predict(frame, conf=0.25, imgsz=imgsz, verbose=False, device=device)
                except Exception as e:
                    if frame_count == 0:
                        print(f"Warning: Inference failed ({str(e)}), retrying.", file=sys.stderr)
                    results = model.predict(frame, conf=0.25, imgsz=imgsz, verbose=False, device=device)
                
                result = results[0]
                
                # Collect frame detections
                current_time = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
                frame_dets = []
                frame_det_summary = {} # Summary for this frame for UI table

                for box in result.boxes:
                    cls_id = int(box.cls[0])
                    class_name = model.names[cls_id]
                    confidence = float(box.conf[0])
                    bbox = box.xyxy[0].tolist()
                    bbox = [round(x) for x in bbox]
                    
                    # Filter out low confidence detections
                    if confidence < conf_thres:
                        continue

                    frame_dets.append({
                        "class_name": class_name,
                        "confidence": round(confidence, 4),
                        "bbox": bbox
                    })
                    
                    # Update global summary
                    detections_summary[class_name] = detections_summary.get(class_name, 0) + 1
                    
                    # Update per-frame summary for real-time table
                    if class_name not in frame_det_summary:
                        frame_det_summary[class_name] = {"count": 0, "total_conf": 0.0}
                    frame_det_summary[class_name]["count"] += 1
                    frame_det_summary[class_name]["total_conf"] += confidence

                frames_data.append({
                    "time": current_time,
                    "detections": frame_dets
                })

                frame_count += 1
                
                # Print progress
                if total_frames > 0 and frame_count % (frame_interval * 5) == 0:
                   progress = int((frame_count / total_frames) * 100)
                   print(f"PROGRESS:{progress}", file=sys.stderr, flush=True)
                
                # Print real-time data for UI table
                # Format summary for UI
                # Simplified JSON format
                ui_stats = {}
                total_objects = 0
                for cls, data in frame_det_summary.items():
                    ui_stats[cls] = data["count"]
                    total_objects += data["count"]
                
                # Always print stream data
                stream_payload = {
                    "type": "video_frame",
                    "timestamp": round(current_time, 2),
                    "stats": ui_stats,
                    "total": total_objects
                }
                print(f"STREAM_DATA:{json.dumps(stream_payload)}", file=sys.stdout, flush=True)

            cap.release()
            
            end_time = time.time()
            inference_time = round(end_time - start_time, 3)

            # Convert summary to list
            detections_list = [{"class_name": k, "count": v} for k, v in detections_summary.items()]
            
            top_class = "None"
            if detections_summary:
                top_class = max(detections_summary, key=detections_summary.get)

            output = {
                "is_video": True,
                "image_path": source_path,
                "video_path": None, # No new video generated
                "frames_data": frames_data, # Detailed frame data
                "detections": detections_list, 
                "inference_time": inference_time,
                "object_count": sum(detections_summary.values()),
                "top_class": top_class,
                "fps": fps,
                "total_frames": total_frames
            }
            return output

        else:
            # Image Inference
            # Use SAHI if requested and available
            if augment and SAHI_AVAILABLE:
                # SAHI Inference
                # Load detection model via SAHI
                sahi_model = AutoDetectionModel.from_pretrained(
                    model_type='yolov8',
                    model_path=model_path,
                    confidence_threshold=conf_thres,
                    device=device
                )
                
                # Sliced prediction
                result = get_sliced_prediction(
                    source_path,
                    sahi_model,
                    slice_height=640,
                    slice_width=640,
                    overlap_height_ratio=0.2,
                    overlap_width_ratio=0.2
                )
                
                end_time = time.time()
                inference_time = round(end_time - start_time, 3)
                
                # Process SAHI results
                detections = []
                # SAHI returns object_prediction_list
                for prediction in result.object_prediction_list:
                    class_name = prediction.category.name
                    confidence = prediction.score.value
                    bbox = prediction.bbox.to_xyxy() # [x1, y1, x2, y2]
                    bbox = [round(x) for x in bbox]
                    
                    detections.append({
                        "class_name": class_name,
                        "confidence": round(confidence, 4),
                        "bbox": bbox
                    })
                
                # Create annotated image
                # result.export_visuals(export_dir=".") # This saves to disk
                # We want base64. 
                # SAHI doesn't easily give a plotted cv2 image directly in memory 
                # without some work, but we can draw boxes on original image.
                
                original_image = cv2.imread(source_path)
                for det in detections:
                    x1, y1, x2, y2 = det['bbox']
                    # Draw box
                    cv2.rectangle(original_image, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    # Draw label
                    label = f"{det['class_name']} {det['confidence']:.2f}"
                    cv2.putText(original_image, label, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                
                annotated_frame = original_image

            else:
                # Standard YOLO Inference
                results = model.predict(source=source_path, save=False, conf=conf_thres, iou=0.45, imgsz=1280, augment=augment, device=device)
                end_time = time.time()
                inference_time = round(end_time - start_time, 3)

                result = results[0]
                
                detections = []
                for box in result.boxes:
                    cls_id = int(box.cls[0])
                    class_name = model.names[cls_id]
                    confidence = float(box.conf[0])
                    bbox = box.xyxy[0].tolist()
                    bbox = [round(x) for x in bbox]
                    
                    detections.append({
                        "class_name": class_name,
                        "confidence": round(confidence, 4),
                        "bbox": bbox
                    })

                annotated_frame = result.plot()

            _, buffer = cv2.imencode('.jpg', annotated_frame)
            jpg_as_text = base64.b64encode(buffer).decode('utf-8')
            base64_image = f"data:image/jpeg;base64,{jpg_as_text}"

            output = {
                "is_video": False,
                "image_path": source_path,
                "annotated_image": base64_image,
                "detections": detections,
                "inference_time": inference_time,
                "object_count": len(detections)
            }
            return output

    except Exception as e:
        import traceback
        return {"error": str(e), "traceback": traceback.format_exc()}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=str, required=True, help='Path to file')
    parser.add_argument('--model', type=str, default='runs/detect/train_v8n/weights/best.pt', help='Path to model file')
    parser.add_argument('--conf', type=float, default=0.25, help='Confidence threshold')
    parser.add_argument('--augment', action='store_true', help='Enable Test-Time Augmentation (TTA)')
    parser.add_argument('--target_fps', type=int, default=1, help='Target FPS for video processing. Set to -1 for native FPS.')
    parser.add_argument('--quality', type=str, default='medium', choices=['low', 'medium', 'high', 'max'], help='Inference quality')
    args = parser.parse_args()

    # Global model loading to avoid reloading on every call
    # Note: In the current architecture, this script is spawned as a subprocess for each inference,
    # so global loading here doesn't help persistent memory. 
    # To truly optimize, we would need a persistent Python server (e.g. Flask/FastAPI).
    # But we can at least ensure we use the GPU.
    
    # Check for SAHI availability
    try:
        from sahi import AutoDetectionModel
        from sahi.predict import get_sliced_prediction
        SAHI_AVAILABLE = True
    except ImportError:
        SAHI_AVAILABLE = False

    result = run_inference(args.source, args.model, args.conf, augment=args.augment, target_fps=args.target_fps, quality=args.quality)
    
    print("__JSON_START__")
    print(json.dumps(result))
    print("__JSON_END__")
