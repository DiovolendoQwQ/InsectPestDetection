# 🐛 害虫检测项目 (Insect Pest Detection)

这是一个基于 YOLOv8 的智能害虫检测系统，能够自动识别图片中的 15 种常见农业害虫。本项目旨在帮助农民伯伯和农业技术人员快速、准确地监测农作物病虫害情况。

![项目封面](runs/detect/train_v8n/results.png)

## 📖 项目简介

想象一下，你有一双"火眼金睛"，只需要看一眼农田的照片，就能立刻知道里面藏着哪些害虫，它们叫什么名字，大概有多少只。这个项目就是利用人工智能技术，赋予计算机这样的能力！

**主要功能：**
*   **自动识别**：支持 15 种害虫（如蚜虫、白粉虱、粘虫等）。
*   **精准定位**：不仅知道有什么虫，还能用方框把它们一个个圈出来。
*   **高效率**：利用 GPU 加速，识别速度非常快。

## 🛠️ 安装指南

按照以下步骤，在你的电脑上安装这个项目。

### 第一步：准备环境
你需要先安装 [Anaconda](https://www.anaconda.com/download) 或 Miniconda。安装完成后，打开终端（Terminal）或 Anaconda Prompt。

### 第二步：下载代码
如果你熟悉 Git，可以使用命令下载。如果不熟悉，直接下载压缩包并解压即可。

### 第三步：创建虚拟环境
我们会创建一个专门的"房间"（虚拟环境）来运行这个项目，避免和其他软件冲突。

在终端中输入以下命令：

```bash
conda env create -f environment.yml
```

等待安装完成（可能需要几分钟，取决于网速）。

### 第四步：激活环境
"房间"建好了，我们需要走进去：

```bash
conda activate yolov8_env
```

看到命令行前面出现 `(yolov8_env)` 字样，就说明成功了！

## 🚀 使用教程

### 1. 训练模型 (让电脑学习)
如果你想让电脑从头开始学习如何认虫子，运行以下命令：

```bash
python src/train.py
```

*   **说明**：这会让电脑看几千张害虫照片，学习它们的特征。
*   **耗时**：使用 GPU 大约需要几十分钟到几小时。

### 2. 恢复训练 (休息一下继续学)
如果训练中断了（比如停电了），不用担心，可以接着上次的进度继续：

```bash
python src/resume_train.py
```

### 3. 查看报告 (学习成绩单)
训练完成后，想看看电脑学得怎么样？生成一份详细的体检报告：

```bash
python scripts/generate_report.py
```

报告文件会保存在 `docs/final_report.md`，里面有详细的评分和图表。

### 4. 数据集质检 (检查教材质量)
在开始学习前，最好检查一下照片（教材）是不是清晰、标签对不对：

```bash
python scripts/check_yolo_dataset.py --data data/data.yaml
```

## 🖥️ 桌面应用 (GUI)

本项目提供了一个基于 Electron 的可视化桌面应用，方便进行模型训练和监控。

### 启动方法

1.  进入应用目录：
    ```bash
    cd electron-app
    ```
2.  安装依赖 (仅需一次)：
    ```bash
    npm install
    ```
3.  启动应用：
    ```bash
    npm run dev
    ```

**功能亮点：**
*   **实时监控**：查看 CPU、内存和 GPU 使用率。
*   **可视化训练**：一键配置 Epochs 等参数，实时查看训练日志。
*   **深色模式**：专业的科技感界面设计。

## ❓ 常见问题解答 (FAQ)

**Q: 训练时提示 "CUDA not available" 怎么办？**
A: 这说明你的电脑可能没有安装显卡驱动，或者 PyTorch 版本不对。请运行 `python scripts/verify_gpu.py` 检查 GPU 状态。如果没有 NVIDIA 显卡，训练会很慢（使用 CPU）。

**Q: 图片放在哪里？**
A: 所有训练用的图片都放在 `data/images` 目录下，标签放在 `data/labels` 目录下。

**Q: 训练结果保存在哪？**
A: 所有的训练记录、模型权重文件（`.pt`）和图表都保存在 `runs/detect/` 目录下。

## 📞 联系方式

如果你在使用过程中遇到任何问题，或者有好的建议，欢迎联系我！

*   **邮箱**: diovolendoxch@gmail.com
*   **GitHub**: [[DiovolendoQwQ](https://github.com/DiovolendoQwQ)]

---
*这就去试试吧，祝你捉虫愉快！* 🌾🐞
