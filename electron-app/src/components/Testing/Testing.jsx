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
  const [results, setResults] = useState([]);
  const [currentResult, setCurrentResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Handlers
  const handleSelectImage = async () => {
    try {
      const filePath = await window.electronAPI.openFileDialog();
      if (!filePath) return;

      // Show loading state or temporary preview
      setLoading(true);
      // For local files, we can display them immediately if we want, 
      // but let's wait for the annotated result or display original first.
      // setPreviewSrc(`file://${filePath}`); // Requires security policy for file://
      
      // Call inference
      const result = await window.electronAPI.runInference(filePath);
      
      setLoading(false);

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
      // We might have multiple detections, but the table structure shows one row per file usually,
      // or we can list all objects. The prompt implies "batch detection history".
      // Let's summarize: Top class or just list the file as one entry.
      
      // Find top class
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

      const newEntry = {
          path: result.image_path,
          class: topClass,
          confidence: topConf,
          box: box,
          // Store full details for "Detailed Results" panel
          fullDetails: result 
      };

      setResults(prev => [...prev, newEntry]);
      
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

  const handleSelectVideo = () => {
    // TODO: Connect to electronAPI.selectFile('video')
  };

  return (
    <Box sx={{ 
      height: 'calc(100vh - 100px)', 
      display: 'flex', 
      flexDirection: 'column',
      bgcolor: 'background.default'
    }}>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 700, color: 'text.primary' }}>
        Inference & Testing
      </Typography>

      <Grid container spacing={3} sx={{ flex: 1 }}>
        
        {/* LEFT PANEL (70%) */}
        <Grid item xs={12} md={8} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
          {/* Upper: Preview Area */}
          <Paper 
            elevation={3} 
            sx={{ 
              flex: 2, 
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
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                 <CircularProgress color="primary" />
                 <Typography color="textSecondary">Running Inference...</Typography>
              </Box>
            ) : previewSrc ? (
              <img 
                src={previewSrc} 
                alt="Preview" 
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} 
              />
            ) : (
              <Box sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                <ImageIcon sx={{ fontSize: 60, mb: 2 }} />
                <Typography>No Image Selected</Typography>
              </Box>
            )}
          </Paper>

          {/* Lower: Data Table */}
          <Paper 
            elevation={3} 
            sx={{ 
              flex: 1, 
              overflow: 'hidden', 
              display: 'flex', 
              flexDirection: 'column',
              borderRadius: 2,
              bgcolor: '#000',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <TableContainer sx={{ maxHeight: '100%' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>File Path</TableCell>
                    <TableCell>Class</TableCell>
                    <TableCell>Confidence</TableCell>
                    <TableCell>Coordinates (x,y,w,h)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.length > 0 ? (
                    results.map((row, index) => (
                      <TableRow key={index} hover>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell sx={{ maxWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row.path}
                        </TableCell>
                        <TableCell>
                           <Chip label={row.class} size="small" color="primary" variant="outlined" />
                        </TableCell>
                        <TableCell>{(row.confidence * 100).toFixed(2)}%</TableCell>
                        <TableCell>{`[${row.box.join(', ')}]`}</TableCell>
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
        <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          
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
                      ? `xmin: ${currentResult.box[0]}  ymin: ${currentResult.box[1]}\nxmax: ${currentResult.box[2]}  ymax: ${currentResult.box[3]}`
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
