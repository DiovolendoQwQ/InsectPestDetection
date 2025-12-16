# 模型优化评估指南

本指南旨在帮助您评估当前 YOLOv8 模型的性能，并决定是否需要进一步优化。

## 1. 准备工作

确保您已完成一次训练，并且 `runs/detect/{run_name}` 目录下有 `results.csv` 和权重文件。

## 2. 评估步骤

### 步骤 1: 训练曲线分析 (Training Analysis)

运行以下脚本分析训练过程中的 Loss 和 mAP 曲线：

```bash
python src/analyze_training.py runs/detect/train_v8n/results.csv
```

**如何解读：**
- **Loss 曲线**：`Train Loss` 和 `Val Loss` 应同步下降。如果 `Val Loss` 开始上升而 `Train Loss` 继续下降，说明**过拟合**。
- **mAP 曲线**：应呈上升趋势并在最后趋于平稳。如果曲线还在显著上升，说明**欠拟合**，需要更多 Epochs。
- **收敛性**：脚本会输出斜率分析。如果斜率接近 0，说明已收敛。

### 步骤 2: 验证集详细评估 (Validation)

运行以下脚本获取详细的分类指标（Precision, Recall, F1）：

```bash
python src/evaluate_model.py --model runs/detect/train_v8n/weights/best.pt --data data/data.yaml
```

**关注指标：**
- **mAP@0.5**：主要精度指标。如果低于预期（例如 < 0.8），需要优化。
- **混淆矩阵 (Confusion Matrix)**：查看 `eval_results/confusion_matrix.png`。识别哪些类别容易混淆（例如将“背景”误认为“害虫”）。

### 步骤 3: 视频检测稳定性测试 (Video Stability)

如果有测试视频，运行此脚本评估“抖动”和“闪烁”程度：

```bash
python src/evaluate_video_stability.py --video path/to/test_video.mp4 --model runs/detect/train_v8n/weights/best.pt
```

**指标解读：**
- **Count Variance Score**：越低越好。高分表示每帧检测到的数量跳变剧烈（闪烁）。
- **IoU Consistency Score**：越高越好（接近 1.0）。低分表示框的位置在帧间剧烈抖动。

## 3. 优化决策树

根据上述评估结果：

1.  **如果存在过拟合 (Overfitting)**:
    -   **行动**: 增加数据增强 (`augment=True`)，增加 Dropout，或收集更多数据。
2.  **如果存在欠拟合 (Underfitting)**:
    -   **行动**: 增加 Epochs，使用更大的模型 (`yolov8m.pt` 代替 `n`), 或调低正则化参数。
3.  **如果视频抖动严重 (High Variance/Low IoU)**:
    -   **行动**: 开启前端的 **TTA (Max Quality)** 模式，或在训练中启用 `degrees`, `shear` 等几何增强，让模型适应不同角度。
4.  **如果小目标漏检**:
    -   **行动**: 增大训练 `imgsz` (如 1280)，或使用 `SAHI` 切片推理（已在代码中支持）。

## 4. 自动化调优 (Auto Tuning)

如果您不确定最佳参数，可以使用我们提供的网格搜索脚本：

```bash
python src/tune_model.py
```

这将自动尝试不同的学习率和 Batch Size，寻找最佳组合。
