import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Shield, Play, Pause, Grid, Maximize2, AlertTriangle, Activity, CheckCircle2, FileText, X, Loader2, Settings2, WifiOff, Camera, Sparkles, ScanEye } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

import { CameraGrid } from './components/CameraGrid';
import { Pagination } from './components/Pagination';
import { SingleCameraView } from './components/SingleCameraView';
import { AuthGuard } from './components/AuthGuard';
import { CameraSetupModal } from './components/CameraSetupModal';
import { Detection, CameraDevice, SafetyScore, OfflineAIState } from './types';
import { performanceMonitor } from './utils/performanceMonitor';

// Constants
const MAX_LOGS = 100;
// Processing interval: Every 15th frame (approx 2 times per second at 30fps)
const FRAME_SKIP = 15;
const CAMERA_WIDTH = 320;
const CAMERA_HEIGHT = 240;
// LIMIT AI: Only process 1 stream at a time to prevent CPU overload on standard hardware
const MAX_AI_CONCURRENT_STREAMS = 1; 
const CAMERAS_PER_PAGE = 9;

export default function HSEGuardianAI() {
  // State - Initialized EMPTY (No fake cameras)
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  
  const [detections, setDetections] = useState<Detection[]>([]);
  const [safetyScore, setSafetyScore] = useState<SafetyScore>({
    overall: 100,
    ppe: 100,
    behavior: 100,
    environment: 100
  });
  
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid');
  const [filterRisk, setFilterRisk] = useState<'all' | 'high'>('all');
  
  // Report State
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportContent, setReportContent] = useState("");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Video Analysis State
  const [isVideoAnalysisOpen, setIsVideoAnalysisOpen] = useState(false);
  const [videoAnalysisContent, setVideoAnalysisContent] = useState("");
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);

  // Config Modal State
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Offline AI State
  const [offlineAI, setOfflineAI] = useState<OfflineAIState>({
    isEnabled: false,
    isModelLoaded: false,
    isLoading: false,
    modelName: 'COCO-SSD Lite'
  });
  const [net, setNet] = useState<cocoSsd.ObjectDetection | null>(null);

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
  // Cooldown ref to prevent alert spamming
  const lastAlertTimeRef = useRef<Record<string, number>>({});

  // Helpers
  const addDetection = useCallback((detection: Detection) => {
    setDetections(prev => {
      const updated = [detection, ...prev];
      return updated.slice(0, MAX_LOGS);
    });
    
    // Impact Safety Score Real-time
    setSafetyScore(prev => ({
        ...prev,
        overall: Math.max(0, prev.overall - 5),
        behavior: Math.max(0, prev.behavior - 5)
    }));
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

  const totalPages = Math.max(1, Math.ceil(filteredCameras.length / CAMERAS_PER_PAGE));
  
  const visibleCameras = useMemo(() => {
    const start = currentPage * CAMERAS_PER_PAGE;
    return filteredCameras.slice(start, start + CAMERAS_PER_PAGE);
  }, [filteredCameras, currentPage]);

  const activeCamera = useMemo(() => 
    cameras.find(c => c.id === selectedCameraId) || cameras[0]
  , [cameras, selectedCameraId]);

  // Toggle Offline AI
  const toggleOfflineAI = async (enable: boolean) => {
    if (enable) {
      setOfflineAI(prev => ({ ...prev, isLoading: true }));
      try {
        await tf.ready();
        // Load the model
        const loadedNet = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        setNet(loadedNet);
        setOfflineAI(prev => ({ ...prev, isModelLoaded: true, isEnabled: true, isLoading: false }));
      } catch (err) {
        console.error("Failed to load offline model:", err);
        setOfflineAI(prev => ({ ...prev, isLoading: false }));
        alert("Failed to initialize AI Engine. Check internet for first-time download.");
      }
    } else {
      if (net) setNet(null);
      setOfflineAI(prev => ({ ...prev, isModelLoaded: false, isEnabled: false }));
    }
  };

  // Camera Control
  const startCamera = useCallback(async (cameraId: string) => {
    try {
      const camera = cameras.find(c => c.id === cameraId);
      if (!camera) return;

      if (camera.connectionType === 'network') {
        setCameras(prev => prev.map(cam => 
            cam.id === cameraId ? { ...cam, active: true, status: 'online' } : cam
        ));
        return;
      }

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: CAMERA_WIDTH },
          height: { ideal: CAMERA_HEIGHT },
          frameRate: { ideal: 15 },
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
      console.warn('Camera access failed:', error);
      setCameras(prev => prev.map(cam =>
        cam.id === cameraId ? { ...cam, status: 'no-hardware', active: false } : cam
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

  const handleCameraSelect = useCallback((id: string) => {
    setSelectedCameraId(id);
    setViewMode('single');
  }, []);

  const startAllCamerasInPage = useCallback(async () => {
    // Only start visible cameras to save resources
    visibleCameras.forEach(c => {
        if (!c.active && c.status !== 'no-hardware') startCamera(c.id);
    });
  }, [visibleCameras, startCamera]);

  const stopAllCameras = useCallback(() => {
    cameras.filter(c => c.active).forEach(c => stopCamera(c.id));
  }, [cameras, stopCamera]);

  // --- REAL AI PROCESSING LOOP (Offline) ---
  const processFrame = useCallback(async () => {
    // If AI is not loaded, do nothing. NO SIMULATION.
    if (!offlineAI.isModelLoaded || !net) return;

    frameCountRef.current++;
    if (frameCountRef.current % FRAME_SKIP !== 0) return;

    // Determine which camera to process
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
    
    // Only process if video is valid and playing
    if (videoEl && videoEl.readyState === 4 && !videoEl.paused) {
        try {
            // Actual TensorFlow Inference
            const predictions = await net.detect(videoEl);
            
            const personDetected = predictions.find(p => p.class === 'person' && p.score > 0.6);
            
            if (personDetected) {
                const now = Date.now();
                const lastAlert = lastAlertTimeRef.current[targetCameraId] || 0;
                
                // 5 Second Cooldown to prevent spam
                if (now - lastAlert > 5000) {
                    lastAlertTimeRef.current[targetCameraId] = now;
                    
                    const detection: Detection = {
                        id: `${targetCameraId}-${now}`,
                        type: 'person', // Strict type
                        severity: 'medium',
                        description: `Person Detected in Restricted Zone`, // Realistic description for generic model
                        timestamp: now,
                        cameraId: targetCameraId,
                        bbox: { 
                            x: personDetected.bbox[0], 
                            y: personDetected.bbox[1], 
                            w: personDetected.bbox[2], 
                            h: personDetected.bbox[3] 
                        }
                    };
                    addDetection(detection);
                    
                    // Update Camera Risk Score
                    setCameras(prev => prev.map(cam =>
                        cam.id === targetCameraId
                        ? { ...cam, riskScore: 100, lastDetection: now } // Spike risk on detection
                        : cam
                    ));
                }
            }
        } catch (e) {
            console.warn("AI Inference Error (Skipping Frame):", e);
        }
    }

  }, [addDetection, cameras, offlineAI.isModelLoaded, net, viewMode, selectedCameraId, visibleCameras]);

  // Main Loop
  useEffect(() => {
    let animationFrame: number;
    const loop = () => {
      processFrame();
      animationFrame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationFrame);
  }, [processFrame]);

  // Score Recovery (Decay risk over time if no detections)
  useEffect(() => {
    const interval = setInterval(() => {
      setCameras(prev => prev.map(cam => ({
        ...cam,
        riskScore: Math.max(0, cam.riskScore - 5) // Faster decay
      })));
      setSafetyScore(prev => ({
        ...prev,
        overall: Math.min(100, prev.overall + 1),
        behavior: Math.min(100, prev.behavior + 1)
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- GEMINI VIDEO ANALYSIS ---
  
  // Helper: Capture a single frame from the video element
  const captureFrame = (cameraId: string): string | null => {
    const video = videoRefs.current.get(cameraId);
    const canvas = canvasRefs.current.get(cameraId); // Reuse existing canvas or create temp
    
    if (video && video.readyState >= 2) {
       // Create a temp canvas if we don't have one mapped (though we should)
       const drawCanvas = canvas || document.createElement('canvas');
       drawCanvas.width = video.videoWidth;
       drawCanvas.height = video.videoHeight;
       const ctx = drawCanvas.getContext('2d');
       if (ctx) {
         ctx.drawImage(video, 0, 0, drawCanvas.width, drawCanvas.height);
         // Return base64 string without prefix
         return drawCanvas.toDataURL('image/jpeg', 0.8).split(',')[1];
       }
    }
    return null;
  };

  const performVideoAnalysis = async (cameraId: string) => {
    setIsVideoAnalysisOpen(true);
    setIsAnalyzingVideo(true);
    setVideoAnalysisContent("");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Capture 3 frames with 1 second interval to simulate "video"
      const frames: string[] = [];
      
      // Frame 1
      const f1 = captureFrame(cameraId);
      if(f1) frames.push(f1);
      
      // Wait 1s
      await new Promise(r => setTimeout(r, 1000));
      
      // Frame 2
      const f2 = captureFrame(cameraId);
      if(f2) frames.push(f2);
      
      // Wait 1s
      await new Promise(r => setTimeout(r, 1000));
      
      // Frame 3
      const f3 = captureFrame(cameraId);
      if(f3) frames.push(f3);

      if (frames.length === 0) {
        throw new Error("Could not capture video frames. Camera might be offline.");
      }

      // Prepare parts for Gemini
      const parts: Array<{
        text?: string;
        inlineData?: {
          mimeType: string;
          data: string;
        }
      }> = frames.map(f => ({
        inlineData: {
          mimeType: 'image/jpeg',
          data: f
        }
      }));
      
      // Prompt
      parts.push({
        text: "Analyze this sequence of security camera frames (1 second apart). Describe the activity, potential safety hazards, and verify if any Personal Protective Equipment (PPE) like helmets or vests are missing. Be professional and concise."
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview', // Requested Model for Video/Complex tasks
        contents: { parts: parts }
      });

      if (!response.text) throw new Error("Empty response from Gemini.");
      setVideoAnalysisContent(response.text);

    } catch (error: any) {
      console.error("Video Analysis Error:", error);
      setVideoAnalysisContent(`Analysis Failed: ${error.message}`);
    } finally {
      setIsAnalyzingVideo(false);
    }
  };


  // AI Report (Text Logs)
  const generateAIReport = async () => {
    setIsReportOpen(true);
    setIsGeneratingReport(true);
    setReportContent("");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Filter only real detections
      const realDetections = detections.slice(0, 20);
      
      if (realDetections.length === 0) {
          setReportContent("No incidents detected so far during this shift.");
          setIsGeneratingReport(false);
          return;
      }

      const logData = realDetections.map(d => {
        const cam = cameras.find(c => c.id === d.cameraId);
        return `- Time: ${new Date(d.timestamp).toLocaleTimeString()} | Type: ${d.type} | Camera: ${cam?.name}`;
      }).join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are an HSE Safety Officer. Analyze these REAL detections from an automated computer vision system. 
        Note: The system only detects 'persons'.
        Logs:
        ${logData}
        
        Write a short formal safety report summarizing the activity.`
      });

      if (!response.text) throw new Error("Empty response");
      setReportContent(response.text);
    } catch (error: any) {
      setReportContent(`Report Generation Failed: ${error.message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const getDetectionStyles = (severity: string) => {
    // Simplified styles
    switch (severity) {
      case 'critical':
      case 'high':
        return { card: 'bg-rose-950/40 border-rose-500', badge: 'bg-rose-500 text-white' };
      case 'medium':
        return { card: 'bg-amber-950/30 border-amber-500', badge: 'bg-amber-500 text-black' };
      default:
        return { card: 'bg-slate-800 border-slate-600', badge: 'bg-slate-600 text-white' };
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
                  perfMetrics.status === 'critical' ? 'text-rose-500' : 'text-emerald-500'
                }`}>
                  <Activity className="w-3 h-3" /> {perfMetrics.status === 'healthy' ? 'System Optimized' : 'High Load'}
                </span>
                <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                <span>FPS: {perfMetrics.fps}</span>
                {offlineAI.isModelLoaded ? (
                   <span className="ml-2 flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                     <WifiOff className="w-3 h-3" /> ENGINE ACTIVE
                   </span>
                ) : (
                    <span className="ml-2 flex items-center gap-1 text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                     <WifiOff className="w-3 h-3" /> ENGINE STOPPED
                   </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setIsConfigOpen(true)}
               className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors shadow-lg shadow-blue-900/20"
             >
               <Settings2 className="w-4 h-4" />
               System Setup
             </button>
             <div className="h-8 w-px bg-slate-800"></div>
             <div className="flex flex-col items-end">
               <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Safety Score</span>
               <span className={`text-2xl font-bold ${safetyScore.overall >= 90 ? 'text-emerald-500' : 'text-amber-500'}`}>
                   {Math.floor(safetyScore.overall)}
               </span>
             </div>
          </div>
        </header>

        <main className="flex-1 flex overflow-hidden">
          <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
            {/* Toolbar */}
            <div className="flex-none h-14 border-b border-slate-800 flex items-center justify-between px-4">
               <div className="flex items-center gap-2">
                 <button
                   onClick={() => setViewMode(viewMode === 'grid' ? 'single' : 'grid')}
                   disabled={cameras.length === 0}
                   className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                 >
                   {viewMode === 'grid' ? <Maximize2 className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
                 </button>
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
                     disabled={cameras.length === 0}
                     className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600/20 text-emerald-500 border border-emerald-600/30 hover:bg-emerald-600/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                   >
                     <Play className="w-4 h-4" /> Start Active View
                   </button>
                   <button
                     onClick={stopAllCameras}
                     disabled={cameras.length === 0}
                     className="flex items-center gap-2 px-3 py-1.5 bg-rose-600/20 text-rose-500 border border-rose-600/30 hover:bg-rose-600/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                   >
                     <Pause className="w-4 h-4" /> Stop All
                   </button>
                 </div>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
              {cameras.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 opacity-60">
                      <Camera className="w-20 h-20 mb-4 stroke-1" />
                      <h3 className="text-xl font-bold text-slate-300">No Cameras Configured</h3>
                      <p className="mb-6">Please add hardware or network streams to begin.</p>
                      <button 
                        onClick={() => setIsConfigOpen(true)}
                        className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-bold border border-slate-600"
                      >
                          Open Configuration
                      </button>
                  </div>
              ) : viewMode === 'grid' ? (
                <CameraGrid
                  cameras={cameras}
                  visibleCameras={visibleCameras}
                  onCameraSelect={handleCameraSelect}
                  selectedCamera={selectedCameraId || ''}
                />
              ) : activeCamera ? (
                <SingleCameraView 
                  camera={activeCamera} 
                  onBack={() => setViewMode('grid')}
                  onAnalyze={performVideoAnalysis}
                />
              ) : null}
            </div>
          </div>

          {/* Right Sidebar - Live Logs */}
          <aside className="w-80 border-l border-slate-800 bg-slate-900 flex flex-col">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Live Detections
              </h2>
              <button 
                onClick={generateAIReport}
                className="text-xs flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded transition-colors"
              >
                <FileText className="w-3 h-3" /> Log
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {!offlineAI.isModelLoaded ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-center px-4 border border-dashed border-slate-700 rounded-lg bg-slate-950/50">
                     <WifiOff className="w-8 h-8 mb-2 opacity-50" />
                     <span className="font-bold text-sm">AI Engine Offline</span>
                     <p className="text-xs mt-1">Enable "Offline AI Core" in Settings to start detection.</p>
                  </div>
              ) : detections.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-40 text-slate-600 space-y-2">
                   <CheckCircle2 className="w-8 h-8 opacity-50" />
                   <span className="text-sm">Zone Clear</span>
                   <span className="text-xs text-slate-700">Waiting for detections...</span>
                 </div>
              ) : (
                detections.map(det => {
                  const cam = cameras.find(c => c.id === det.cameraId);
                  const styles = getDetectionStyles(det.severity);
                  return (
                    <div 
                      key={det.id} 
                      onClick={() => handleCameraSelect(det.cameraId)}
                      className={`p-3 rounded-lg border text-sm relative overflow-hidden pl-4 cursor-pointer hover:bg-white/5 transition-all ${styles.card}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold text-slate-200">{det.description}</span>
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${styles.badge}`}>
                          {det.type}
                        </span>
                      </div>
                      <div className="flex justify-between items-start text-xs opacity-60 mt-2">
                        <span>{cam?.name || 'Unknown Cam'}</span>
                        <span>{new Date(det.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        </main>

        {/* --- MODALS --- */}

        {/* Report Modal */}
        {isReportOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  Incident Report
                </h3>
                <button onClick={() => setIsReportOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-950/50 font-mono text-sm leading-relaxed">
                {isGeneratingReport ? (
                  <div className="flex flex-col items-center justify-center h-48 space-y-4">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-slate-400 animate-pulse text-center">Analysing Logs with Gemini...</p>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none whitespace-pre-wrap">{reportContent}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Video Analysis Modal (New) */}
        {isVideoAnalysisOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-indigo-900/20">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ScanEye className="w-5 h-5 text-indigo-400" />
                  Gemini Pro Video Analysis
                </h3>
                <button onClick={() => setIsVideoAnalysisOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-950/50 font-mono text-sm leading-relaxed">
                {isAnalyzingVideo ? (
                  <div className="flex flex-col items-center justify-center h-48 space-y-6">
                     <div className="relative">
                       <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                       <div className="absolute inset-0 flex items-center justify-center">
                         <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
                       </div>
                     </div>
                    <div className="text-center space-y-1">
                      <p className="text-white font-bold animate-pulse">Scanning Video Sequence...</p>
                      <p className="text-slate-400 text-xs">Capturing frames • Uploading to Gemini Pro • Generating Insights</p>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none whitespace-pre-wrap">
                    <div className="bg-indigo-950/30 p-4 rounded-lg border border-indigo-500/20 mb-4 text-indigo-200 text-xs">
                       <strong>Target Model:</strong> gemini-3-pro-preview
                       <br/>
                       <strong>Input:</strong> Multi-frame sequence (3 frames @ 1s interval)
                    </div>
                    {videoAnalysisContent}
                  </div>
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
            offlineAI={offlineAI}
            onToggleOfflineAI={toggleOfflineAI}
          />
        )}

        {/* HIDDEN VIDEO PROCESSING LAYER */}
        {/* We keep all video elements mounted but only process selected ones in JS */}
        <div className="hidden">
          {cameras.map(cam => (
            <React.Fragment key={`proc-${cam.id}`}>
              <video
                ref={el => { if (el) videoRefs.current.set(cam.id, el); }}
                muted
                playsInline
                autoPlay
                width={CAMERA_WIDTH}
                height={CAMERA_HEIGHT}
                crossOrigin="anonymous" 
              />
            </React.Fragment>
          ))}
        </div>
      </div>
    </AuthGuard>
  );
}