import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Maximize, Target, Sparkles, Crosshair, ShieldAlert, Activity } from './Icons';
import { CameraDevice } from '../types';
import { VideoPlayer } from './VideoPlayer';
import { theme } from '../theme';

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

    // Hardware focus attempt
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
      setTimeout(() => setFocusComplete(false), 2000);
    }, 1800);
  }, [camera.stream, camera.status]);

  useEffect(() => {
    if (camera.status === 'online') {
      performAutoFocus();
    }
  }, [camera.status, performAutoFocus]);

  const overlayHeaderStyle: React.CSSProperties = {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    padding: '16px',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  };

  const overlayFooterStyle: React.CSSProperties = {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
    padding: '24px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
    pointerEvents: 'none'
  };

  const btnStyle: React.CSSProperties = {
    padding: '8px',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    border: '1px solid rgba(51, 65, 85, 0.5)',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#000', position: 'relative', overflow: 'hidden' }}>
      
      {/* Top Header Overlay */}
      <div style={overlayHeaderStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onBack} style={{ ...btnStyle, borderRadius: '50%' }}>
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 'bold', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              {camera.name}
              <span style={{ fontSize: 12, fontFamily: theme.fonts.mono, backgroundColor: 'rgba(59, 130, 246, 0.2)', color: theme.colors.primaryLight, padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(59, 130, 246, 0.3)', textTransform: 'uppercase' }}>Live</span>
            </h2>
            <p style={{ fontSize: 14, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.8, margin: 0 }}>{camera.location}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* AI Deep Scan Button */}
          <button 
            onClick={() => onAnalyze(camera.id)}
            style={{ ...btnStyle, backgroundColor: theme.colors.info, borderColor: 'rgba(99, 102, 241, 0.5)', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', gap: 8 }}
          >
            <Sparkles size={16} />
            <span>AI Deep Scan</span>
          </button>

          <button onClick={performAutoFocus} style={btnStyle}>
            <Target size={20} color={isFocusing ? theme.colors.primaryLight : '#fff'} />
          </button>
        </div>
      </div>

      {/* Main Video Area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        {camera.active && camera.stream ? (
          <VideoPlayer 
            stream={camera.stream} 
            style={{ 
              width: '100%', height: '100%', objectFit: 'contain',
              transition: 'all 0.7s',
              filter: isFocusing ? 'blur(2px)' : 'none',
              transform: isFocusing ? 'scale(1.01)' : 'scale(1)'
            }} 
          />
        ) : (
          <div style={{ ...theme.layout.col, alignItems: 'center', color: theme.colors.textMuted }}>
            <ShieldAlert size={80} style={{ opacity: 0.2, marginBottom: 16 }} />
            <p style={{ fontSize: 20, fontFamily: theme.fonts.mono, textTransform: 'uppercase', letterSpacing: '0.2em' }} className="animate-pulse">Establishing Secure Uplink...</p>
          </div>
        )}

        {/* AI Focus Overlay */}
        {isFocusing && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
               <Crosshair size={48} color={theme.colors.primaryLight} className="animate-spin" style={{opacity: 0.8}} />
               <span style={{ fontSize: 10, fontFamily: theme.fonts.mono, color: theme.colors.primaryLight, textTransform: 'uppercase', letterSpacing: '0.3em', fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.4)', padding: '4px 8px', borderRadius: 4 }}>AI Auto-Focusing...</span>
            </div>
          </div>
        )}

        {/* Focus Complete */}
        {focusComplete && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10, pointerEvents: 'none' }}>
            <div style={{ backgroundColor: theme.colors.successBg, border: `1px solid ${theme.colors.success}`, padding: '8px 16px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 8, backdropFilter: 'blur(4px)' }}>
              <Target size={16} color={theme.colors.success} />
              <span style={{ fontSize: 12, fontFamily: theme.fonts.mono, color: theme.colors.success, textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.1em' }}>Focus Calibrated</span>
            </div>
          </div>
        )}

        {/* Telemetry */}
        <div style={{ position: 'absolute', bottom: 24, left: 24, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: theme.fonts.mono, fontSize: 10, color: 'rgba(16, 185, 129, 0.8)', pointerEvents: 'none' }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <span>RES: 1920x1080</span>
            <span>FPS: {camera.active ? '24.2' : '0.0'}</span>
            <span>BR: 4.8Mbps</span>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <span>CODEC: H.264 High</span>
            <span>LATENCY: 42ms</span>
            <span>ENC: HARDWARE</span>
          </div>
        </div>

        {/* Risk Badge */}
        {camera.riskScore > 30 && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
            <div style={{ 
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
              padding: 32, borderRadius: '50%', 
              border: `4px solid ${camera.riskScore > 70 ? 'rgba(225, 29, 72, 0.5)' : 'rgba(245, 158, 11, 0.5)'}`,
              backgroundColor: camera.riskScore > 70 ? 'rgba(225, 29, 72, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              backdropFilter: 'blur(4px)'
            }} className="animate-pulse">
              <Activity size={48} color={camera.riskScore > 70 ? theme.colors.danger : theme.colors.warning} style={{ marginBottom: 8 }} />
              <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 24 }}>RISK: {camera.riskScore}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Overlay */}
      <div style={overlayFooterStyle}>
        <div style={{ display: 'flex', gap: 32 }}>
           <div style={theme.layout.col}>
             <span style={{ fontSize: 12, color: theme.colors.textMuted, textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 4 }}>Safety Index</span>
             <div style={{ height: 4, width: 128, backgroundColor: theme.colors.border, borderRadius: 999, overflow: 'hidden' }}>
               <div style={{ height: '100%', backgroundColor: theme.colors.primary, width: `${100 - camera.riskScore}%` }}></div>
             </div>
           </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, pointerEvents: 'auto' }}>
          <button style={{ ...btnStyle, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            <Maximize size={16} style={{ marginRight: 8 }} /> Full Screen
          </button>
        </div>
      </div>
    </div>
  );
};
