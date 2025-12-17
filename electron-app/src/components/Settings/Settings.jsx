import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  TextField, 
  Button, 
  Stack, 
  Divider, 
  Slider, 
  FormControlLabel, 
  Switch, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  InputAdornment,
  Alert,
  Snackbar
} from '@mui/material';
import { 
  Save as SaveIcon, 
  FolderOpen as FolderIcon,
  Terminal as TerminalIcon,
  Dataset as DataIcon,
  Tune as TuneIcon,
  Language as LanguageIcon,
  Computer as ComputerIcon
} from '@mui/icons-material';

const Settings = () => {
  const [settings, setSettings] = useState({
    pythonPath: '',
    datasetPath: '',
    defaultConf: 0.25,
    useGpu: true,
    language: 'en'
  });
  
  const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });

  // Load settings on mount
  useEffect(() => {
    const load = async () => {
        try {
            const stored = await window.electronAPI.getSettings();
            if (stored) {
                setSettings(prev => ({ ...prev, ...stored }));
            }
        } catch (e) {
            console.error("Failed to load settings:", e);
        }
    };
    load();
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleBrowsePython = async () => {
      const path = await window.electronAPI.openFileDialog(); // Reuse existing file dialog for now, or add specific one
      // Ideally we want to select an executable, filters might need adjustment in backend
      if (path) handleChange('pythonPath', path);
  };

  const handleBrowseDataset = async () => {
      const path = await window.electronAPI.openFileDialog(); // Assuming .yaml is selectable
      if (path) handleChange('datasetPath', path);
  };

  const handleSave = async () => {
      try {
          await window.electronAPI.saveSettings(settings);
          setToast({ open: true, message: 'Settings saved successfully!', severity: 'success' });
      } catch (e) {
          console.error("Save failed:", e);
          setToast({ open: true, message: 'Failed to save settings.', severity: 'error' });
      }
  };

  return (
    <Box sx={{ p: 0, height: '100%', overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Settings
        </Typography>
        <Button 
          variant="contained" 
          size="large"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          sx={{ 
            background: 'linear-gradient(60deg, #66bb6a, #43a047)',
            boxShadow: '0 4px 20px 0 rgba(76, 175, 80, 0.14)'
          }}
        >
          Save Settings
        </Button>
      </Box>

      <Grid container spacing={3}>
        
        {/* Section A: Environment */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <TerminalIcon color="primary" /> Environment Configuration
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Python Interpreter Path</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField 
                      fullWidth 
                      size="small" 
                      value={settings.pythonPath} 
                      onChange={(e) => handleChange('pythonPath', e.target.value)}
                      placeholder="e.g. C:\Anaconda3\envs\yolo\python.exe"
                      InputProps={{
                        startAdornment: <InputAdornment position="start"><TerminalIcon fontSize="small"/></InputAdornment>,
                      }}
                    />
                    <Button variant="outlined" onClick={handleBrowsePython} sx={{ minWidth: 100 }}>
                      Browse
                    </Button>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    Path to the Python executable used for training and inference.
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Dataset Configuration (data.yaml)</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField 
                      fullWidth 
                      size="small" 
                      value={settings.datasetPath} 
                      onChange={(e) => handleChange('datasetPath', e.target.value)}
                      placeholder="e.g. C:\Projects\PestData\data.yaml"
                      InputProps={{
                        startAdornment: <InputAdornment position="start"><DataIcon fontSize="small"/></InputAdornment>,
                      }}
                    />
                    <Button variant="outlined" onClick={handleBrowseDataset} sx={{ minWidth: 100 }}>
                      Browse
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Section B: Inference Defaults */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <TuneIcon color="primary" /> Inference Defaults
              </Typography>
              
              <Stack spacing={4}>
                <Box>
                  <Typography gutterBottom>Default Confidence Threshold: {settings.defaultConf}</Typography>
                  <Slider
                    value={settings.defaultConf}
                    onChange={(e, v) => handleChange('defaultConf', v)}
                    step={0.05}
                    min={0.0}
                    max={1.0}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 0, label: '0.0' },
                      { value: 0.25, label: '0.25' },
                      { value: 0.5, label: '0.5' },
                      { value: 1.0, label: '1.0' },
                    ]}
                  />
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ComputerIcon color="textSecondary" />
                    <Box>
                        <Typography>Hardware Acceleration</Typography>
                        <Typography variant="caption" color="text.secondary">Use GPU (CUDA) if available</Typography>
                    </Box>
                  </Box>
                  <Switch 
                    checked={settings.useGpu}
                    onChange={(e) => handleChange('useGpu', e.target.checked)}
                    color="primary"
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Section C: App Settings */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <LanguageIcon color="primary" /> App Settings
              </Typography>
              
              <FormControl fullWidth>
                <InputLabel>Language / 语言</InputLabel>
                <Select
                  value={settings.language}
                  label="Language / 语言"
                  onChange={(e) => handleChange('language', e.target.value)}
                >
                  <MenuItem value="en">English (US)</MenuItem>
                  <MenuItem value="zh">简体中文 (Chinese)</MenuItem>
                </Select>
              </FormControl>
              
              <Alert severity="info" sx={{ mt: 3, bgcolor: 'rgba(2, 136, 209, 0.1)' }}>
                Restart application to apply language changes fully.
              </Alert>
            </CardContent>
          </Card>
        </Grid>

      </Grid>

      <Snackbar 
        open={toast.open} 
        autoHideDuration={3000} 
        onClose={() => setToast(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={toast.severity} onClose={() => setToast(prev => ({ ...prev, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Settings;
