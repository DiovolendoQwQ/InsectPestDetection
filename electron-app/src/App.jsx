import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  CssBaseline, 
  Drawer, 
  AppBar, 
  Toolbar, 
  List, 
  Typography, 
  Divider, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText,
  Container,
  Paper,
  Grid,
  Button,
  TextField,
  LinearProgress,
  Card,
  CardContent,
  ThemeProvider,
  createTheme,
  Avatar,
  Stack,
  Chip,
  IconButton,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  ModelTraining as TrainingIcon,
  Science as TestingIcon,
  Settings as SettingsIcon,
  Memory as MemoryIcon,
  Storage as StorageIcon,
  GraphicEq as GpuIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  BugReport as BugIcon,
  Terminal as TerminalIcon,
  Restore as RestoreIcon,
  Menu as MenuIcon
} from '@mui/icons-material';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import Testing from './components/Testing/Testing';

const drawerWidth = 260;

// Create a custom dark theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00bcd4', // Cyan
    },
    secondary: {
      main: '#f50057', // Pink
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        },
      },
    },
  },
});

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const [stats, setStats] = useState({
    cpuLoad: 0,
    memUsed: 0,
    memTotal: 0,
    gpu: null
  });
  
  // Training State
  const [isTraining, setIsTraining] = useState(false);
  const [epochs, setEpochs] = useState(150);
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);

  // Initial Static Data Load
  useEffect(() => {
    const loadStatic = async () => {
      const s = await window.electronAPI.getStaticStats();
      if (s) {
        setStats(prev => ({ ...prev, ...s }));
      }
    };
    loadStatic();
  }, []);

  // Dynamic Data Polling
  useEffect(() => {
    if (activeTab !== 'dashboard') return; // Stop polling if not on dashboard

    const interval = setInterval(async () => {
      const s = await window.electronAPI.getDynamicStats();
      if (s) {
        setStats(prev => ({ ...prev, ...s }));
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Terminal Component defined outside App to prevent re-creation
  const TerminalView = ({ onInit, onDispose }) => {
    const termRef = useRef(null);
    const xtermInstance = useRef(null);
    const fitAddonInstance = useRef(null);
    const resizeTimeoutRef = useRef(null);
    const fitRafRef = useRef(null);
  
    useEffect(() => {
      if (!termRef.current) return;
  
      // Initialize xterm
      xtermInstance.current = new Terminal({
        rows: 24,
        cols: 80,
        theme: { 
          background: '#151515',
          foreground: '#e0e0e0',
          cursor: '#00bcd4'
        },
        fontFamily: '"Fira Code", monospace',
        fontSize: 14,
        allowProposedApi: true
      });
      
      fitAddonInstance.current = new FitAddon();
      xtermInstance.current.loadAddon(fitAddonInstance.current);
      xtermInstance.current.open(termRef.current);
      
      const fit = () => {
        // xtermInstance.current.element ensures terminal is actually mounted in DOM
        if (!xtermInstance.current || !xtermInstance.current.element || !fitAddonInstance.current) return;
        
        try {
            // Only fit if dimensions are valid
            if (termRef.current && termRef.current.clientWidth > 0 && termRef.current.clientHeight > 0) {
                fitAddonInstance.current.fit();
            }
        } catch (e) {
            // Ignore errors during resize/fit
        }
      };
      
      // Initial fit
      fitRafRef.current = requestAnimationFrame(() => fit());
      // Backup fit
      resizeTimeoutRef.current = setTimeout(() => fit(), 100);
  
      // Pass instances back to parent
      if (onInit) {
        onInit(xtermInstance.current, fitAddonInstance.current);
      }
      
      const handleResize = () => {
          if (fitRafRef.current) cancelAnimationFrame(fitRafRef.current);
          fitRafRef.current = requestAnimationFrame(() => fit());
      };
      window.addEventListener('resize', handleResize);
  
      return () => {
        window.removeEventListener('resize', handleResize);
        if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current);
        if (fitRafRef.current) cancelAnimationFrame(fitRafRef.current);
        
        // Notify parent about disposal
        if (onDispose) onDispose();
  
        // Dispose xterm
        try {
          xtermInstance.current?.dispose();
        } catch(e) {
          // Ignore dispose errors
        }
        xtermInstance.current = null;
        fitAddonInstance.current = null;
      };
    }, []);
  
    return <div ref={termRef} style={{ width: '100%', height: '100%' }} />;
  };

  useEffect(() => {
    // Listener for logs is global, but we only write if xterm is ready
    const logHandler = (log) => {
        // Double check if xtermRef is valid and not disposed (though we can't easily check isDisposed)
        // If the ref is null (cleared by onDispose), we skip.
        if (xtermRef.current) {
             try {
                xtermRef.current.write(log.replace(/\n/g, '\r\n'));
             } catch (e) {
                 // If write fails, it might be disposed. Clear the ref.
                 console.warn("Write to xterm failed:", e);
                 xtermRef.current = null;
             }
        }
    };

    const finishHandler = (code) => {
         setIsTraining(false);
         if (xtermRef.current) {
            if (code === 0) {
                xtermRef.current.writeln('\x1b[32m\r\n>>> Training Completed Successfully!\x1b[0m');
            } else {
                xtermRef.current.writeln(`\x1b[31m\r\n>>> Training Failed with exit code ${code}. Check logs above.\x1b[0m`);
            }
         }
    };

    const removeLogListener = window.electronAPI.onTrainingLog(logHandler);
    const removeFinishListener = window.electronAPI.onTrainingFinished(finishHandler);
    
    return () => {
        // Cleanup listeners if needed, though Electron API usually handles this well
        // removeLogListener(); 
        // removeFinishListener();
    };
  }, []);

  const handleTerminalInit = (terminal, fitAddon) => {
      xtermRef.current = terminal;
      fitAddonRef.current = fitAddon;
  };

  const handleTerminalDispose = () => {
      xtermRef.current = null;
      fitAddonRef.current = null;
  };

  const startTraining = () => {
    setIsTraining(true);
    xtermRef.current?.clear();
    xtermRef.current?.writeln('\x1b[36m>>> Initializing Training Session...\x1b[0m');
    
    // Path will be handled by the backend (main.js) via .env or system environment
    const pythonPath = null; 
    
    // Since we set cwd to project root in main.js, the script path is relative to root
    const scriptPath = 'src/train.py'; 
    
    window.electronAPI.startTraining({
      pythonPath,
      scriptPath, 
      params: { epochs }
    });
  };

  const resumeTraining = () => {
    setIsTraining(true);
    xtermRef.current?.clear();
    xtermRef.current?.writeln('\x1b[36m>>> Resuming Training Session...\x1b[0m');
    
    const pythonPath = null; 
    const scriptPath = 'src/resume_train.py'; 
    
    window.electronAPI.startTraining({
      pythonPath,
      scriptPath, 
      params: { epochs }
    });
  };

  const stopTraining = () => {
    window.electronAPI.stopTraining();
    setIsTraining(false);
    xtermRef.current?.writeln('\x1b[31m\r\n>>> Training stopped by user.\x1b[0m');
  };

  // Helper for Status Cards
  const StatCard = ({ title, value, subtext, icon, color, progress }) => (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
      <Box 
        sx={{
          position: 'absolute',
          top: -20,
          left: 20,
          width: 60,
          height: 60,
          borderRadius: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: color,
          boxShadow: '0 4px 20px 0 rgba(0,0,0,.14), 0 7px 10px -5px rgba(0,0,0,.4)'
        }}
      >
        {icon}
      </Box>
      <CardContent sx={{ pt: 5, textAlign: 'right' }}>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h4" component="div" sx={{ mb: 1 }}>
          {value}
        </Typography>
        {progress !== undefined && (
          <Box sx={{ mt: 2 }}>
             <LinearProgress 
                variant="determinate" 
                value={progress} 
                sx={{ 
                  height: 6, 
                  borderRadius: 5,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '& .MuiLinearProgress-bar': { backgroundColor: color }
                }} 
             />
          </Box>
        )}
        <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
          {subtext}
        </Typography>
      </CardContent>
    </Card>
  );

  const drawerContent = (
    <>
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
          <BugIcon />
        </Avatar>
        <Box>
          <Typography variant="subtitle1" fontWeight="bold">Pest Detect AI</Typography>
          <Typography variant="caption" color="textSecondary">v1.0.0 Pro</Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
      <Box sx={{ overflow: 'auto', mt: 2 }}>
        <List>
          {['Dashboard', 'Training', 'Testing', 'Settings'].map((text, index) => {
            const isActive = activeTab === text.toLowerCase();
            const icons = [<DashboardIcon />, <TrainingIcon />, <TestingIcon />, <SettingsIcon />];
            
            return (
              <ListItem key={text} disablePadding sx={{ mb: 1, px: 2 }}>
                <ListItemButton 
                  onClick={() => {
                    setActiveTab(text.toLowerCase());
                    setMobileOpen(false);
                  }} 
                  selected={isActive}
                  sx={{
                    borderRadius: 2,
                    '&.Mui-selected': {
                      bgcolor: 'rgba(0, 188, 212, 0.15)',
                      '&:hover': { bgcolor: 'rgba(0, 188, 212, 0.25)' },
                      borderLeft: '4px solid #00bcd4'
                    }
                  }}
                >
                  <ListItemIcon sx={{ color: isActive ? 'primary.main' : 'inherit' }}>
                    {icons[index]}
                  </ListItemIcon>
                  <ListItemText 
                    primary={text} 
                    primaryTypographyProps={{ 
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'primary.main' : 'inherit'
                    }} 
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </>
  );

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ display: 'flex', bgcolor: 'background.default', minHeight: '100vh' }}>
        <CssBaseline />
        
        {/* Mobile Toggle Button */}
        <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' }, position: 'fixed', top: 16, left: 16, zIndex: 1200 }}
        >
            <MenuIcon />
        </IconButton>

        {/* Sidebar - Mobile */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawerContent}
        </Drawer>

        {/* Sidebar - Desktop */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            width: drawerWidth,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: { 
              width: drawerWidth, 
              boxSizing: 'border-box',
              borderRight: '1px solid rgba(255,255,255,0.05)'
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>

        {/* Main Content */}
        <Box component="main" sx={{ flexGrow: 1, p: 4, pt: 5 }}>
          
          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <Box>
              <Typography variant="h4" sx={{ mb: 4, fontWeight: 700 }}>
                System Overview
              </Typography>
              <Grid container spacing={4}>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <StatCard 
                    title="CPU Usage"
                    value={stats ? `${stats.cpuLoad.toFixed(1)}%` : '...'}
                    subtext="8 Cores Active"
                    progress={stats ? stats.cpuLoad : 0}
                    color="linear-gradient(60deg, #26c6da, #00acc1)"
                    icon={<MemoryIcon sx={{ color: '#fff' }} />}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                  <StatCard 
                    title="Memory Usage"
                    value={stats ? `${(stats.memUsed / 1024 / 1024 / 1024).toFixed(1)} GB` : '...'}
                    subtext={stats ? `of ${(stats.memTotal / 1024 / 1024 / 1024).toFixed(1)} GB Total` : '...'}
                    progress={stats ? (stats.memUsed / stats.memTotal) * 100 : 0}
                    color="linear-gradient(60deg, #66bb6a, #43a047)"
                    icon={<StorageIcon sx={{ color: '#fff' }} />}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 12, md: 4 }}>
                  <StatCard 
                    title="GPU Status"
                    value={stats && stats.gpu ? "Active" : "N/A"}
                    subtext={stats && stats.gpu ? stats.gpu.model : 'No GPU Detected'}
                    progress={100} // Placeholder for GPU load if available
                    color="linear-gradient(60deg, #ef5350, #e53935)"
                    icon={<GpuIcon sx={{ color: '#fff' }} />}
                  />
                </Grid>
                
                {/* Placeholder for Charts */}
                <Grid size={{ xs: 12 }}>
                  <Card sx={{ 
                    p: 3, 
                    height: { xs: 300, md: 400, lg: 500 }, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    bgcolor: 'rgba(255,255,255,0.02)' 
                  }}>
                    <Typography color="textSecondary">Real-time Performance Charts (Coming Soon)</Typography>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* TRAINING */}
          {activeTab === 'training' && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  Model Training
                </Typography>
                {isTraining && (
                  <Chip 
                    icon={<TerminalIcon />} 
                    label="Training in Progress..." 
                    color="warning" 
                    variant="outlined" 
                    sx={{ borderRadius: 1 }}
                  />
                )}
              </Box>
              
              <Grid container spacing={3}>
                {/* Configuration Panel */}
                <Grid size={{ xs: 12, md: 3 }}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent sx={{ p: 3 }}>
                      <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                        Configuration
                      </Typography>
                      <Stack spacing={3}>
                        <TextField 
                          fullWidth 
                          label="Epochs" 
                          type="number" 
                          value={epochs} 
                          onChange={(e) => setEpochs(e.target.value)}
                          variant="outlined"
                          helperText="Number of full passes through the dataset"
                        />
                        <TextField 
                          fullWidth 
                          label="Batch Size" 
                          defaultValue={16}
                          variant="outlined"
                          helperText="Number of samples per gradient update"
                        />
                        <TextField 
                          fullWidth 
                          label="Learning Rate" 
                          defaultValue={0.01}
                          variant="outlined"
                        />
                        
                        <Divider sx={{ my: 2 }} />
                        
                        {!isTraining ? (
                          <>
                            <Button 
                              variant="contained" 
                              size="large"
                              startIcon={<PlayIcon />}
                              onClick={startTraining}
                              sx={{ 
                                background: 'linear-gradient(60deg, #26c6da, #00acc1)',
                                boxShadow: '0 4px 20px 0 rgba(0, 188, 212, 0.14)'
                              }}
                            >
                              Start Training
                            </Button>
                            
                            <Button 
                              variant="outlined" 
                              size="large"
                              startIcon={<RestoreIcon />}
                              onClick={resumeTraining}
                              sx={{ 
                                borderColor: 'rgba(255,255,255,0.3)',
                                color: 'rgba(255,255,255,0.7)',
                                '&:hover': {
                                  borderColor: '#00bcd4',
                                  color: '#00bcd4',
                                  background: 'rgba(0, 188, 212, 0.05)'
                                }
                              }}
                            >
                              Resume Training
                            </Button>
                          </>
                        ) : (
                          <Button 
                            variant="contained" 
                            color="error" 
                            size="large"
                            startIcon={<StopIcon />}
                            onClick={stopTraining}
                          >
                            Stop Training
                          </Button>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Logs Panel */}
                <Grid size={{ xs: 12, md: 9 }}>
                  <Card sx={{ 
                    height: { xs: '400px', md: '600px', lg: '700px' }, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    bgcolor: '#151515' 
                  }}>
                    <Box sx={{ p: 1.5, borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TerminalIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                      <Typography variant="caption" color="textSecondary" fontFamily="monospace">
                        TERMINAL OUTPUT
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, p: 1, overflow: 'hidden', position: 'relative' }}>
                      <TerminalView onInit={handleTerminalInit} onDispose={handleTerminalDispose} />
                    </Box>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}

          {/* TESTING */}
          {activeTab === 'testing' && <Testing />}
          
          {/* PLACEHOLDERS */}
          {activeTab === 'settings' && (
             <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 10, opacity: 0.5 }}>
               <SettingsIcon sx={{ fontSize: 60, mb: 2 }} />
               <Typography variant="h5">Settings Module</Typography>
               <Typography>This feature will be available in the next update.</Typography>
             </Box>
          )}

        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
