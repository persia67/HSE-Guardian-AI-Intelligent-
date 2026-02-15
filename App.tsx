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
const MAX_LOGS = 50; // Reduced for performance
const DETECTION_INTERVAL = 1000; // Aim for 1 detection per second per active camera
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
  
  // Refs for stabilizing the AI loop and avoiding stale closures
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const camerasRef = useRef<CameraDevice[]>([]);
  const isProcessingRef = useRef(false);
  const lastAlertTimeRef = useRef<Record<string, number>>({});
  const detectionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    camerasRef.current = cameras;
  }, [cameras]);

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
        overall: Math.max(0, prev.overall - 1.5),
        behavior: detection.type === 'behavior' ? Math.max(0, prev.behavior - 4) : prev.behavior,
        environment: detection.type === 'geofence' ? Math.max(0, prev.environment - 4) : prev.environment
    }));
  }, []);

  useEffect(() => {
    performanceMonitor.start();
    const interval = setInterval(() => {
      const metrics = performanceMonitor.getCurrentMetrics();
      const health = performanceMonitor.getHealthStatus();
      if (metrics) setPerfMetrics({ fps: metrics.fps, memory: metrics.memoryUsage, status: health.status });
    }, 1500);
    
    const loadCoco = async () => {
        try {
            await tf.ready();
            // Optimize TFJS for edge/electron
            tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0); 
            try { await tf.setBackend('webgl'); } catch(e) { console.warn("WebGL Fallback"); }
            
            const loadedNet = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
            setNet(loadedNet);
        } catch(e) { console.error("COCO Load Failed", e); }
    };
    loadCoco();

    return () => { 
      performanceMonitor.stop(); 
      clearInterval(interval);
      if (detectionTimerRef.current) clearTimeout(detectionTimerRef.current);
    };
  }, []);

  // Main Detection Loop - Throttled and decoupled from UI frame
  const runDetection = useCallback(async () => {
    if (!net || isProcessingRef.current) {
        detectionTimerRef.current = window.setTimeout(runDetection, 100);
        return;
    }

    const currentCameras = camerasRef.current;
    const targetCams = currentCameras.filter(c => c.active && c.status === 'online');
    
    if (targetCams.length === 0) {
        detectionTimerRef.current = window.setTimeout(runDetection, 1000);
        return;
    }

    // Pick one camera to process per cycle to spread the load
    const targetCam = selectedCameraId 
        ? targetCams.find(c => c.id === selectedCameraId) || targetCams[0]
        : targetCams[0];

    const videoEl = videoRefs.current.get(targetCam.id);
    if (videoEl && videoEl.readyState === 4 && !videoEl.paused) {
        try {
            isProcessingRef.current = true;
            const predictions = await net.detect(videoEl);
            const now = Date.now();
            
            predictions.forEach(prediction => {
               if (prediction.score < 0.65) return;
               let detectionType: Detection['type'] | null = null;
               let description = '';
               let severity: Detection['severity'] = 'low';
               
               if (prediction.class === 'person') { detectionType = 'person'; description = 'Person Detected'; severity = 'medium'; } 
               else if (prediction.class === 'cell phone') { detectionType = 'behavior'; description = 'Distracted Behavior'; severity = 'high'; }
               else if (['truck', 'car', 'bus'].includes(prediction.class)) { detectionType = 'geofence'; description = `Vehicle Entry: ${prediction.class}`; severity = 'high'; }

               if (detectionType) {
                  const cooldownKey = `${targetCam.id}-${detectionType}`;
                  if (now - (lastAlertTimeRef.current[cooldownKey] || 0) > 8000) {
                      lastAlertTimeRef.current[cooldownKey] = now;
                      addDetection({ id: `${targetCam.id}-${now}-${detectionType}`, type: detectionType, severity, description: `${description} (${Math.round(prediction.score * 100)}%)`, timestamp: now, cameraId: targetCam.id });
                      setCameras(prev => prev.map(cam => cam.id === targetCam.id ? { ...cam, riskScore: Math.min(100, cam.riskScore + 25), lastDetection: now } : cam));
                  }
               }
            });
        } catch (e) { console.warn("Inference error", e); }
        finally { isProcessingRef.current = false; }
    }

    detectionTimerRef.current = window.setTimeout(runDetection, DETECTION_INTERVAL);
  }, [net, selectedCameraId, addDetection]);

  useEffect(() => {
    if (net) runDetection();
  }, [net, runDetection]);

  const filteredCameras = useMemo(() => filterRisk === 'all' ? cameras : cameras.filter(cam => cam.riskScore > 30), [cameras, filterRisk]);
  const totalPages = Math.max(1, Math.ceil(filteredCameras.length / CAMERAS_PER_PAGE));
  const visibleCameras = useMemo(() => filteredCameras.slice(currentPage * CAMERAS_PER_PAGE, currentPage * CAMERAS_PER_PAGE + CAMERAS_PER_PAGE), [filteredCameras, currentPage]);
  const activeCamera = useMemo(() => cameras.find(c => c.id === selectedCameraId) || cameras[0], [cameras, selectedCameraId]);

  const toggleOfflineAI = async (enable: boolean) => {
    if (enable && !localAi.isReady()) {
      setOfflineAI(prev => ({ ...prev, isLoading: true, progress: 0, loadingText: 'Warming up GPU...' }));
      try {
        await localAi.initialize((progress, text) => {
            setOfflineAI(prev => ({ ...prev, progress, loadingText: text }));
        });
        setOfflineAI(prev => ({ ...prev, isModelLoaded: true, isEnabled: true, isLoading: false }));
      } catch (err) {
        setOfflineAI(prev => ({ ...prev, isLoading: false, loadingText: 'GPU Incompatible' }));
        alert("WebGPU failed. Ensure your hardware supports it.");
      }
    } else {
        setOfflineAI(prev => ({ ...prev, isEnabled: enable }));
    }
  };

  const startCamera = useCallback(async (cameraId: string) => {
    try {
      const camera = camerasRef.current.find(c => c.id === cameraId);
      if (!camera) return;
      if (camera.connectionType === 'network') {
        setCameras(prev => prev.map(cam => cam.id === cameraId ? { ...cam, active: true, status: 'online' } : cam));
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: CAMERA_WIDTH, height: CAMERA_HEIGHT, frameRate: 15, deviceId: camera.deviceId ? { exact: camera.deviceId } : undefined } 
      });
      setCameras(prev => prev.map(cam => cam.id === cameraId ? { ...cam, active: true, stream, status: 'online' } : cam));
      const video = videoRefs.current.get(cameraId);
      if (video) { video.srcObject = stream; video.play().catch(e => console.error(e)); }
    } catch (error) {
      setCameras(prev => prev.map(cam => cam.id === cameraId ? { ...cam, status: 'no-hardware', active: false } : cam));
    }
  }, []);

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
  const stopAllCameras = useCallback(() => { camerasRef.current.filter(c => c.active).forEach(c => stopCamera(c.id)); }, [stopCamera]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCameras(prev => {
        const hasRisk = prev.some(c => c.riskScore > 0);
        if (!hasRisk) return prev;
        return prev.map(cam => ({ ...cam, riskScore: Math.max(0, cam.riskScore - 1.5) }));
      });
      setSafetyScore(prev => ({ 
        ...prev, 
        overall: Math.min(100, prev.overall + 0.3), 
        behavior: Math.min(100, prev.behavior + 0.3), 
        environment: Math.min(100, prev.environment + 0.3) 
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const generateAIReport = async () => {
    if (!localAi.isReady()) { alert("Load AI Core first."); setIsConfigOpen(true); return; }
    setIsReportOpen(true); setIsGeneratingReport(true); setReportContent("");
    try {
      const logs = detections.slice(0, 15).map(d => `- ${d.type}: ${d.description}`).join('\n');
      const report = await localAi.generateText(`Summary safety report for the following events:\n${logs}`);
      setReportContent(report);
    } catch (error: any) { setReportContent(`Error: ${error.message}`); }
    finally { setIsGeneratingReport(false); }
  };

  const getSeverityColor = (severity: string) => severity === 'critical' || severity === 'high' ? theme.colors.danger : severity === 'medium' ? theme.colors.warning : theme.colors.textMuted;

  return (
    <AuthGuard>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: theme.colors.bg, color: theme.colors.text }}>
        <header style={{ height: 64, borderBottom: `1px solid ${theme.colors.border}`, backgroundColor: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(12px)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ backgroundColor: 'rgba(37, 99, 235, 0.2)', padding: 8, borderRadius: 8, border: `1px solid ${theme.colors.primaryLight}` }}>
              <Shield size={24} color={theme.colors.primary} />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 'bold', margin: 0 }}>HSE Guardian <span style={{ color: theme.colors.primary }}>AI</span></h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: theme.colors.textMuted }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: perfMetrics.status === 'critical' ? theme.colors.danger : theme.colors.success }}>
                  <Activity size={12} /> {perfMetrics.status === 'healthy' ? 'Core Stable' : 'Load High'}
                </span>
                <span style={{ width: 4, height: 4, backgroundColor: theme.colors.textMuted, borderRadius: '50%' }}></span>
                <span>FPS: {perfMetrics.fps}</span>
              </div>
            </div>
          </div>
          <button onClick={() => setIsConfigOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', backgroundColor: theme.colors.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 'bold', cursor: 'pointer' }}>
            <Settings2 size={16} /> System Config
          </button>
        </header>

        <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ height: 56, borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
               <button onClick={() => setViewMode(viewMode === 'grid' ? 'single' : 'grid')} style={{ padding: 8, background: 'none', border: 'none', color: theme.colors.textMuted, cursor: 'pointer' }}>
                 {viewMode === 'grid' ? <Maximize2 size={20} /> : <Grid size={20} />}
               </button>
               <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                 <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                 <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                   <button onClick={startAllCamerasInPage} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', backgroundColor: theme.colors.successBg, color: theme.colors.success, border: `1px solid ${theme.colors.success}44`, borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}><Play size={16} /> Deploy</button>
                   <button onClick={stopAllCameras} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', backgroundColor: theme.colors.dangerBg, color: theme.colors.danger, border: `1px solid ${theme.colors.danger}44`, borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}><Pause size={16} /> Shutdown</button>
                 </div>
               </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {viewMode === 'grid' ? <CameraGrid cameras={cameras} visibleCameras={visibleCameras} onCameraSelect={handleCameraSelect} selectedCamera={selectedCameraId || ''} /> : <SingleCameraView camera={activeCamera} onBack={() => setViewMode('grid')} onAnalyze={() => {}} />}
            </div>
          </div>

          <aside style={{ width: 320, borderLeft: `1px solid ${theme.colors.border}`, backgroundColor: theme.colors.panel, display: 'flex', flexDirection: 'column' }}>
             <div style={{ padding: 20, borderBottom: `1px solid ${theme.colors.border}` }}>
               <GaugeChart value={safetyScore.overall} label="Safety Score" color={safetyScore.overall > 80 ? theme.colors.success : theme.colors.warning} />
               <div style={{ marginTop: 20 }}><BarChart data={detectionStats} /></div>
             </div>
            <div style={{ padding: 16, borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textMuted, textTransform: 'uppercase' }}>Recent Alerts</h2>
              <button onClick={generateAIReport} style={{ fontSize: 10, backgroundColor: theme.colors.border, color: '#fff', padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer' }}>Generate PDF</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {detections.map(det => (
                <div key={det.id} style={{ padding: 10, borderRadius: 8, border: `1px solid ${theme.colors.border}`, backgroundColor: 'rgba(30, 41, 59, 0.3)', borderLeft: `3px solid ${getSeverityColor(det.severity)}` }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{det.description}</div>
                  <div style={{ fontSize: 11, opacity: 0.5 }}>{new Date(det.timestamp).toLocaleTimeString()} • {det.type}</div>
                </div>
              ))}
            </div>
          </aside>
        </main>

        {isReportOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
            <div style={{ backgroundColor: theme.colors.panel, border: `1px solid ${theme.colors.border}`, width: '100%', maxWidth: 500, borderRadius: 12, padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>Safety Summary</h3>
                <button onClick={() => setIsReportOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{isGeneratingReport ? <Loader2 className="animate-spin" /> : reportContent}</div>
            </div>
          </div>
        )}

        {isConfigOpen && <CameraSetupModal cameras={cameras} onUpdateCameras={setCameras} onClose={() => setIsConfigOpen(false)} offlineAI={offlineAI} onToggleOfflineAI={toggleOfflineAI} />}

        <div style={{ display: 'none' }}>
          {cameras.map(cam => <video key={`p-${cam.id}`} ref={el => { if (el) videoRefs.current.set(cam.id, el); }} muted playsInline autoPlay width={CAMERA_WIDTH} height={CAMERA_HEIGHT} />)}
        </div>
      </div>
    </AuthGuard>
  );
}
