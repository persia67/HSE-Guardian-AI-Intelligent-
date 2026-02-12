import React, { memo } from 'react';
import { Camera, AlertTriangle, MonitorOff, Globe, Loader2, WifiOff } from './Icons';
import { CameraDevice } from '../types';
import { VideoPlayer } from './VideoPlayer';
import { theme } from '../theme';

interface CameraGridProps {
  cameras: CameraDevice[];
  visibleCameras: CameraDevice[];
  onCameraSelect: (id: string) => void;
  selectedCamera: string;
}

const CameraCard = memo(({ 
  cam, 
  isSelected, 
  onSelect 
}: { 
  cam: CameraDevice; 
  isSelected: boolean; 
  onSelect: (id: string) => void;
}) => {
  
  const cardStyle: React.CSSProperties = {
    position: 'relative',
    aspectRatio: '16/9',
    backgroundColor: theme.colors.panel,
    borderRadius: '12px',
    overflow: 'hidden',
    cursor: 'pointer',
    border: isSelected ? `2px solid ${theme.colors.primary}` : `2px solid ${theme.colors.border}`,
    boxShadow: isSelected ? `0 0 10px ${theme.colors.primary}33` : 'none',
    transition: 'all 0.3s ease',
    opacity: cam.status === 'no-hardware' ? 0.6 : 1,
    filter: cam.status === 'no-hardware' ? 'grayscale(100%)' : 'none',
    width: '100%',
    minWidth: '300px',
    flex: '1 1 300px',
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000'
  };

  const infoOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.6), transparent)',
    padding: '12px',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const getStatusColor = (status: CameraDevice['status']) => {
    switch (status) {
      case 'online': return theme.colors.success;
      case 'processing': return theme.colors.info;
      case 'connecting': return theme.colors.warning;
      case 'no-hardware': return theme.colors.textMuted;
      case 'offline': return theme.colors.danger;
      default: return theme.colors.textMuted;
    }
  };

  const statusColor = getStatusColor(cam.status);

  return (
    <div onClick={() => onSelect(cam.id)} style={cardStyle}>
      {/* Video Preview */}
      <div style={overlayStyle}>
        {cam.status === 'online' ? (
           cam.connectionType === 'network' && cam.streamUrl ? (
             <VideoPlayer streamUrl={cam.streamUrl} />
           ) : cam.stream ? (
             <VideoPlayer stream={cam.stream} />
           ) : (
             <div style={{...theme.layout.col, alignItems: 'center', color: theme.colors.warning}}>
               <Loader2 size={40} className="animate-spin" style={{marginBottom: 8}} />
               <span style={{fontSize: 12}}>Stream Loading...</span>
             </div>
           )
        ) : cam.status === 'connecting' ? (
           <div style={{...theme.layout.col, alignItems: 'center', color: theme.colors.warning}}>
             <Loader2 size={40} className="animate-spin" style={{marginBottom: 8}} />
             <span style={{fontSize: 10, fontWeight: 'bold', letterSpacing: '0.2em', textTransform: 'uppercase'}}>Connecting</span>
           </div>
        ) : cam.status === 'processing' ? (
           <div style={{...theme.layout.col, alignItems: 'center', color: theme.colors.info}}>
             <Loader2 size={40} className="animate-spin" style={{marginBottom: 8}} />
             <span style={{fontSize: 10, fontWeight: 'bold', letterSpacing: '0.2em', textTransform: 'uppercase'}}>Processing</span>
           </div>
        ) : cam.status === 'no-hardware' ? (
          <div style={{...theme.layout.col, alignItems: 'center', color: theme.colors.danger, opacity: 0.5}}>
            <MonitorOff size={40} style={{marginBottom: 8}} />
            <span style={{fontSize: 10, fontWeight: 'bold', letterSpacing: '0.2em', textTransform: 'uppercase'}}>No Hardware</span>
          </div>
        ) : (
          <div style={{...theme.layout.col, alignItems: 'center', color: theme.colors.textMuted}}>
            {cam.connectionType === 'network' ? <Globe size={40} style={{marginBottom: 8}} /> : <Camera size={40} style={{marginBottom: 8}} />}
            <span style={{fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase'}}>Offline</span>
          </div>
        )}
      </div>

      {/* Camera Info Overlay */}
      <div style={infoOverlayStyle}>
        <div style={{ overflow: 'hidden' }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>{cam.name}</p>
          <p style={{ fontSize: 12, color: theme.colors.textMuted, margin: 0 }}>{cam.location}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {cam.riskScore > 30 && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 4,
              backgroundColor: theme.colors.dangerBg,
              color: theme.colors.danger,
              padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 'bold', border: `1px solid ${theme.colors.danger}44`
            }}>
              RISK {cam.riskScore}
            </span>
          )}
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            backgroundColor: statusColor,
            boxShadow: cam.status === 'online' ? `0 0 10px ${statusColor}` : 
                       cam.status === 'connecting' || cam.status === 'processing' ? `0 0 10px ${statusColor}` : 'none',
            animation: cam.status === 'connecting' || cam.status === 'processing' ? 'pulse 1s infinite' : 'none'
          }} title={`Status: ${cam.status}`} />
        </div>
      </div>

      {/* Risk Indicator */}
      {cam.riskScore > 70 && cam.status !== 'no-hardware' && cam.status !== 'offline' && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
          backgroundColor: 'rgba(127, 29, 29, 0.8)',
          padding: 6, borderRadius: 8,
          border: '1px solid rgba(239, 68, 68, 0.5)',
          backdropFilter: 'blur(4px)',
          animation: 'bounce 1s infinite'
        }}>
          <AlertTriangle size={20} color={theme.colors.danger} />
        </div>
      )}
    </div>
  );
});

CameraCard.displayName = 'CameraCard';

export const CameraGrid: React.FC<CameraGridProps> = ({
  visibleCameras,
  onCameraSelect,
  selectedCamera
}) => {
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      justifyContent: 'flex-start',
      width: '100%'
    }}>
      {visibleCameras.map(cam => (
        <CameraCard
          key={cam.id}
          cam={cam}
          isSelected={selectedCamera === cam.id}
          onSelect={onCameraSelect}
        />
      ))}
    </div>
  );
};
