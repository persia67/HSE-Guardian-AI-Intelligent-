import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Shield, Play, Pause, Grid, Maximize2, AlertTriangle, Activity, CheckCircle2 } from 'lucide-react';
import { CameraGrid } from './components/CameraGrid';
import { Pagination } from './components/Pagination';
import { Detection, CameraDevice, SafetyScore } from './types';
import { performanceMonitor } from './utils/performanceMonitor';

// Constants
const MAX_LOGS = 100;
const FRAME_SKIP = 10;
const CAMERA_WIDTH = 320;
const CAMERA_HEIGHT = 240;
const MAX_SIMULTANEOUS_STREAMS = 9;
const CAMERAS_PER_PAGE = 9;

export default function HSEGuardianAI() {
  // State
  const [cameras, setCameras] = useState<CameraDevice[]>(() => 
    Array.from({ length: 45 }, (_, i) => ({
      id: `cam${i + 1}`,
      name: `Camera Unit ${i + 1}`,
      location: `Zone ${Math.floor(i / 10) + 1} - Sec ${(i % 10) + 1}`,
      active: false,
      riskScore: 0,
      fps: 0,
      status: 'offline' as const
    }))
  );
  
  const [detections, setDetections] = useState<Detection[]>([]);
  const [safetyScore, setSafetyScore] = useState<SafetyScore>({
    overall: 98,
    ppe: 99,
    behavior: 95,
    environment: 98
  });
  
  const [selectedCamera, setSelectedCamera] = useState<string>('cam1');
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid');
  const [filterRisk, setFilterRisk] = useState<'all' | 'high'>('all');
  
  // Performance State
  const [perfMetrics, setPerfMetrics] = useState({ 
    fps: 0, 
    memory: 0, 
    status: 'healthy' as 'healthy' | 'warning' | 'critical' 
  });
  
  // Refs for processing
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const frameCountRef = useRef(0);
  const processingQueueRef = useRef<string[]>([]);

  // Helpers
  const addDetection = useCallback((detection: Detection) => {
    setDetections(prev => {
      const updated = [detection, ...prev];
      return updated.slice(0, MAX_LOGS);
    });
  }, []);

  // Performance Monitor Integration
  useEffect(() => {
    performanceMonitor.start();

    const interval = setInterval(() => {
      const metrics = performanceMonitor.getCurrentMetrics();
      const health = performanceMonitor.getHealthStatus();
      
      if (metrics) {
        setPerfMetrics({
          fps: metrics.fps,
          memory: metrics.memoryUsage,
          status: health.status
        });
      }
    }, 1000);

    return () => {
      performanceMonitor.stop();
      clearInterval(interval);
    };
  }, []);

  // Pagination Logic
  const filteredCameras = useMemo(() => {
    if (filterRisk === 'all') return cameras;
    return cameras.filter(cam => cam.riskScore > 30);
  }, [cameras, filterRisk]);

  const totalPages = Math.ceil(filteredCameras.length / CAMERAS_PER_PAGE);
  
  const visibleCameras = useMemo(() => {
    const start = currentPage * CAMERAS_PER_PAGE;
    return filteredCameras.slice(start, start + CAMERAS_PER_PAGE);
  }, [filteredCameras, currentPage]);

  // Update Processing Queue
  const updateProcessingQueue = useCallback(() => {
    const sorted = [...cameras]
      .filter(c => c.active)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, MAX_SIMULTANEOUS_STREAMS)
      .map(c => c.id);
    
    processingQueueRef.current = sorted;
  }, [cameras]);

  useEffect(() => {
    updateProcessingQueue();
  }, [cameras, updateProcessingQueue]);

  // Camera Control
  const startCamera = useCallback(async (cameraId: string) => {
    try {
      const activeCount = cameras.filter(c => c.active).length;
      if (activeCount >= MAX_SIMULTANEOUS_STREAMS) {
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          width: { ideal: CAMERA_WIDTH }, 
          height: { ideal: CAMERA_HEIGHT },
          frameRate: { ideal: 15 }
        }
      });
      
      setCameras(prev => prev.map(cam => 
        cam.id === cameraId 
          ? { ...cam, active: true, stream, status: 'online' }
          : cam
      ));
      
      const video = videoRefs.current.get(cameraId);
      if (video) {
        video.srcObject = stream;
        video.play().catch(e => console.error("Play error", e));
      }
    } catch (error) {
      console.error('Camera error:', error);
      setCameras(prev => prev.map(cam =>
        cam.id === cameraId ? { ...cam, status: 'offline' } : cam
      ));
    }
  }, [cameras]);

  const stopCamera = useCallback((cameraId: string) => {
    setCameras(prev => prev.map(cam => {
      if (cam.id === cameraId && cam.stream) {
        cam.stream.getTracks().forEach(track => track.stop());
        return { ...cam, active: false, stream: undefined, status: 'offline' };
      }
      return cam;
    }));
    
    const video = videoRefs.current.get(cameraId);
    if (video) video.srcObject = null;
  }, []);

  const startAllCamerasInPage = useCallback(async () => {
    const promises = visibleCameras
      .filter(c => !c.active)
      .slice(0, MAX_SIMULTANEOUS_STREAMS)
      .map(c => startCamera(c.id));
    
    await Promise.allSettled(promises);
  }, [visibleCameras, startCamera]);

  const stopAllCameras = useCallback(() => {
    cameras.filter(c => c.active).forEach(c => stopCamera(c.id));
  }, [cameras, stopCamera]);

  // AI Simulation Loop
  const processFrame = useCallback((cameraId: string) => {
    if (!processingQueueRef.current.includes(cameraId)) return;
    
    const video = videoRefs.current.get(cameraId);
    const canvas = canvasRefs.current.get(cameraId);
    if (!video || !canvas) return;
    
    frameCountRef.current++;
    if (frameCountRef.current % FRAME_SKIP !== 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    try {
      ctx.drawImage(video, 0, 0, CAMERA_WIDTH, CAMERA_HEIGHT);
    } catch (e) {
      return; 
    }
    
    if (Math.random() > 0.992) { 
      const violations = [
        { desc: 'Missing Helmet', type: 'ppe', severity: 'medium' },
        { desc: 'Missing Vest', type: 'ppe', severity: 'low' },
        { desc: 'Restricted Area Access', type: 'geofence', severity: 'high' },
        { desc: 'Fall Detected', type: 'fall', severity: 'critical' },
        { desc: 'Running in Zone', type: 'behavior', severity: 'medium' }
      ] as const;

      const violation = violations[Math.floor(Math.random() * violations.length)];
      
      const detection: Detection = {
        id: `${cameraId}-${Date.now()}`,
        type: violation.type as any,
        severity: violation.severity as any,
        description: violation.desc,
        timestamp: Date.now(),
        cameraId
      };
      
      addDetection(detection);
      
      setCameras(prev => prev.map(cam =>
        cam.id === cameraId
          ? { 
              ...cam, 
              riskScore: Math.min(100, cam.riskScore + (violation.severity === 'critical' ? 30 : 10)), 
              lastDetection: Date.now() 
            }
          : cam
      ));

      setSafetyScore(prev => ({
        ...prev,
        overall: Math.max(50, prev.overall - 1)
      }));
    }
  }, [addDetection]);

  // Animation Loop
  useEffect(() => {
    let animationFrame: number;
    const loop = () => {
      processingQueueRef.current.forEach(cameraId => {
        processFrame(cameraId);
      });
      animationFrame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationFrame);
  }, [processFrame]);

  // Score Decay (Recovery)
  useEffect(() => {
    const interval = setInterval(() => {
      setCameras(prev => prev.map(cam => ({
        ...cam,
        riskScore: Math.max(0, cam.riskScore - 2)
      })));
      setSafetyScore(prev => ({
        ...prev,
        overall: Math.min(100, prev.overall + 0.5)
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const activeCameras = cameras.filter(c => c.active).length;
    const highRiskCameras = cameras.filter(c => c.riskScore > 50).length;
    const criticalDetections = detections.filter(d => d.severity === 'critical').length;
    return { activeCameras, highRiskCameras, criticalDetections };
  }, [cameras, detections]);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200">
      <header className="flex-none h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30">
            <Shield className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">HSE Guardian <span className="text-blue-500">AI</span></h1>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className={`flex items-center gap-1 ${
                perfMetrics.status === 'critical' ? 'text-rose-500 font-bold' : 
                perfMetrics.status === 'warning' ? 'text-amber-500' : 'text-emerald-500'
              }`}>
                <Activity className="w-3 h-3" /> System Status
              </span>
              <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
              <span className={perfMetrics.fps < 20 ? 'text-rose-400' : ''}>FPS: {perfMetrics.fps}</span>
              <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
              <span className={perfMetrics.memory > 500 ? 'text-amber-400' : ''}>Mem: {perfMetrics.memory}MB</span>
              <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
              <span>v2.4.1 (Enterprise)</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-8">
           <div className="flex flex-col items-end">
             <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Safety Score</span>
             <div className="flex items-baseline gap-1">
               <span className={`text-2xl font-bold ${
                 safetyScore.overall >= 90 ? 'text-emerald-500' :
                 safetyScore.overall >= 70 ? 'text-amber-500' : 'text-rose-500'
               }`}>{Math.floor(safetyScore.overall)}</span>
               <span className="text-xs text-slate-500">/ 100</span>
             </div>
           </div>
           <div className="h-8 w-px bg-slate-800"></div>
           <div className="flex gap-4">
             <div className="text-center">
               <div className="text-xs text-slate-500 uppercase">Active</div>
               <div className="text-lg font-bold text-white">{stats.activeCameras}</div>
             </div>
             <div className="text-center">
               <div className="text-xs text-slate-500 uppercase">Risks</div>
               <div className={`text-lg font-bold ${stats.highRiskCameras > 0 ? 'text-rose-500' : 'text-slate-300'}`}>
                 {stats.highRiskCameras}
               </div>
             </div>
           </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
          <div className="flex-none h-14 border-b border-slate-800 flex items-center justify-between px-4">
             <div className="flex items-center gap-2">
               <button
                 onClick={() => setViewMode(viewMode === 'grid' ? 'single' : 'grid')}
                 className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                 title="Toggle View"
               >
                 {viewMode === 'grid' ? <Maximize2 className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
               </button>
               <div className="h-6 w-px bg-slate-800 mx-2"></div>
               <select
                 value={filterRisk}
                 onChange={(e) => setFilterRisk(e.target.value as any)}
                 className="bg-slate-900 border border-slate-700 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 text-slate-300"
               >
                 <option value="all">All Cameras</option>
                 <option value="high">High Risk Only</option>
               </select>
             </div>

             <div className="flex items-center gap-3">
               <Pagination
                 currentPage={currentPage}
                 totalPages={totalPages}
                 onPageChange={setCurrentPage}
               />
               <div className="flex gap-2 ml-4">
                 <button
                   onClick={startAllCamerasInPage}
                   className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600/20 text-emerald-500 border border-emerald-600/30 hover:bg-emerald-600/30 rounded-lg text-sm font-medium transition-colors"
                 >
                   <Play className="w-4 h-4" /> Start Page
                 </button>
                 <button
                   onClick={stopAllCameras}
                   className="flex items-center gap-2 px-3 py-1.5 bg-rose-600/20 text-rose-500 border border-rose-600/30 hover:bg-rose-600/30 rounded-lg text-sm font-medium transition-colors"
                 >
                   <Pause className="w-4 h-4" /> Stop All
                 </button>
               </div>
             </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <CameraGrid
              cameras={cameras}
              visibleCameras={visibleCameras}
              onCameraSelect={setSelectedCamera}
              selectedCamera={selectedCamera}
            />
          </div>
        </div>

        <aside className="w-80 border-l border-slate-800 bg-slate-900 flex flex-col">
          <div className="p-4 border-b border-slate-800">
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Live Alerts
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {detections.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-40 text-slate-600 space-y-2">
                 <CheckCircle2 className="w-8 h-8 opacity-50" />
                 <span className="text-sm">No Active Violations</span>
               </div>
            ) : (
              detections.map(det => (
                <div 
                  key={det.id} 
                  className={`p-3 rounded-lg border text-sm transition-all duration-300 ${
                    det.severity === 'critical' ? 'bg-rose-950/30 border-rose-500/50 text-rose-200' :
                    det.severity === 'high' ? 'bg-amber-950/30 border-amber-500/50 text-amber-200' :
                    'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold">{det.description}</span>
                    <span className="text-[10px] opacity-70 bg-black/20 px-1.5 py-0.5 rounded uppercase">
                      {det.type}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs opacity-70">
                    <span>{cameras.find(c => c.id === det.cameraId)?.name || det.cameraId}</span>
                    <span>{new Date(det.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 bg-slate-950 border-t border-slate-800">
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">Compliance Overview</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">PPE Compliance</span>
                  <span className="text-emerald-500">{safetyScore.ppe}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${safetyScore.ppe}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Behavioral Safety</span>
                  <span className="text-blue-500">{safetyScore.behavior}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${safetyScore.behavior}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>

      <div className="hidden">
        {visibleCameras.map(cam => (
          <React.Fragment key={`proc-${cam.id}`}>
            <video
              ref={el => { if (el) videoRefs.current.set(cam.id, el); }}
              muted
              playsInline
              autoPlay
              width={CAMERA_WIDTH}
              height={CAMERA_HEIGHT}
            />
            <canvas
              ref={el => { if (el) canvasRefs.current.set(cam.id, el); }}
              width={CAMERA_WIDTH}
              height={CAMERA_HEIGHT}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}