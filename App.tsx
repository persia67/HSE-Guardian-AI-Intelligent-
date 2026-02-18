import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
/* Added ShieldCheck to the imports below to fix the 'Cannot find name' error on line 352 */
import { Shield, Play, Pause, Grid, Maximize2, AlertTriangle, Activity, CheckCircle2, FileText, X, Loader2, Settings2, WifiOff, Camera, Sparkles, ScanEye, Save, Trash2, ShieldCheck } from './components/Icons';
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
const MAX_LOGS = 200; 
const DETECTION_INTERVAL = 1200; 
const STORAGE_KEYS = {
  CAMERAS: 'hse_guardian_cameras',
  DETECTIONS: 'hse_guardian_detections',
  SCORES: 'hse_guardian_scores'
};

export default function HSEGuardianAI() {
  // Persistence Initialization
  const [cameras, setCameras] = useState<CameraDevice[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CAMERAS);
    return saved ? JSON.parse(saved).map((c: any) => ({ ...c, active: false, stream: undefined, status: 'offline' })) : [];
  });
  
  const [detections, setDetections] = useState<Detection[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DETECTIONS);
    return saved ? JSON.parse(saved) : [];
  });

  const [safetyScore, setSafetyScore] = useState<SafetyScore>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SCORES);
    return saved ? JSON.parse(saved) : { overall: 100, ppe: 100, behavior: 100, environment: 100 };
  });

  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportContent, setReportContent] = useState("");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  const [offlineAI, setOfflineAI] = useState<OfflineAIState>({ 
    isEnabled: false, isModelLoaded: false, isLoading: false, modelName: 'Phi-3.5 Vision', progress: 0, loadingText: '' 
  });
  
  const [net, setNet] = useState<cocoSsd.ObjectDetection | null>(null);
  const [perfMetrics, setPerfMetrics] = useState({ fps: 0, memory: 0, status: 'healthy' as any });
  
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const camerasRef = useRef<CameraDevice[]>([]);
  const isProcessingRef = useRef(false);
  const lastAlertTimeRef = useRef<Record<string, number>>({});
  const detectionTimerRef = useRef<number | null>(null);

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CAMERAS, JSON.stringify(cameras.map(c => {
        const { stream, active, ...rest } = c;
        return rest;
    })));
  }, [cameras]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DETECTIONS, JSON.stringify(detections));
  }, [detections]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SCORES, JSON.stringify(safetyScore));
  }, [safetyScore]);

  useEffect(() => { camerasRef.current = cameras; }, [cameras]);

  const detectionStats = useMemo(() => {
    const counts = { person: 0, behavior: 0, geofence: 0, ppe: 0 };
    detections.forEach(d => { if (d.type in counts) counts[d.type as keyof typeof counts]++; });
    return [
      { label: 'Personnel', value: counts.person, color: theme.colors.info },
      { label: 'Safety Violations', value: counts.behavior, color: theme.colors.warning },
      { label: 'Area Breach', value: counts.geofence, color: theme.colors.danger },
    ];
  }, [detections]);

  const addDetection = useCallback((detection: Detection) => {
    setDetections(prev => [detection, ...prev].slice(0, MAX_LOGS));
    setSafetyScore(prev => ({
        ...prev,
        overall: Math.max(0, prev.overall - (detection.severity === 'high' ? 5 : 2)),
        behavior: detection.type === 'behavior' ? Math.max(0, prev.behavior - 5) : prev.behavior,
    }));
  }, []);

  const clearLogs = () => {
    if (window.confirm("Are you sure you want to clear all historical logs?")) {
        setDetections([]);
        setSafetyScore({ overall: 100, ppe: 100, behavior: 100, environment: 100 });
    }
  };

  useEffect(() => {
    performanceMonitor.start();
    const interval = setInterval(() => {
      const metrics = performanceMonitor.getCurrentMetrics();
      const health = performanceMonitor.getHealthStatus();
      if (metrics) setPerfMetrics({ fps: metrics.fps, memory: metrics.memoryUsage, status: health.status });
    }, 2000);
    
    const loadCoco = async () => {
        try {
            await tf.ready();
            const loadedNet = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
            setNet(loadedNet);
        } catch(e) { console.error("COCO Fail", e); }
    };
    loadCoco();

    return () => { 
      performanceMonitor.stop(); 
      clearInterval(interval);
      if (detectionTimerRef.current) clearTimeout(detectionTimerRef.current);
    };
  }, []);

  const runDetection = useCallback(async () => {
    if (!net || isProcessingRef.current) {
        detectionTimerRef.current = window.setTimeout(runDetection, 100);
        return;
    }

    const currentCameras = camerasRef.current;
    const targetCams = currentCameras.filter(c => c.active && c.status === 'online');
    
    if (targetCams.length === 0) {
        detectionTimerRef.current = window.setTimeout(runDetection, 1500);
        return;
    }

    const targetCam = selectedCameraId ? targetCams.find(c => c.id === selectedCameraId) || targetCams[0] : targetCams[0];
    const videoEl = videoRefs.current.get(targetCam.id);

    if (videoEl && videoEl.readyState === 4 && !videoEl.paused) {
        try {
            isProcessingRef.current = true;
            const predictions = await net.detect(videoEl);
            const now = Date.now();
            
            for (const prediction of predictions) {
               if (prediction.score < 0.65) continue;
               
               let detectionType: Detection['type'] | null = null;
               let description = '';
               let severity: Detection['severity'] = 'low';
               
               if (prediction.class === 'person') {
                   // منطق تحلیل هوشمند: اگر مدل ویژن بارگذاری شده، یک تحلیل واقعی انجام بده
                   if (localAi.isReady() && now - (lastAlertTimeRef.current[`${targetCam.id}-vision`] || 0) > 30000) {
                       lastAlertTimeRef.current[`${targetCam.id}-vision`] = now;
                       description = "Verifying PPE & Safety Compliance...";
                       // اجرای تحلیل واقعی در پس‌زمینه بدون بلاک کردن لوپ
                       captureAndAnalyze(targetCam.id);
                   } else {
                       detectionType = 'person';
                       description = 'Personnel Detected in Zone';
                       severity = 'medium';
                   }
               } else if (prediction.class === 'cell phone') {
                   detectionType = 'behavior';
                   description = 'Restricted Device Usage';
                   severity = 'high';
               }

               if (detectionType) {
                  const cooldownKey = `${targetCam.id}-${detectionType}`;
                  if (now - (lastAlertTimeRef.current[cooldownKey] || 0) > 10000) {
                      lastAlertTimeRef.current[cooldownKey] = now;
                      addDetection({ 
                        id: `det-${now}-${Math.random()}`, 
                        type: detectionType, 
                        severity, 
                        description, 
                        timestamp: now, 
                        cameraId: targetCam.id 
                      });
                      setCameras(prev => prev.map(cam => cam.id === targetCam.id ? { ...cam, riskScore: Math.min(100, cam.riskScore + 15), lastDetection: now } : cam));
                  }
               }
            }
        } catch (e) { console.warn(e); }
        finally { isProcessingRef.current = false; }
    }
    detectionTimerRef.current = window.setTimeout(runDetection, DETECTION_INTERVAL);
  }, [net, selectedCameraId, addDetection]);

  const captureAndAnalyze = async (cameraId: string) => {
    const video = videoRefs.current.get(cameraId);
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const frame = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
    
    try {
        const analysis = await localAi.analyzeImage(frame, "Be a safety inspector. Check if people have hard hats and vests. Report any hazards briefly.");
        addDetection({
            id: `vision-${Date.now()}`,
            type: analysis.toLowerCase().includes('violation') ? 'behavior' : 'ppe',
            severity: analysis.toLowerCase().includes('hazard') ? 'high' : 'medium',
            description: `AI Audit: ${analysis.substring(0, 60)}...`,
            timestamp: Date.now(),
            cameraId
        });
    } catch (e) { console.error("Vision background task failed", e); }
  };

  useEffect(() => { if (net) runDetection(); }, [net, runDetection]);

  const toggleOfflineAI = async (enable: boolean) => {
    if (enable && !localAi.isReady()) {
      setOfflineAI(prev => ({ ...prev, isLoading: true, progress: 0, loadingText: 'Starting AI Core...' }));
      try {
        await localAi.initialize((progress, text) => setOfflineAI(prev => ({ ...prev, progress, loadingText: text })));
        setOfflineAI(prev => ({ ...prev, isModelLoaded: true, isEnabled: true, isLoading: false }));
      } catch (err) {
        setOfflineAI(prev => ({ ...prev, isLoading: false, loadingText: 'AI Core Failed' }));
      }
    } else { setOfflineAI(prev => ({ ...prev, isEnabled: enable })); }
  };

  const startCamera = useCallback(async (cameraId: string) => {
    const camera = camerasRef.current.find(c => c.id === cameraId);
    if (!camera) return;
    if (camera.connectionType === 'network') {
      setCameras(prev => prev.map(cam => cam.id === cameraId ? { ...cam, active: true, status: 'online' } : cam));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, frameRate: 15, deviceId: camera.deviceId ? { exact: camera.deviceId } : undefined } });
      setCameras(prev => prev.map(cam => cam.id === cameraId ? { ...cam, active: true, stream, status: 'online' } : cam));
      const video = videoRefs.current.get(cameraId);
      if (video) { video.srcObject = stream; video.play(); }
    } catch (e) {
      setCameras(prev => prev.map(cam => cam.id === cameraId ? { ...cam, status: 'no-hardware', active: false } : cam));
    }
  }, []);

  const stopCamera = useCallback((cameraId: string) => {
    setCameras(prev => prev.map(cam => {
      if (cam.id === cameraId && cam.stream) { cam.stream.getTracks().forEach(t => t.stop()); return { ...cam, active: false, stream: undefined, status: 'offline' }; }
      return cam;
    }));
    const v = videoRefs.current.get(cameraId); if (v) v.srcObject = null;
  }, []);

  const generateAIReport = async () => {
    if (!localAi.isReady()) { alert("Please enable AI Core in settings."); setIsConfigOpen(true); return; }
    setIsReportOpen(true); setIsGeneratingReport(true); setReportContent("");
    try {
      const logs = detections.slice(0, 20).map(d => `[${new Date(d.timestamp).toLocaleTimeString()}] ${d.description}`).join('\n');
      const res = await localAi.generateText(`Analyze these safety logs and provide an executive summary for the EHS manager:\n${logs}`);
      setReportContent(res);
    } catch (e: any) { setReportContent(e.message); }
    finally { setIsGeneratingReport(false); }
  };

  const filteredCameras = cameras;
  const totalPages = Math.max(1, Math.ceil(filteredCameras.length / 9));
  const visibleCameras = filteredCameras.slice(currentPage * 9, currentPage * 9 + 9);
  const activeCamera = cameras.find(c => c.id === selectedCameraId) || cameras[0];

  return (
    <AuthGuard>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: theme.colors.bg, color: theme.colors.text }}>
        <header style={{ height: 64, borderBottom: `1px solid ${theme.colors.border}`, backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(12px)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Shield size={28} color={theme.colors.primary} />
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 'bold', margin: 0 }}>HSE GUARDIAN <span style={{ color: theme.colors.primary }}>PRO</span></h1>
              <div style={{ fontSize: 11, color: theme.colors.textMuted, display: 'flex', gap: 8 }}>
                <span>FPS: {perfMetrics.fps}</span> • <span>Storage: LOCAL</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setIsConfigOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', backgroundColor: theme.colors.border, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}><Settings2 size={16} /> Configuration</button>
            <button onClick={generateAIReport} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', backgroundColor: theme.colors.primary, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 'bold', cursor: 'pointer' }}><FileText size={16} /> AI Audit</button>
          </div>
        </header>

        <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ height: 48, borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', backgroundColor: theme.colors.panel }}>
               <div style={{ display: 'flex', gap: 12 }}>
                 <button onClick={() => setViewMode(viewMode === 'grid' ? 'single' : 'grid')} style={{ background: 'none', border: 'none', color: theme.colors.textMuted, cursor: 'pointer' }}>{viewMode === 'grid' ? <Maximize2 size={18} /> : <Grid size={18} />}</button>
               </div>
               <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }} className="custom-scrollbar">
              {cameras.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                  <Camera size={64} style={{ marginBottom: 16 }} />
                  <p>No Cameras Persistent. Add them in Configuration.</p>
                </div>
              ) : viewMode === 'grid' ? (
                <CameraGrid cameras={cameras} visibleCameras={visibleCameras} onCameraSelect={(id) => { setSelectedCameraId(id); setViewMode('single'); }} selectedCamera={selectedCameraId || ''} />
              ) : (
                <SingleCameraView camera={activeCamera} onBack={() => setViewMode('grid')} onAnalyze={() => captureAndAnalyze(activeCamera.id)} />
              )}
            </div>
          </div>

          <aside style={{ width: 340, borderLeft: `1px solid ${theme.colors.border}`, backgroundColor: theme.colors.panel, display: 'flex', flexDirection: 'column' }}>
             <div style={{ padding: 20, borderBottom: `1px solid ${theme.colors.border}` }}>
               <GaugeChart value={safetyScore.overall} label="Safety Compliance" color={safetyScore.overall > 80 ? theme.colors.success : theme.colors.warning} />
               <div style={{ marginTop: 20 }}><BarChart data={detectionStats} /></div>
             </div>
             
             <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
               <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                 <span style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.textMuted }}>PERSISTENT LOGS</span>
                 <button onClick={clearLogs} style={{ background: 'none', border: 'none', color: theme.colors.danger, cursor: 'pointer' }}><Trash2 size={14} /></button>
               </div>
               <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }} className="custom-scrollbar">
                 {detections.map(det => (
                   <div key={det.id} style={{ padding: 12, borderRadius: 8, border: `1px solid ${theme.colors.border}`, backgroundColor: 'rgba(30, 41, 59, 0.4)', borderLeft: `4px solid ${det.severity === 'high' ? theme.colors.danger : theme.colors.info}` }}>
                     <div style={{ fontSize: 13, fontWeight: '600', marginBottom: 4 }}>{det.description}</div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, opacity: 0.6 }}>
                       <span>{cameras.find(c => c.id === det.cameraId)?.name || 'Unknown'}</span>
                       <span>{new Date(det.timestamp).toLocaleTimeString()}</span>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
          </aside>
        </main>

        {isReportOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)' }}>
            <div style={{ backgroundColor: theme.colors.panel, border: `1px solid ${theme.colors.border}`, width: '90%', maxWidth: 700, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: 20, borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={20} color={theme.colors.primary} /> AI Safety Audit Report</h3>
                <button onClick={() => setIsReportOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ padding: 32, maxHeight: '70vh', overflowY: 'auto', fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#cbd5e1' }}>
                {isGeneratingReport ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: 40 }}><Loader2 className="animate-spin" size={40} /><p>Synthesizing Historical Data...</p></div> : reportContent}
              </div>
              <div style={{ padding: 16, backgroundColor: 'rgba(0,0,0,0.3)', textAlign: 'right' }}>
                <button onClick={() => window.print()} style={{ padding: '8px 20px', backgroundColor: theme.colors.border, color: '#fff', borderRadius: 8, border: 'none', cursor: 'pointer' }}>Print to PDF</button>
              </div>
            </div>
          </div>
        )}

        {isConfigOpen && <CameraSetupModal cameras={cameras} onUpdateCameras={setCameras} onClose={() => setIsConfigOpen(false)} offlineAI={offlineAI} onToggleOfflineAI={toggleOfflineAI} />}

        <div style={{ display: 'none' }}>
          {cameras.map(cam => <video key={`vid-${cam.id}`} ref={el => { if (el) videoRefs.current.set(cam.id, el); }} muted playsInline autoPlay width={320} height={240} crossOrigin="anonymous" />)}
        </div>
      </div>
    </AuthGuard>
  );
}
