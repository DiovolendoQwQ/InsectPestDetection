import cv2
import numpy as np
import argparse
import json
from ultralytics import YOLO

def calculate_iou(box1, box2):
    # box: [x1, y1, x2, y2]
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    
    intersection = max(0, x2 - x1) * max(0, y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    
    return intersection / (area1 + area2 - intersection + 1e-6)

def evaluate_video_stability(video_path, model_path, conf_thres=0.25):
    print(f"Evaluating stability for {video_path}...")
    
    model = YOLO(model_path)
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        print("Error: Could not open video.")
        return

    frames_detections = []
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        results = model.predict(frame, conf=conf_thres, verbose=False)
        
        # Store detections: list of {'cls': int, 'bbox': [x1,y1,x2,y2]}
        dets = []
        for box in results[0].boxes:
            dets.append({
                'cls': int(box.cls[0]),
                'bbox': box.xyxy[0].tolist()
            })
        frames_detections.append(dets)
        
    cap.release()
    
    # Analyze Stability
    total_frames = len(frames_detections)
    if total_frames == 0:
        print("No frames processed.")
        return

    # Metric 1: Object Count Variance (Sliding Window)
    # High variance in short time means flickering
    counts = [len(f) for f in frames_detections]
    window_size = 10
    variances = []
    for i in range(len(counts) - window_size):
        window = counts[i:i+window_size]
        variances.append(np.var(window))
    
    avg_count_variance = np.mean(variances) if variances else 0
    
    # Metric 2: Frame-to-Frame IoU Consistency
    # For each object in frame t, find best match in t+1 and avg IoU
    ious = []
    for i in range(len(frames_detections) - 1):
        curr_dets = frames_detections[i]
        next_dets = frames_detections[i+1]
        
        if not curr_dets:
            continue
            
        frame_ious = []
        for c_det in curr_dets:
            # Find max IoU in next frame with same class
            max_iou = 0
            for n_det in next_dets:
                if n_det['cls'] == c_det['cls']:
                    iou = calculate_iou(c_det['bbox'], n_det['bbox'])
                    if iou > max_iou:
                        max_iou = iou
            
            # If max_iou is 0, it means object disappeared or no overlap
            # We only care about consistency of *tracked* objects for this metric
            # But "disappearing" is also instability.
            # Let's record the raw max_iou.
            frame_ious.append(max_iou)
            
        if frame_ious:
            ious.append(np.mean(frame_ious))
            
    avg_iou_consistency = np.mean(ious) if ious else 0
    
    report = {
        "video_path": video_path,
        "total_frames": total_frames,
        "avg_object_count": np.mean(counts),
        "stability_metrics": {
            "count_variance_score": float(avg_count_variance), # Lower is better
            "iou_consistency_score": float(avg_iou_consistency) # Higher is better (closer to 1.0)
        }
    }
    
    print("\n--- Stability Report ---")
    print(json.dumps(report, indent=4))
    
    # Interpretation
    print("\nInterpretation:")
    if avg_count_variance > 1.0:
        print("- Warning: High object count variance detected. Objects may be flickering.")
    else:
        print("- Object count is stable.")
        
    if avg_iou_consistency < 0.7:
        print("- Warning: Low IoU consistency. Bounding boxes are jittery or tracking is lost frequently.")
    else:
        print("- Bounding box positions are stable.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--video', type=str, required=True)
    parser.add_argument('--model', type=str, default='runs/detect/train_v8n/weights/best.pt')
    
    args = parser.parse_args()
    evaluate_video_stability(args.video, args.model)
