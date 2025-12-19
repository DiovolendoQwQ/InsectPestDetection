import React, { useState } from 'react';
import { 
  Box, 
  Grid, 
  Paper, 
  Button, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Card,
  CardContent,
  Stack,
  Divider,
  Chip,
  CircularProgress,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  FormControlLabel,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Image as ImageIcon,
  Videocam as VideoIcon,
  CameraAlt as CameraIcon,
  Folder as FolderIcon,
  Save as SaveIcon,
  ExitToApp as ExitIcon,
  AccessTime as TimeIcon,
  Tag as CountIcon,
  Category as ClassIcon,
  MyLocation as CoordsIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

const Testing = () => {
  const [previewSrc, setPreviewSrc] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [results, setResults] = useState([]);
  const [currentResult, setCurrentResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [framesData, setFramesData] = useState([]);
  const [fps, setFps] = useState(1);
  const [useNativeFps, setUseNativeFps] = useState(false);
  const [quality, setQuality] = useState('medium');
  const [modelList, setModelList] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.50); // New state for confidence
  const [isCameraLoading, setIsCameraLoading] = useState(false); // New state for camera loading
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const requestRef = React.useRef();
  const isRunningRef = React.useRef(false);

  // Helper to process frames data for smooth tracking
  // We want to create "tracks" where objects persist across frames
  // This is a simple greedy linker
  const processTracks = (rawFrames) => {
      // rawFrames is sorted by time
      if (!rawFrames || rawFrames.length === 0) return [];

      // Add IDs to detections for interpolation
      let nextId = 0;
      const frames = JSON.parse(JSON.stringify(rawFrames)); // Deep copy

      for (let i = 0; i < frames.length - 1; i++) {
          const currFrame = frames[i];
          const nextFrame = frames[i+1];
          
          if (!currFrame.detections) continue;

          currFrame.detections.forEach(det => {
              if (!det.id) det.id = nextId++;
          });

          if (!nextFrame.detections) continue;

          // Link to next frame
          // Simple IoU or distance matching
          currFrame.detections.forEach(currDet => {
              let bestMatch = null;
              let minDist = 100000;

              // Find closest in next frame of same class
              nextFrame.detections.forEach(nextDet => {
                  if (nextDet.class_name !== currDet.class_name) return;
                  if (nextDet.matched) return; // Already matched

                  // Center distance
                  const cx1 = (currDet.bbox[0] + currDet.bbox[2])/2;
                  const cy1 = (currDet.bbox[1] + currDet.bbox[3])/2;
                  const cx2 = (nextDet.bbox[0] + nextDet.bbox[2])/2;
                  const cy2 = (nextDet.bbox[1] + nextDet.bbox[3])/2;
                  
                  const dist = Math.sqrt(Math.pow(cx2-cx1, 2) + Math.pow(cy2-cy1, 2));
                  
                  // Threshold (e.g. 100px movement allowed)
                  if (dist < 200 && dist < minDist) {
                      minDist = dist;
                      bestMatch = nextDet;
                  }
              });

              if (bestMatch) {
                  bestMatch.id = currDet.id; // Propagate ID
                  bestMatch.matched = true;
              }
          });
          
          // Reset matched flag for next iteration logic (actually not needed if we iterate forward)
      }
      
      // Ensure last frame has IDs
      const lastFrame = frames[frames.length - 1];
      if (lastFrame && lastFrame.detections) {
          lastFrame.detections.forEach(det => {
              if (!det.id) det.id = nextId++;
          });
      }

      return frames;
  };

  // Rendering Loop
  const animate = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video && canvas && !video.paused && !video.ended && framesData.length > 0) {
          drawFrame();
      }
      requestRef.current = requestAnimationFrame(animate);
  };

  React.useEffect(() => {
      requestRef.current = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(requestRef.current);
  }, [framesData, isVideo]); // Re-bind when data changes

  const handleConfidenceChange = (event, newValue) => {
      setConfidenceThreshold(newValue);
      // Send real-time update to backend if camera is running
      if (isRunningRef.current) {
          window.electronAPI.updateConfidence(newValue);
      }
  };

  const drawFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext('2d');
      // Match canvas size
      if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
          canvas.width = video.clientWidth;
          canvas.height = video.clientHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const currentTime = video.currentTime;
      
      // Find surrounding frames
      // framesData is sorted
      let prevFrame = null;
      let nextFrame = null;
      
      // Binary search or findIndex
      // Optimization: remember last index? For now, find is okay for small arrays (<1000)
      for (let i = 0; i < framesData.length; i++) {
          if (framesData[i].time > currentTime) {
              nextFrame = framesData[i];
              prevFrame = framesData[i-1];
              break;
          }
      }
      
      if (!nextFrame && framesData.length > 0) {
          // End of video or past last detection
          prevFrame = framesData[framesData.length - 1];
      }
      
      // Scale factors
      const scaleX = canvas.width / video.videoWidth;
      const scaleY = canvas.height / video.videoHeight;

      // Draw Logic
      if (prevFrame && nextFrame && prevFrame.detections && nextFrame.detections) {
          // Interpolation Mode
          const timeRatio = (currentTime - prevFrame.time) / (nextFrame.time - prevFrame.time);
          
          // Draw prevFrame detections, interpolating to nextFrame if ID matches
          prevFrame.detections.forEach(det => {
              let x1 = det.bbox[0];
              let y1 = det.bbox[1];
              let x2 = det.bbox[2];
              let y2 = det.bbox[3];
              let opacity = 1.0;
              
              // Find match in nextFrame
              const match = nextFrame.detections.find(d => d.id === det.id);
              
              if (match) {
                  // Lerp
                  x1 = x1 + (match.bbox[0] - x1) * timeRatio;
                  y1 = y1 + (match.bbox[1] - y1) * timeRatio;
                  x2 = x2 + (match.bbox[2] - x2) * timeRatio;
                  y2 = y2 + (match.bbox[3] - y2) * timeRatio;
              } else {
                  // Fade out if no match
                  opacity = 1.0 - timeRatio;
              }
              
              drawBox(ctx, det, x1, y1, x2, y2, scaleX, scaleY, opacity);
          });
          
          // Draw new objects in nextFrame that started appearing (Fade In)
          nextFrame.detections.forEach(det => {
             const match = prevFrame.detections.find(d => d.id === det.id);
             if (!match) {
                 // It's a new object, fade in
                 const opacity = timeRatio;
                 drawBox(ctx, det, det.bbox[0], det.bbox[1], det.bbox[2], det.bbox[3], scaleX, scaleY, opacity);
             }
          });

      } else if (prevFrame && prevFrame.detections) {
          // Static last frame or no next frame (end of video)
          // Fade out if too far from frame time (e.g. > 1s)
          const age = currentTime - prevFrame.time;
          const opacity = Math.max(0, 1.0 - age); // Fade out over 1 second
          
          if (opacity > 0) {
              prevFrame.detections.forEach(det => {
                  drawBox(ctx, det, det.bbox[0], det.bbox[1], det.bbox[2], det.bbox[3], scaleX, scaleY, opacity);
              });
          }
      }
  };

  const drawBox = (ctx, det, x1, y1, x2, y2, scaleX, scaleY, opacity) => {
      const bx = x1 * scaleX;
      const by = y1 * scaleY;
      const bw = (x2 - x1) * scaleX;
      const bh = (y2 - y1) * scaleY;

      ctx.globalAlpha = opacity;
      
      // Draw box
      ctx.strokeStyle = '#00bcd4';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);

      // Draw label
      ctx.fillStyle = 'rgba(0, 188, 212, 0.8)';
      ctx.fillRect(bx, by - 20, ctx.measureText(det.class_name).width + 10, 20);
      ctx.fillStyle = '#000';
      ctx.font = '12px sans-serif';
      ctx.fillText(`${det.class_name} ${(det.confidence * 100).toFixed(0)}%`, bx + 5, by - 5);
      
      ctx.globalAlpha = 1.0;
  };

  // Listen for progress and stream
  React.useEffect(() => {
    const handleProgress = (p) => {
        setProgress(p);
    };
    
    // Handle real-time data from video
    const handleData = (data) => {
        // Prevent late updates from overwriting final result
        if (!isRunningRef.current) return;

        console.log("Received video data:", data); // Debug output
        
        // data = { type: "video_frame", timestamp: float, stats: {class: count}, total: int }
        
        if (data.type === "video_frame") {
            // New simplified video format
            const timestampStr = `${data.timestamp.toFixed(1)}s`;
            
            // Find top class
            let topClass = "None";
            let maxCount = 0;
            if (data.stats) {
                for (const [cls, count] of Object.entries(data.stats)) {
                    if (count > maxCount) {
                        maxCount = count;
                        topClass = cls;
                    }
                }
            }
            
            // Create a summary row for this frame
            const summaryRow = {
                path: timestampStr, // Time column
                class: topClass,
                confidence: maxCount > 0 ? 1.0 : 0, // Just to show color
                box: [`${data.total}`], // Count column
                isSummary: true,
                rawStats: data.stats
            };
            
            // Append new row to history (Newest First)
            setResults(prev => [summaryRow, ...prev]);
            
            // Update Detailed Results Panel in Real-time
            setCurrentResult({
                time: data.timestamp.toFixed(1), // Show current timestamp instead of total time
                count: data.total,
                topClass: topClass,
                topConf: maxCount > 0 ? 1.0 : 0, // Confidence for video is just binary detected/empty for summary
                box: [] // Video doesn't have single ROI
            });

        } else if (data.summary) {
            // Legacy format fallback (if backend not updated)
            // ... (keep existing logic if needed or remove)
        }
    };

    window.electronAPI.onInferenceProgress(handleProgress);
    window.electronAPI.onInferenceData(handleData);
    window.electronAPI.onInferenceStream((frame) => {
        if (isRunningRef.current) {
            setPreviewSrc(frame);
        }
    });

    // Listen for camera ready signal
    window.electronAPI.onCameraReady(() => {
        setIsCameraLoading(false);
    });
    
    return () => {
        window.electronAPI.removeProgressListeners();
    };
  }, []);

  // Load Model List
  React.useEffect(() => {
      const loadModels = async () => {
          try {
              const models = await window.electronAPI.getModelList();
              if (models && models.length > 0) {
                  setModelList(models);
                  setSelectedModel(models[0].path);
              }
          } catch (e) {
              console.error("Failed to load models:", e);
          }
      };
      loadModels();
  }, []);

  // Handle video time update to draw boxes
  // Replaced by requestAnimationFrame loop
  // But we might need to keep it for manual seek updates if animation loop is paused
  const handleTimeUpdate = () => {
     // Do nothing, let animation loop handle it
  };

  // Handlers
  const handleSelectImage = async () => {
    try {
      // Stop any running inference
      window.electronAPI.stopInference();
      
      const filePath = await window.electronAPI.openFileDialog();
      if (!filePath) return;

      // Show loading state
      setLoading(true);
      setProgress(0);
      setPreviewSrc(null);
      setFramesData([]);
      setIsVideo(false);
      
      const fpsValue = useNativeFps ? -1 : fps;
      // Call inference
      const result = await window.electronAPI.runInference(filePath, { fps: fpsValue, quality, modelPath: selectedModel });
      
      isRunningRef.current = false; // Stop accepting stream updates
      setLoading(false);
      setProgress(0);

      if (result.error) {
        console.error("Inference Error:", result.error);
        alert(`Error: ${result.error}`);
        return;
      }

      // Update state
      if (result.annotated_image) {
        setPreviewSrc(result.annotated_image);
      }

      // Prepare table row data
      let topClass = "None";
      let topConf = 0;
      let box = [];
      
      if (result.detections && result.detections.length > 0) {
          // Sort by conf
          const sorted = [...result.detections].sort((a,b) => b.confidence - a.confidence);
          topClass = sorted[0].class_name;
          topConf = sorted[0].confidence;
          box = sorted[0].bbox;
      }

      // Filter invalid results
      if (topClass === "None" || topConf < 0.01 || !box || box.length === 0) {
          // Skip adding to table if no valid detection
          console.warn("Skipping invalid result:", result);
      } else {
          const newEntry = {
              path: result.image_path,
              class: topClass,
              confidence: topConf,
              box: box,
              fullDetails: result 
          };

          setResults(prev => [...prev, newEntry]);
      }
      
      // Update Detailed Results Panel
      setCurrentResult({
          time: result.inference_time,
          count: result.object_count,
          topClass: topClass,
          topConf: topConf,
          box: box
      });

    } catch (error) {
      console.error("Handler Error:", error);
      setLoading(false);
    }
  };

  const handleSelectVideo = async () => {
    try {
      // Stop any running inference
      window.electronAPI.stopInference();

      const filePath = await window.electronAPI.openVideoDialog();
      if (!filePath) return;

      setLoading(true);
      setProgress(0);
      isRunningRef.current = true; // Mark as running
      
      // Set preview immediately for video
      const videoUrl = `file://${filePath.replace(/\\/g, '/')}`;
      setPreviewSrc(videoUrl);
      setIsVideo(true);
      setFramesData([]);
      setResults([]); // Clear previous results

      const fpsValue = useNativeFps ? -1 : fps;
      const result = await window.electronAPI.runInference(filePath, { fps: fpsValue, quality, modelPath: selectedModel });
      
      isRunningRef.current = false; // Stop accepting stream updates
      setLoading(false);
      setProgress(0);

      if (result.error) {
        console.error("Inference Error:", result.error);
        alert(`Error: ${result.error}`);
        return;
      }

      if (result.is_video && result.frames_data) {
         // Process tracks for smoothness
         const smoothFrames = processTracks(result.frames_data);
         setFramesData(smoothFrames);
         
         // For video, we DO NOT add a row to the table because it confuses the user (looks like invalid detection).
         // The video results are visualized in real-time on the video player.
         
         // Only update the Detailed Results panel
         setCurrentResult({
            time: result.inference_time,
            count: result.object_count, // Total detections across frames
            topClass: result.top_class,
            topConf: result.object_count > 0 ? 1.0 : 0, // Show valid confidence if objects found
            box: [] // Video doesn't have a single ROI
         });
      }

    } catch (error) {
       console.error("Video Handler Error:", error);
       setLoading(false);
    }
  };

  const handleSelectBatchFolder = async () => {
    try {
        // Stop any running inference
        window.electronAPI.stopInference();

        const folderPath = await window.electronAPI.openDirectoryDialog();
        if (!folderPath) return;

        setLoading(true);
        setProgress(0);
        setResults([]);
        setPreviewSrc(null); // Or set a placeholder
        setCurrentResult(null);

        // Call batch inference
        const result = await window.electronAPI.runBatchInference(folderPath, { modelPath: selectedModel });

        setLoading(false);
        setProgress(0);

        if (result.error) {
            console.error("Batch Inference Error:", result.error);
            alert(`Error: ${result.error}`);
            return;
        }

        if (result.success) {
            alert(`Batch processing complete!\n\nProcessed: ${result.processed_count} images\nOutput Directory: ${result.output_dir}\nCSV Report: ${result.csv_path}`);
            
            // Add a summary row to the table
            const summaryRow = {
                path: "Batch Summary",
                class: "Multiple",
                confidence: 1.0,
                box: [`${result.processed_count} files`],
                isSummary: true
            };
            setResults([summaryRow]);
        }

    } catch (error) {
        console.error("Batch Handler Error:", error);
        setLoading(false);
    }
  };

  const handleOpenCamera = async () => {
    try {
        console.log("Opening camera...");
        
        // Stop any running inference
        window.electronAPI.stopInference();
        
        // Reset state for live stream
        setLoading(false); // We don't want the loading spinner to block the view, or maybe we do initially?
        // Actually, let's show loading until first frame comes? 
        // But for now, let's just set isRunning to true and clear preview
        
        setPreviewSrc(null);
        setIsVideo(false);
        setResults([]);
        setCurrentResult(null);
        isRunningRef.current = true;
        setIsCameraLoading(true); // Start loading

        await window.electronAPI.openCamera({ modelPath: selectedModel, conf: confidenceThreshold });
        
        // When await returns, the camera process has closed
        isRunningRef.current = false;
        setIsCameraLoading(false); // Stop loading if process exits
        
    } catch (error) {
        console.error("Camera Error:", error);
        alert("Failed to open camera: " + error.message);
        isRunningRef.current = false;
        setIsCameraLoading(false); // Stop loading on error
    }
  };

  return (
    <Box sx={{ 
      height: '100%', 
      minHeight: '80vh',
      display: 'flex', 
      flexDirection: 'column',
      bgcolor: 'background.default',
      pb: { xs: 4, md: 0 } // Add padding bottom on mobile for scrolling
    }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 700, color: 'text.primary' }}>
        Inference & Testing
      </Typography>

      <Grid container spacing={3} sx={{ flex: 1 }}>
        
        {/* LEFT PANEL (70%) */}
        <Grid size={{ xs: 12, md: 8 }} sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: { xs: 'auto', md: '100%' } }}>
          
          {/* Upper: Preview Area */}
          <Paper 
            elevation={3} 
            sx={{ 
              flex: 'none',
              flexShrink: 0,
              height: { xs: 300, md: 450 }, // Fixed height to prevent jitter
              bgcolor: '#000', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative',
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            {loading ? (
               // Show loading overlay on top of video if video is selected
               isVideo && previewSrc ? (
                 <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <video 
                      ref={videoRef}
                      src={previewSrc} 
                      controls 
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                    />
                    <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                        <CircularProgress color="primary" variant={progress > 0 ? "determinate" : "indeterminate"} value={progress} />
                        <Typography color="textSecondary" sx={{ mt: 2 }}>
                            {progress > 0 ? `Analyzing Video: ${progress}%` : "Initializing Analysis..."}
                        </Typography>
                    </Box>
                 </Box>
               ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: '80%' }}>
                   <CircularProgress color="primary" />
                   <Typography color="textSecondary">Running Inference...</Typography>
                </Box>
               )
            ) : previewSrc ? (
              isVideo ? (
                <Box sx={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <video 
                      ref={videoRef}
                      src={previewSrc} 
                      controls 
                      onTimeUpdate={handleTimeUpdate}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                    />
                    <canvas 
                        ref={canvasRef}
                        style={{ position: 'absolute', pointerEvents: 'none', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                </Box>
              ) : (
                <img 
                  src={previewSrc} 
                  alt="Preview" 
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
                />
              )
            ) : (
              <Box sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                <ImageIcon sx={{ fontSize: 60, mb: 2 }} />
                <Typography>No Image/Video Selected</Typography>
              </Box>
            )}
          </Paper>

          {/* Lower: Data Table */}
          <Paper 
            elevation={3} 
            sx={{ 
              flex: 'none',
              height: 300, // Fixed height for internal scrolling
              overflow: 'hidden', 
              display: 'flex', 
              flexDirection: 'column',
              borderRadius: 2,
              bgcolor: '#000',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <TableContainer sx={{ maxHeight: '100%', overflowY: 'auto' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{isVideo ? "Time" : "ID"}</TableCell>
                    <TableCell>{isVideo ? "Top Class" : "File Path"}</TableCell>
                    <TableCell>{isVideo ? "Count" : "Class"}</TableCell>
                    <TableCell>{isVideo ? "Status" : "Confidence"}</TableCell>
                    {!isVideo && <TableCell>Coordinates (x,y,w,h)</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.length > 0 ? (
                    results.map((row, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{isVideo ? row.path : index + 1}</TableCell>
                        <TableCell sx={{ maxWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {isVideo ? row.class : row.path}
                        </TableCell>
                        <TableCell>
                           {isVideo ? row.box[0] : (
                             <Chip label={row.class} size="small" color="primary" variant="outlined" />
                           )}
                        </TableCell>
                        <TableCell>
                            {isVideo ? (
                               <Chip 
                                 label={row.confidence > 0 ? "Detected" : "Empty"} 
                                 size="small" 
                                 color={row.confidence > 0 ? "success" : "default"} 
                                 variant="outlined" 
                               />
                            ) : (
                               `${(row.confidence * 100).toFixed(2)}%`
                            )}
                        </TableCell>
                        {!isVideo && (
                            <TableCell>
                                {`[${row.box.join(', ')}]`}
                            </TableCell>
                        )}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                        No records found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* RIGHT PANEL (30%) */}
        <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {/* Input Selection */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Input Source</Typography>
              
              {/* Model Selection */}
              <FormControl fullWidth sx={{ mb: 3 }} size="small">
                <InputLabel id="model-select-label">Select Model</InputLabel>
                <Select
                  labelId="model-select-label"
                  value={selectedModel}
                  label="Select Model"
                  onChange={(e) => setSelectedModel(e.target.value)}
                >
                  {modelList.map((model, idx) => (
                    <MenuItem key={idx} value={model.path}>
                      {model.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Stack spacing={2}>
                <Button 
                  variant="outlined" 
                  startIcon={<ImageIcon />} 
                  fullWidth 
                  onClick={handleSelectImage}
                  sx={{ justifyContent: 'flex-start', py: 1.5 }}
                >
                  Select Image
                </Button>
                <Button 
                  variant="outlined" 
                  startIcon={<VideoIcon />} 
                  fullWidth
                  onClick={handleSelectVideo}
                  sx={{ justifyContent: 'flex-start', py: 1.5 }}
                >
                  Select Video
                </Button>
                <Button 
                  variant="outlined" 
                  startIcon={isCameraLoading ? <CircularProgress size={20} color="inherit" /> : <CameraIcon />} 
                  fullWidth
                  onClick={handleOpenCamera}
                  disabled={isCameraLoading}
                  sx={{ justifyContent: 'flex-start', py: 1.5 }}
                >
                  {isCameraLoading ? "Starting Camera..." : "Open Camera"}
                </Button>
                <Button 
                  variant="outlined" 
                  startIcon={<FolderIcon />} 
                  fullWidth
                  onClick={handleSelectBatchFolder}
                  sx={{ justifyContent: 'flex-start', py: 1.5 }}
                >
                  Batch Folder
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SettingsIcon /> Inference Settings
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography gutterBottom variant="caption" color="text.secondary">
                          Video Frame Rate (FPS): {useNativeFps ? "Max (Native)" : fps}
                      </Typography>
                      <FormControlLabel
                          control={
                              <Switch 
                                  size="small" 
                                  checked={useNativeFps} 
                                  onChange={(e) => setUseNativeFps(e.target.checked)} 
                              />
                          }
                          label={<Typography variant="caption">Native FPS</Typography>}
                      />
                  </Box>
                  <Slider
                      value={fps}
                      onChange={(e, v) => setFps(v)}
                      min={1}
                      max={30}
                      step={1}
                      disabled={useNativeFps}
                      marks={[
                          { value: 1, label: '1' },
                          { value: 15, label: '15' },
                          { value: 30, label: '30' },
                      ]}
                      valueLabelDisplay="auto"
                  />
              </Box>

              <Box>
                  <Typography gutterBottom variant="caption" color="text.secondary">
                      Detection Quality (Resolution & Precision)
                  </Typography>
                  <ToggleButtonGroup
                      value={quality}
                      exclusive
                      onChange={(e, v) => v && setQuality(v)}
                      fullWidth
                      size="small"
                      color="primary"
                  >
                      <ToggleButton value="low">Low</ToggleButton>
                      <ToggleButton value="medium">Med</ToggleButton>
                      <ToggleButton value="high">High</ToggleButton>
                      <ToggleButton value="max" sx={{ fontWeight: 'bold', color: 'secondary.main' }}>Max</ToggleButton>
                  </ToggleButtonGroup>
                  {quality === 'max' && (
                      <Typography variant="caption" color="secondary" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
                          * Max Quality enables TTA (Test Time Augmentation) and high resolution. It will be significantly slower but more accurate.
                      </Typography>
                  )}
              </Box>
              
              <Box sx={{ mt: 3 }}>
                  <Typography gutterBottom variant="caption" color="text.secondary">
                      Camera Confidence Threshold: {confidenceThreshold}
                  </Typography>
                  <Slider
                      value={confidenceThreshold}
                      onChange={handleConfidenceChange}
                      min={0.1}
                      max={1.0}
                      step={0.05}
                      marks={[
                          { value: 0.1, label: '0.1' },
                          { value: 0.5, label: '0.5' },
                          { value: 1.0, label: '1.0' },
                      ]}
                      valueLabelDisplay="auto"
                  />
              </Box>
            </CardContent>
          </Card>

          {/* Detailed Results */}
          <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom>Detailed Results</Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Stack spacing={3}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mb: 0.5 }}>
                    <TimeIcon fontSize="small" />
                    <Typography variant="caption">Inference Time</Typography>
                  </Box>
                  <Typography variant="h4" color="secondary.main">
                    {currentResult ? `${currentResult.time}s` : '--'}
                  </Typography>
                </Box>

                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mb: 0.5 }}>
                    <CountIcon fontSize="small" />
                    <Typography variant="caption">Object Count</Typography>
                  </Box>
                  <Typography variant="h5">
                    {currentResult ? currentResult.count : '--'}
                  </Typography>
                </Box>

                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mb: 0.5 }}>
                    <ClassIcon fontSize="small" />
                    <Typography variant="caption">Top Class & Conf</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6" color="primary">
                      {currentResult ? currentResult.topClass : '--'}
                    </Typography>
                    {currentResult && (
                      <Chip label={`${(currentResult.topConf * 100).toFixed(1)}%`} size="small" color="error" />
                    )}
                  </Box>
                </Box>

                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary', mb: 0.5 }}>
                    <CoordsIcon fontSize="small" />
                    <Typography variant="caption">Coordinates (ROI)</Typography>
                  </Box>
                  <Typography fontFamily="monospace" sx={{ bgcolor: 'rgba(255,255,255,0.05)', p: 1, borderRadius: 1 }}>
                    {currentResult 
                      ? (currentResult.box && currentResult.box.length === 4 
                          ? `xmin: ${currentResult.box[0]}  ymin: ${currentResult.box[1]}\nxmax: ${currentResult.box[2]}  ymax: ${currentResult.box[3]}`
                          : (isVideo ? 'Video Sequence (Full Frame)' : 'No ROI available'))
                      : 'Waiting for input...'}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
            
            {/* Bottom Actions */}
            <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <Stack direction="row" spacing={2}>
                <Button 
                  variant="contained" 
                  startIcon={<SaveIcon />} 
                  fullWidth
                  disabled={!currentResult}
                >
                  Save
                </Button>
                <Button 
                  variant="outlined" 
                  color="error"
                  startIcon={<ExitIcon />} 
                  fullWidth
                  onClick={() => {
                      setPreviewSrc(null);
                      setResults([]);
                      setCurrentResult(null);
                  }}
                >
                  Clear
                </Button>
              </Stack>
            </Box>
          </Card>

        </Grid>
      </Grid>
    </Box>
  );
};

export default Testing;
