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
  CircularProgress
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
  MyLocation as CoordsIcon
} from '@mui/icons-material';

const Testing = () => {
  const [previewSrc, setPreviewSrc] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [results, setResults] = useState([]);
  const [currentResult, setCurrentResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [framesData, setFramesData] = useState([]);
  const videoRef = React.useRef(null);
  const canvasRef = React.useRef(null);

  // Listen for progress and stream
  React.useEffect(() => {
    const handleProgress = (p) => {
        setProgress(p);
    };
    
    // Handle real-time data from video
    const handleData = (data) => {
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
            
            setCurrentResult(prev => ({
                ...prev,
                count: data.total,
                topClass: topClass,
                topConf: 0 // Not applicable for summary
            }));

        } else if (data.summary) {
            // Legacy format fallback (if backend not updated)
            // ... (keep existing logic if needed or remove)
        }
    };

    window.electronAPI.onInferenceProgress(handleProgress);
    window.electronAPI.onInferenceData(handleData);
    
    return () => {
        window.electronAPI.removeProgressListeners();
    };
  }, []);

  // Handle video time update to draw boxes
  const handleTimeUpdate = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !framesData.length) return;

      const ctx = canvas.getContext('2d');
      // Match canvas size to video display size
      if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
          canvas.width = video.clientWidth;
          canvas.height = video.clientHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const currentTime = video.currentTime;
      // Find closest frame data (within 1s as we sampled at 1fps)
      // Since we sample 1fps, time will be 0.0, 1.0, 2.0...
      // We can just round currentTime or find closest.
      
      // Optimization: framesData is sorted by time.
      // Find the frame with time <= currentTime and time > currentTime - 1.0
      // Or simply: find closest time.
      
      const frame = framesData.find(f => Math.abs(f.time - currentTime) < 0.6); // 0.6 tolerance for 1fps

      if (frame && frame.detections) {
          // Scale factor
          // Detection boxes are likely normalized or based on original resolution.
          // The python script returns [x1, y1, x2, y2] in original resolution (imgsz=640 resized internally but mapped back? No, YOLO returns original usually unless resized manually)
          // Wait, predict_interface.py uses model.track() with imgsz=640.
          // The bbox returned by YOLO is usually scaled to the ORIGINAL image size provided to predict().
          // So we need video.videoWidth and video.videoHeight.
          
          const scaleX = canvas.width / video.videoWidth;
          const scaleY = canvas.height / video.videoHeight;

          frame.detections.forEach(det => {
              const [x1, y1, x2, y2] = det.bbox;
              
              const bx = x1 * scaleX;
              const by = y1 * scaleY;
              const bw = (x2 - x1) * scaleX;
              const bh = (y2 - y1) * scaleY;

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
          });
      }
  };

  // Handlers
  const handleSelectImage = async () => {
    try {
      const filePath = await window.electronAPI.openFileDialog();
      if (!filePath) return;

      // Show loading state
      setLoading(true);
      setProgress(0);
      setPreviewSrc(null);
      setFramesData([]);
      setIsVideo(false);
      
      // Call inference
      const result = await window.electronAPI.runInference(filePath);
      
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
      const filePath = await window.electronAPI.openVideoDialog();
      if (!filePath) return;

      setLoading(true);
      setProgress(0);
      
      // Set preview immediately for video
      const videoUrl = `file://${filePath.replace(/\\/g, '/')}`;
      setPreviewSrc(videoUrl);
      setIsVideo(true);
      setFramesData([]);
      setResults([]); // Clear previous results

      const result = await window.electronAPI.runInference(filePath);
      
      setLoading(false);
      setProgress(0);

      if (result.error) {
        console.error("Inference Error:", result.error);
        alert(`Error: ${result.error}`);
        return;
      }

      if (result.is_video && result.frames_data) {
         setFramesData(result.frames_data);
         
         // For video, we DO NOT add a row to the table because it confuses the user (looks like invalid detection).
         // The video results are visualized in real-time on the video player.
         
         // Only update the Detailed Results panel
         setCurrentResult({
            time: result.inference_time,
            count: result.object_count, // Total detections across frames
            topClass: result.top_class,
            topConf: 0,
            box: [] // Video doesn't have a single ROI
         });
      }

    } catch (error) {
       console.error("Video Handler Error:", error);
       setLoading(false);
    }
  };

  return (
    <Box sx={{ 
      height: { xs: 'auto', md: 'calc(100vh - 100px)' }, 
      minHeight: { xs: '100vh', md: 0 },
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
                  startIcon={<CameraIcon />} 
                  fullWidth
                  disabled // Placeholder
                  sx={{ justifyContent: 'flex-start', py: 1.5 }}
                >
                  Open Camera
                </Button>
                <Button 
                  variant="outlined" 
                  startIcon={<FolderIcon />} 
                  fullWidth
                  disabled // Placeholder
                  sx={{ justifyContent: 'flex-start', py: 1.5 }}
                >
                  Batch Folder
                </Button>
              </Stack>
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
