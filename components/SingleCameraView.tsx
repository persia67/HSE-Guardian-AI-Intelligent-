import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Info, Maximize, Settings, ShieldAlert, Activity, Crosshair, Target, Sparkles } from 'lucide-react';
import { CameraDevice } from '../types';
import { VideoPlayer } from './VideoPlayer';

interface SingleCameraViewProps {
  camera: CameraDevice;
  onBack: () => void;
  onAnalyze: (cameraId: string) => void;
}

export const SingleCameraView: React.FC<SingleCameraViewProps> = ({ camera, onBack, onAnalyze }) => {
  const [isFocusing, setIsFocusing] = useState(false);
  const [focusComplete, setFocusComplete] = useState(false);

  const performAutoFocus = useCallback(async () => {
    if (!camera.stream || camera.status !== 'online') return;

    setIsFocusing(true);
    setFocusComplete(false);

    // Hardware focus attempt (if supported by the browser and device)
    const videoTrack = camera.stream.getVideoTracks()[0];
    if (videoTrack && typeof videoTrack.applyConstraints === 'function') {
      try {
        const capabilities = videoTrack.getCapabilities() as any;
        if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
          await videoTrack.applyConstraints({
            advanced: [{ focusMode: 'continuous' }] as any
          });
        }
      } catch (err) {
        console.warn('Hardware focus adjustment not supported or failed:', err);
      }
    }

    // Visual focus simulation sequence
    setTimeout(() => {
      setIsFocusing(false);
      setFocusComplete(true);
      // Clear the "Focus Complete" flash after 2 seconds
      setTimeout(() => setFocusComplete(false), 2000);
    }, 1800);
  }, [camera.stream, camera.status]);

  useEffect(() => {
    if (camera.status === 'online') {
      performAutoFocus();
    }
  }, [camera.status, performAutoFocus]);

  return (
    <div className="flex flex-col h-full bg-black relative group overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      {/* Top Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 rounded-full text-white transition-colors border border-slate-700/50"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-white leading-tight flex items-center gap-2">
                {camera.name}
                <span className="text-xs font-mono bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded border border-blue-500/30 uppercase">Live</span>
              </h2>
              <p className="text-sm text-slate-300 uppercase tracking-widest opacity-80">{camera.location}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end mr-4">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Stream Health</span>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className={`w-1 h-3 rounded-full ${i <= 4 ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                ))}
              </div>
            </div>
            
            {/* AI Deep Scan Button */}
            <button 
              onClick={() => onAnalyze(camera.id)}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg border border-indigo-400/50 shadow-lg shadow-indigo-900/20 transition-all font-bold text-xs uppercase tracking-wider"
              title="Analyze Video with Gemini Pro"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Deep Scan</span>
            </button>

            <button 
              onClick={performAutoFocus}
              className={`p-2 bg-slate-800/80 hover:bg-slate-700 rounded-lg text-white border border-slate-700/50 transition-all ${isFocusing ? 'animate-pulse text-blue-400' : ''}`}
              title="Manual Re-focus"
            >
              <Target className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 relative flex items-center justify-center">
        {camera.active && camera.stream ? (
          <VideoPlayer 
            stream={camera.stream} 
            className={`w-full h-full object-contain transition-all duration-700 ${isFocusing ? 'blur-[2px] scale-[1.01]' : 'blur-0 scale-100'}`} 
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-700">
            <ShieldAlert className="w-20 h-20 mb-4 opacity-20" />
            <p className="text-xl font-mono uppercase tracking-widest animate-pulse">Establishing Secure Uplink...</p>
          </div>
        )}

        {/* AI Focus Overlay UI */}
        {isFocusing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-blue-500/30 rounded-lg animate-ping"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-blue-400/50 rounded-lg animate-[pulse_1s_infinite]"></div>
              <div className="flex flex-col items-center gap-2">
                <Crosshair className="w-12 h-12 text-blue-400 animate-spin-slow opacity-80" />
                <span className="text-[10px] font-mono text-blue-400 uppercase tracking-[0.3em] font-bold bg-black/40 px-2 py-1 backdrop-blur-sm rounded">
                  AI Auto-Focusing...
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Focus Complete Indicator */}
        {focusComplete && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none animate-out fade-out duration-1000">
            <div className="bg-emerald-500/20 border border-emerald-500/50 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <Target className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-mono text-emerald-400 uppercase font-bold tracking-widest">Focus Calibrated</span>
            </div>
          </div>
        )}

        {/* Telemetry Overlays */}
        <div className="absolute bottom-6 left-6 flex flex-col gap-2 font-mono text-[10px] text-emerald-400/80 pointer-events-none">
          <div className="flex gap-4">
            <span>RES: 1920x1080</span>
            <span>FPS: {camera.active ? '24.2' : '0.0'}</span>
            <span>BR: 4.8Mbps</span>
          </div>
          <div className="flex gap-4">
            <span>CODEC: H.264 High</span>
            <span>LATENCY: 42ms</span>
            <span>ENC: HARDWARE</span>
          </div>
        </div>

        {/* Center Risk Badge */}
        {camera.riskScore > 30 && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className={`flex flex-col items-center justify-center p-8 rounded-full border-4 ${
              camera.riskScore > 70 ? 'border-rose-500/50 bg-rose-500/10' : 'border-amber-500/50 bg-amber-500/10'
            } backdrop-blur-sm animate-pulse`}>
              <Activity className={`w-12 h-12 mb-2 ${camera.riskScore > 70 ? 'text-rose-500' : 'text-amber-500'}`} />
              <span className="text-white font-bold text-2xl">RISK: {camera.riskScore}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer Overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-6 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-between pointer-events-none">
        <div className="flex gap-8">
           <div className="flex flex-col">
             <span className="text-xs text-slate-500 uppercase font-bold mb-1">Safety Index</span>
             <div className="h-1 w-32 bg-slate-800 rounded-full overflow-hidden">
               <div className="h-full bg-blue-500" style={{ width: `${100 - camera.riskScore}%` }}></div>
             </div>
           </div>
        </div>
        
        <div className="flex items-center gap-4 pointer-events-auto">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-800 transition-colors text-xs font-bold uppercase tracking-wider">
            <Maximize className="w-4 h-4" /> Full Screen
          </button>
        </div>
      </div>
    </div>
  );
};