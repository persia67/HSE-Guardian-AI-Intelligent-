import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Shield, Play, Pause, Grid, Maximize2, AlertTriangle, Activity, CheckCircle2, FileText, X, Loader2, Settings2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { CameraGrid } from './components/CameraGrid';
import { Pagination } from './components/Pagination';
import { SingleCameraView } from './components/SingleCameraView';
import { AuthGuard } from './components/AuthGuard';
import { CameraSetupModal } from './components/CameraSetupModal';
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
    Array.from({ length: 9 }, (_, i) => ({
      id: `cam${i + 1}`,
      name: `Simulated Unit ${i + 1}`,
      location: `Zone ${Math.floor(i / 10) + 1} - Sec ${(i % 10) + 1}`,
      active: false,
      riskScore: 0,
      fps: 0,
      status: 'offline' as const,
      connectionType: 'simulation' as const
    }))
  );
  
  const [detections, setDetections] = useState<Detection[]>([]);
  const [safetyScore, setSafetyScore] = useState<SafetyScore>({
    overall: 98,
    ppe: 99,
    behavior: 95,
    environment: 98
  });
  
  const [selectedCameraId, setSelectedCameraId] = useState<string>('cam1');
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid');
  const [filterRisk, setFilterRisk] = useState<'all' | 'high'>('all');
  
  // Report State
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportContent, setReportContent] = useState("");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Config Modal State
  const [isConfigOpen, setIsConfigOpen] = useState(false);

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

  const activeCamera = useMemo(() => 
    cameras.find(c => c.id === selectedCameraId) || cameras[0]
  , [cameras, selectedCameraId]);

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
      const camera = cameras.find(c => c.id === cameraId);
      if (!camera) return;

      const activeCount = cameras.filter(c => c.active).length;
      if (activeCount >= MAX_SIMULTANEOUS_STREAMS) {
        return;
      }

      // Handle Network Camera (Mock activation)
      if (camera.connectionType === 'network') {
        setCameras(prev => prev.map(cam => 
            cam.id === cameraId ? { ...cam, active: true, status: 'online' } : cam
        ));
        return;
      }

      // Handle Local Hardware Camera
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: CAMERA_WIDTH },
          height: { ideal: CAMERA_HEIGHT },
          frameRate: { ideal: 15 },
          // CRITICAL FIX: If we have a specific deviceId, use it!
          deviceId: camera.deviceId ? { exact: camera.deviceId } : undefined
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
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
    } catch (error: any) {
      console.warn('Camera access failed:', error.name, error.message);
      
      const isNotFoundError = error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError';
      const isOverconstrained = error.name === 'OverconstrainedError';

      setCameras(prev => prev.map(cam =>
        cam.id === cameraId ? { 
            ...cam, 
            status: (isNotFoundError || isOverconstrained) ? 'no-hardware' : 'offline', 
            active: false 
        } : cam
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

  const handleCameraSelect = (id: string) => {
    setSelectedCameraId(id);
    setViewMode('single');
  };

  const startAllCamerasInPage = useCallback(async () => {
    const promises = visibleCameras
      .filter(c => !c.active && c.status !== 'no-hardware')
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
    
    // Only process simulated frames for now as a demo
    const camera = cameras.find(c => c.id === cameraId);
    // Real processing would grab frame from canvas
    
    frameCountRef.current++;
    if (frameCountRef.current % FRAME_SKIP !== 0) return;
    
    // Low probability random detection simulation for demo purposes
    if (Math.random() > 0.995) { 
      const violations = [
        { desc: 'Missing Helmet', type: 'ppe', severity: 'medium' },
        { desc: 'Restricted Area', type: 'geofence', severity: 'high' },
        { desc: 'Fall Detected', type: 'fall', severity: 'critical' },
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
    }
  }, [addDetection, cameras]);

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

  // AI Report Generation
  const generateAIReport = async () => {
    const storedKey = localStorage.getItem('gemini_api_key');
    const apiKey = storedKey || process.env.API_KEY;

    if (!apiKey) {
      setReportContent("Critical Error: AI processing requires an Enterprise API Key.\nPlease go to 'Input Config' > 'AI Settings' to enter your key.");
      setIsReportOpen(true);
      return;
    }

    setIsReportOpen(true);
    setIsGeneratingReport(true);
    setReportContent("");

    try {
      const ai = new GoogleGenAI({ apiKey });
      const logData = detections.slice(0, 20).map(d => {
        const cam = cameras.find(c => c.id === d.cameraId);
        return `- Incident: ${d.description} (${d.severity}) | Camera: ${cam?.name || d.cameraId} | Location: ${cam?.location || 'Unknown'}`;
      }).join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a concise industrial safety shift report based on these incidents:\n${logData}`
      });

      if (!response.text) throw new Error("Empty response");
      setReportContent(response.text);
    } catch (error: any) {
      setReportContent(`Failed to generate report: ${error.message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const stats = useMemo(() => {
    const activeCameras = cameras.filter(c => c.active).length;
    const highRiskCameras = cameras.filter(c => c.riskScore > 50).length;
    const criticalDetections = detections.filter(d => d.severity === 'critical').length;
    return { activeCameras, highRiskCameras, criticalDetections };
  }, [cameras, detections]);

  // Helper to get detection styles
  const getDetectionStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          card: 'bg-rose-950/40 border-rose-500/50 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.1)]',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          indicator: 'bg-rose-500'
        };
      case 'high':
        return {
          card: 'bg-orange-950/40 border-orange-500/50 text-orange-200',
          badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
          indicator: 'bg-orange-500'
        };
      case 'medium':
        return {
          card: 'bg-amber-950/30 border-amber-500/40 text-amber-200',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          indicator: 'bg-amber-500'
        };
      case 'low':
        return {
          card: 'bg-blue-950/30 border-blue-500/40 text-blue-200',
          badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
          indicator: 'bg-blue-500'
        };
      default:
        return {
          card: 'bg-slate-800 border-slate-700 text-slate-300',
          badge: 'bg-slate-700 text-slate-400 border-slate-600',
          indicator: 'bg-slate-600'
        };
    }
  };

  return (
    <AuthGuard>
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
                <span>FPS: {perfMetrics.fps}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setIsConfigOpen(true)}
               className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold transition-colors"
             >
               <Settings2 className="w-4 h-4" />
               Input Config
             </button>
             <div className="h-8 w-px bg-slate-800"></div>
             <div className="flex flex-col items-end">
               <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Safety Score</span>
               <div className="flex items-baseline gap-1">
                 <span className={`text-2xl font-bold ${
                   safetyScore.overall >= 90 ? 'text-emerald-500' :
                   safetyScore.overall >= 70 ? 'text-amber-500' : 'text-rose-500'
                 }`}>{Math.floor(safetyScore.overall)}</span>
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
              {viewMode === 'grid' ? (
                <CameraGrid
                  cameras={cameras}
                  visibleCameras={visibleCameras}
                  onCameraSelect={handleCameraSelect}
                  selectedCamera={selectedCameraId}
                />
              ) : (
                <SingleCameraView 
                  camera={activeCamera} 
                  onBack={() => setViewMode('grid')}
                />
              )}
            </div>
          </div>

          <aside className="w-80 border-l border-slate-800 bg-slate-900 flex flex-col">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Live Alerts
              </h2>
              <button 
                onClick={generateAIReport}
                className="text-xs flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition-colors"
              >
                <FileText className="w-3 h-3" /> Report
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {detections.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-40 text-slate-600 space-y-2">
                   <CheckCircle2 className="w-8 h-8 opacity-50" />
                   <span className="text-sm">No Active Violations</span>
                 </div>
              ) : (
                detections.map(det => {
                  const cam = cameras.find(c => c.id === det.cameraId);
                  const styles = getDetectionStyles(det.severity);
                  return (
                    <div 
                      key={det.id} 
                      onClick={() => handleCameraSelect(det.cameraId)}
                      className={`p-3 rounded-lg border text-sm transition-all duration-300 relative overflow-hidden pl-4 cursor-pointer hover:ring-2 hover:ring-white/10 ${styles.card}`}
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${styles.indicator}`}></div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold">{det.description}</span>
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${styles.badge}`}>
                          {det.severity}
                        </span>
                      </div>
                      <div className="flex justify-between items-start text-xs opacity-70 mt-2 border-t border-white/10 pt-2">
                        <div className="flex flex-col">
                          <span className="font-medium text-white/90">{cam?.name || det.cameraId}</span>
                          <span className="text-[10px] uppercase tracking-wide opacity-80">{cam?.location || 'Unknown'}</span>
                        </div>
                        <span className="whitespace-nowrap ml-2">{new Date(det.timestamp).toLocaleTimeString()}</span>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  AI Shift Incident Report
                </h3>
                <button onClick={() => setIsReportOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-950/50 font-mono text-sm leading-relaxed">
                {isGeneratingReport ? (
                  <div className="flex flex-col items-center justify-center h-48 space-y-4">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-slate-400 animate-pulse text-center">Synthesizing Safety Data via Gemini...</p>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none whitespace-pre-wrap">{reportContent}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {isConfigOpen && (
          <CameraSetupModal
            cameras={cameras}
            onUpdateCameras={setCameras}
            onClose={() => setIsConfigOpen(false)}
          />
        )}

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
    </AuthGuard>
  );
}