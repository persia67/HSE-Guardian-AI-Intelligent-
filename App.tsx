import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Shield, Play, Pause, Grid, Maximize2, AlertTriangle, Activity, CheckCircle2, FileText, X, Loader2, Settings2, WifiOff, Camera, Sparkles, ScanEye } from './components/Icons';
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

import { CameraGrid } from './components/CameraGrid';
import { Pagination } from './components/Pagination';
import { SingleCameraView } from './components/SingleCameraView';
import { AuthGuard } from './components/AuthGuard';
import { CameraSetupModal } from './components/CameraSetupModal';
import { GaugeChart, BarChart } from './components/CssCharts';
import { Detection, CameraDevice, SafetyScore, OfflineAIState } from './types';
import { performanceMonitor } from './utils/performanceMonitor';
import { theme } from './theme';
import { localAi } from './services/LocalAiService';

// Constants
const MAX_LOGS = 100;
const FRAME_SKIP = 15;
const CAMERA_WIDTH = 320;
const CAMERA_HEIGHT = 240;
const CAMERAS_PER_PAGE = 9;

export default function HSEGuardianAI() {
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [safetyScore, setSafetyScore] = useState<SafetyScore>({ overall: 100, ppe: 100, behavior: 100, environment: 100 });
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid');
  const [filterRisk, setFilterRisk] = useState<'all' | 'high'>('all');
  
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportContent, setReportContent] = useState("");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  const [isVideoAnalysisOpen, setIsVideoAnalysisOpen] = useState(false);
  const [videoAnalysisContent, setVideoAnalysisContent] = useState("");
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  const [offlineAI, setOfflineAI] = useState<OfflineAIState>({ 
    isEnabled: false, 
    isModelLoaded: false, 
    isLoading: false, 
    modelName: 'Phi-3.5 Vision',
    progress: 0,
    loadingText: '' 
  });
  
  const [net, setNet] = useState<cocoSsd.ObjectDetection | null>(null);
  
  const [perfMetrics, setPerfMetrics] = useState({ fps: 0, memory: 0, status: 'healthy' as 'healthy' | 'warning' | 'critical' });
  
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const frameCountRef = useRef(0);
  const lastAlertTimeRef = useRef<Record<string, number>>({});

  // Detection Statistics for Charts
  const detectionStats = useMemo(() => {
    const counts = { person: 0, behavior: 0, geofence: 0, ppe: 0 };
    detections.forEach(d => {
      if (d.type in counts) counts[d.type as keyof typeof counts]++;
    });
    return [
      { label: 'Person', value: counts.person, color: theme.colors.info },
      { label: 'Unsafe Act', value: counts.behavior, color: theme.colors.warning },
      { label: 'Restricted', value: counts.geofence, color: theme.colors.danger },
    ];
  }, [detections]);

  const addDetection = useCallback((detection: Detection) => {
    setDetections(prev => {
      const updated = [detection, ...prev];
      return updated.slice(0, MAX_LOGS);
    });
    setSafetyScore(prev => ({
        ...prev,
        overall: Math.max(0, prev.overall - 2),
        behavior: detection.type === 'behavior' ? Math.max(0, prev.behavior - 5) : prev.behavior,
        environment: detection.type === 'geofence' ? Math.max(0, prev.environment - 5) : prev.environment
    }));
  }, []);

  useEffect(() => {
    performanceMonitor.start();
    const interval = setInterval(() => {
      const metrics = performanceMonitor.getCurrentMetrics();
      const health = performanceMonitor.getHealthStatus();
      if (metrics) setPerfMetrics({ fps: metrics.fps, memory: metrics.memoryUsage, status: health.status });
    }, 1000);
    
    // Initialize standard COCO-SSD immediately as it's small
    const loadCoco = async () => {
        try {
            await tf.ready();
            const loadedNet = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
            setNet(loadedNet);
        } catch(e) { console.error("COCO Load Failed", e); }
    };
    loadCoco();

    return () => { performanceMonitor.stop(); clearInterval(interval); };
  }, []);

  const filteredCameras = useMemo(() => filterRisk === 'all' ? cameras : cameras.filter(cam => cam.riskScore > 30), [cameras, filterRisk]);
  const totalPages = Math.max(1, Math.ceil(filteredCameras.length / CAMERAS_PER_PAGE));
  const visibleCameras = useMemo(() => filteredCameras.slice(currentPage * CAMERAS_PER_PAGE, currentPage * CAMERAS_PER_PAGE + CAMERAS_PER_PAGE), [filteredCameras, currentPage]);
  const activeCamera = useMemo(() => cameras.find(c => c.id === selectedCameraId) || cameras[0], [cameras, selectedCameraId]);

  const toggleOfflineAI = async (enable: boolean) => {
    if (enable && !localAi.isReady()) {
      setOfflineAI(prev => ({ ...prev, isLoading: true, progress: 0, loadingText: 'Initializing Engine...' }));
      try {
        await localAi.initialize((progress, text) => {
            setOfflineAI(prev => ({ ...prev, progress, loadingText: text }));
        });
        setOfflineAI(prev => ({ ...prev, isModelLoaded: true, isEnabled: true, isLoading: false }));
      } catch (err) {
        setOfflineAI(prev => ({ ...prev, isLoading: false, loadingText: 'Failed to load' }));
        alert("Failed to initialize AI Engine. Check GPU compatibility.");
      }
    } else {
        // Just state toggle, engine remains loaded in memory for performance
        setOfflineAI(prev => ({ ...prev, isEnabled: enable }));
    }
  };

  const startCamera = useCallback(async (cameraId: string) => {
    try {
      const camera = cameras.find(c => c.id === cameraId);
      if (!camera) return;
      if (camera.connectionType === 'network') {
        setCameras(prev => prev.map(cam => cam.id === cameraId ? { ...cam, active: true, status: 'online' } : cam));
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: CAMERA_WIDTH, height: CAMERA_HEIGHT, frameRate: 15, deviceId: camera.deviceId ? { exact: camera.deviceId } : undefined } });
      setCameras(prev => prev.map(cam => cam.id === cameraId ? { ...cam, active: true, stream, status: 'online' } : cam));
      const video = videoRefs.current.get(cameraId);
      if (video) { video.srcObject = stream; video.play().catch(e => console.error(e)); }
    } catch (error) {
      setCameras(prev => prev.map(cam => cam.id === cameraId ? { ...cam, status: 'no-hardware', active: false } : cam));
    }
  }, [cameras]);

  const stopCamera = useCallback((cameraId: string) => {
    setCameras(prev => prev.map(cam => {
      if (cam.id === cameraId && cam.stream) { cam.stream.getTracks().forEach(track => track.stop()); return { ...cam, active: false, stream: undefined, status: 'offline' }; }
      return cam;
    }));
    const video = videoRefs.current.get(cameraId);
    if (video) video.srcObject = null;
  }, []);

  const handleCameraSelect = useCallback((id: string) => { setSelectedCameraId(id); setViewMode('single'); }, []);
  const startAllCamerasInPage = useCallback(async () => { visibleCameras.forEach(c => { if (!c.active && c.status !== 'no-hardware') startCamera(c.id); }); }, [visibleCameras, startCamera]);
  const stopAllCameras = useCallback(() => { cameras.filter(c => c.active).forEach(c => stopCamera(c.id)); }, [cameras, stopCamera]);

  const processFrame = useCallback(async () => {
    if (!net) return;
    frameCountRef.current++;
    if (frameCountRef.current % FRAME_SKIP !== 0) return;

    let targetCameraId: string | null = null;
    if (viewMode === 'single' && selectedCameraId) {
        const cam = cameras.find(c => c.id === selectedCameraId);
        if (cam?.active) targetCameraId = selectedCameraId;
    } else {
        const activeOnPage = visibleCameras.find(c => c.active && c.status === 'online');
        if (activeOnPage) targetCameraId = activeOnPage.id;
    }
    if (!targetCameraId) return;

    const videoEl = videoRefs.current.get(targetCameraId);
    if (videoEl && videoEl.readyState === 4 && !videoEl.paused) {
        try {
            const predictions = await net.detect(videoEl);
            const now = Date.now();
            predictions.forEach(prediction => {
               if (prediction.score < 0.6) return;
               let detectionType: Detection['type'] | null = null;
               let description = '';
               let severity: Detection['severity'] = 'low';
               
               if (prediction.class === 'person') { detectionType = 'person'; description = 'Person Detected'; severity = 'medium'; } 
               else if (prediction.class === 'cell phone') { detectionType = 'behavior'; description = 'Phone Usage'; severity = 'high'; }
               else if (['truck', 'car', 'bus'].includes(prediction.class)) { detectionType = 'geofence'; description = `Vehicle (${prediction.class})`; severity = 'high'; }
               else if (['knife', 'scissors'].includes(prediction.class)) { detectionType = 'behavior'; description = `Sharp Object`; severity = 'medium'; }

               if (detectionType) {
                  const cooldownKey = `${targetCameraId}-${detectionType}`;
                  if (now - (lastAlertTimeRef.current[cooldownKey] || 0) > 5000) {
                      lastAlertTimeRef.current[cooldownKey] = now;
                      addDetection({ id: `${targetCameraId}-${now}-${detectionType}`, type: detectionType, severity, description: `${description} (${Math.round(prediction.score * 100)}%)`, timestamp: now, cameraId: targetCameraId });
                      setCameras(prev => prev.map(cam => cam.id === targetCameraId ? { ...cam, riskScore: Math.min(100, cam.riskScore + 30), lastDetection: now } : cam));
                  }
               }
            });
        } catch (e) { console.warn(e); }
    }
  }, [addDetection, cameras, net, viewMode, selectedCameraId, visibleCameras]);

  useEffect(() => {
    let animationFrame: number;
    const loop = () => { processFrame(); animationFrame = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(animationFrame);
  }, [processFrame]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCameras(prev => prev.map(cam => ({ ...cam, riskScore: Math.max(0, cam.riskScore - 2) })));
      setSafetyScore(prev => ({ ...prev, overall: Math.min(100, prev.overall + 0.5), behavior: Math.min(100, prev.behavior + 0.5), environment: Math.min(100, prev.environment + 0.5) }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const captureFrame = (cameraId: string): string | null => {
    const video = videoRefs.current.get(cameraId);
    if (video && video.readyState >= 2) {
       const canvas = document.createElement('canvas');
       canvas.width = video.videoWidth; canvas.height = video.videoHeight;
       const ctx = canvas.getContext('2d');
       if (ctx) { ctx.drawImage(video, 0, 0, canvas.width, canvas.height); return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]; }
    }
    return null;
  };

  const performVideoAnalysis = async (cameraId: string) => {
    if (!localAi.isReady()) {
        alert("Please load the Local AI Model in System Setup first.");
        setIsConfigOpen(true);
        return;
    }

    setIsVideoAnalysisOpen(true); setIsAnalyzingVideo(true); setVideoAnalysisContent("");
    try {
      const frame = captureFrame(cameraId);
      if (!frame) throw new Error("Could not capture frame.");
      
      const analysis = await localAi.analyzeImage(frame, "Analyze this industrial scene. List any safety hazards, missing PPE, or dangerous activities.");
      setVideoAnalysisContent(analysis);
    } catch (error: any) { 
        setVideoAnalysisContent(`Analysis Failed: ${error.message}`); 
    } finally { 
        setIsAnalyzingVideo(false); 
    }
  };

  const generateAIReport = async () => {
    if (!localAi.isReady()) {
        alert("Please load the Local AI Model in System Setup first.");
        setIsConfigOpen(true);
        return;
    }
    setIsReportOpen(true); setIsGeneratingReport(true); setReportContent("");
    try {
      const realDetections = detections.slice(0, 20);
      if (realDetections.length === 0) { setReportContent("No incidents to report."); setIsGeneratingReport(false); return; }
      const logData = realDetections.map(d => `- [${d.severity.toUpperCase()}] ${d.type}: ${d.description}`).join('\n');
      
      const report = await localAi.generateText(`Write a short executive safety summary based on these recent logs:\n${logData}`);
      setReportContent(report);
    } catch (error: any) { 
        setReportContent(`Failed: ${error.message}`); 
    } finally { 
        setIsGeneratingReport(false); 
    }
  };

  const getSeverityColor = (severity: string) => severity === 'critical' || severity === 'high' ? theme.colors.danger : severity === 'medium' ? theme.colors.warning : theme.colors.textMuted;

  return (
    <AuthGuard>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: theme.colors.bg, color: theme.colors.text }}>
        {/* Header */}
        <header style={{ height: 64, borderBottom: `1px solid ${theme.colors.border}`, backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(12px)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ backgroundColor: 'rgba(37, 99, 235, 0.2)', padding: 8, borderRadius: 8, border: `1px solid ${theme.colors.primaryLight}` }}>
              <Shield size={24} color={theme.colors.primary} />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 'bold', margin: 0 }}>HSE Guardian <span style={{ color: theme.colors.primary }}>AI</span></h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: theme.colors.textMuted }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: perfMetrics.status === 'critical' ? theme.colors.danger : theme.colors.success }}>
                  <Activity size={12} /> {perfMetrics.status === 'healthy' ? 'System Optimized' : 'High Load'}
                </span>
                <span style={{ width: 4, height: 4, backgroundColor: theme.colors.textMuted, borderRadius: '50%' }}></span>
                <span>FPS: {perfMetrics.fps}</span>
                {offlineAI.isModelLoaded ? (
                   <span style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4, color: theme.colors.success, backgroundColor: theme.colors.successBg, padding: '2px 6px', borderRadius: 4, border: `1px solid ${theme.colors.success}33` }}>
                     <CheckCircle2 size={12} /> GPU AI READY
                   </span>
                ) : (
                    <span style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4, color: theme.colors.warning, backgroundColor: theme.colors.warningBg, padding: '2px 6px', borderRadius: 4, border: `1px solid ${theme.colors.warning}33` }}>
                     <WifiOff size={12} /> GPU AI OFFLINE
                   </span>
                )}
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
             <button onClick={() => setIsConfigOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', backgroundColor: theme.colors.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 'bold', cursor: 'pointer' }}>
               <Settings2 size={16} /> System Setup
             </button>
          </div>
        </header>

        <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, backgroundColor: theme.colors.bg }}>
            {/* Toolbar */}
            <div style={{ height: 56, borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                 <button onClick={() => setViewMode(viewMode === 'grid' ? 'single' : 'grid')} disabled={cameras.length === 0} style={{ padding: 8, background: 'none', border: 'none', color: theme.colors.textMuted, cursor: 'pointer' }}>
                   {viewMode === 'grid' ? <Maximize2 size={20} /> : <Grid size={20} />}
                 </button>
               </div>

               <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                 <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                 <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                   <button onClick={startAllCamerasInPage} disabled={cameras.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', backgroundColor: theme.colors.successBg, color: theme.colors.success, border: `1px solid ${theme.colors.success}44`, borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                     <Play size={16} /> Start Active
                   </button>
                   <button onClick={stopAllCameras} disabled={cameras.length === 0} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', backgroundColor: theme.colors.dangerBg, color: theme.colors.danger, border: `1px solid ${theme.colors.danger}44`, borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                     <Pause size={16} /> Stop All
                   </button>
                 </div>
               </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16, position: 'relative' }} className="custom-scrollbar">
              {cameras.length === 0 ? (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: theme.colors.textMuted, opacity: 0.6 }}>
                      <Camera size={80} style={{ marginBottom: 16 }} />
                      <h3 style={{ fontSize: 24, fontWeight: 'bold', color: '#cbd5e1', margin: 0 }}>No Cameras Configured</h3>
                      <p style={{ marginBottom: 24 }}>Please add hardware or network streams.</p>
                      <button onClick={() => setIsConfigOpen(true)} style={{ padding: '8px 24px', backgroundColor: theme.colors.border, color: '#fff', borderRadius: 999, fontWeight: 'bold', border: `1px solid ${theme.colors.textMuted}`, cursor: 'pointer' }}>
                          Open Configuration
                      </button>
                  </div>
              ) : viewMode === 'grid' ? (
                <CameraGrid cameras={cameras} visibleCameras={visibleCameras} onCameraSelect={handleCameraSelect} selectedCamera={selectedCameraId || ''} />
              ) : activeCamera ? (
                <SingleCameraView camera={activeCamera} onBack={() => setViewMode('grid')} onAnalyze={performVideoAnalysis} />
              ) : null}
            </div>
          </div>

          {/* Sidebar */}
          <aside style={{ width: 320, borderLeft: `1px solid ${theme.colors.border}`, backgroundColor: theme.colors.panel, display: 'flex', flexDirection: 'column' }}>
             
             {/* Stats Widget */}
             <div style={{ padding: 16, borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
               <GaugeChart value={safetyScore.overall} label="Safety Score" color={safetyScore.overall > 80 ? theme.colors.success : theme.colors.warning} />
               <div style={{ flex: 1 }}>
                 <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: theme.colors.textMuted }}>DETECTION SUMMARY</div>
                 <BarChart data={detectionStats} />
               </div>
             </div>

            <div style={{ padding: 16, borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 14, fontWeight: 'bold', color: '#f1f5f9', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <AlertTriangle size={16} color={theme.colors.warning} /> Recent Alerts
              </h2>
              <button onClick={generateAIReport} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, backgroundColor: theme.colors.border, color: '#fff', padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer' }}>
                <FileText size={12} /> Log
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }} className="custom-scrollbar">
              {detections.length === 0 ? (
                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, color: theme.colors.textMuted, gap: 8 }}>
                   <CheckCircle2 size={32} style={{ opacity: 0.5 }} />
                   <span style={{ fontSize: 14 }}>Zone Clear</span>
                 </div>
              ) : (
                detections.map(det => {
                  const severityColor = getSeverityColor(det.severity);
                  return (
                    <div key={det.id} onClick={() => handleCameraSelect(det.cameraId)} style={{ padding: 12, borderRadius: 8, border: `1px solid ${theme.colors.border}`, backgroundColor: 'rgba(30, 41, 59, 0.3)', borderLeft: `4px solid ${severityColor}`, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{det.description}</span>
                        <span style={{ fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, backgroundColor: severityColor, color: '#fff' }}>{det.type}</span>
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.6, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Cam: {cameras.find(c => c.id === det.cameraId)?.name}</span>
                        <span>{new Date(det.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </main>

        {/* Modals */}
        {isReportOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}>
            <div style={{ backgroundColor: theme.colors.panel, border: `1px solid ${theme.colors.border}`, width: '100%', maxWidth: 600, borderRadius: 12, display: 'flex', flexDirection: 'column', maxHeight: '85vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 16, borderBottom: `1px solid ${theme.colors.border}` }}>
                <h3 style={{ margin: 0, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}><FileText size={20} color={theme.colors.primary} /> Incident Report (Local AI)</h3>
                <button onClick={() => setIsReportOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ padding: 24, overflowY: 'auto', flex: 1, fontFamily: theme.fonts.mono, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {isGeneratingReport ? <div style={{ textAlign: 'center', padding: 32 }}><Loader2 size={32} color={theme.colors.primary} className="animate-spin" /></div> : reportContent}
              </div>
            </div>
          </div>
        )}

        {isVideoAnalysisOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}>
            <div style={{ backgroundColor: theme.colors.panel, border: `1px solid ${theme.colors.border}`, width: '100%', maxWidth: 600, borderRadius: 12, display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: 16, borderBottom: `1px solid ${theme.colors.border}`, backgroundColor: 'rgba(99, 102, 241, 0.1)' }}>
                <h3 style={{ margin: 0, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8 }}><ScanEye size={20} color={theme.colors.info} /> Video Analysis (Local AI)</h3>
                <button onClick={() => setIsVideoAnalysisOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ padding: 24, overflowY: 'auto', flex: 1, fontFamily: theme.fonts.mono, fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {isAnalyzingVideo ? <div style={{ textAlign: 'center', padding: 32 }}><Sparkles size={32} color={theme.colors.info} className="animate-pulse" /><p>Analyzing with GPU...</p></div> : videoAnalysisContent}
              </div>
            </div>
          </div>
        )}

        {isConfigOpen && <CameraSetupModal cameras={cameras} onUpdateCameras={setCameras} onClose={() => setIsConfigOpen(false)} offlineAI={offlineAI} onToggleOfflineAI={toggleOfflineAI} />}

        <div style={{ display: 'none' }}>
          {cameras.map(cam => <video key={`proc-${cam.id}`} ref={el => { if (el) videoRefs.current.set(cam.id, el); }} muted playsInline autoPlay width={CAMERA_WIDTH} height={CAMERA_HEIGHT} crossOrigin="anonymous" />)}
        </div>
      </div>
    </AuthGuard>
  );
}
