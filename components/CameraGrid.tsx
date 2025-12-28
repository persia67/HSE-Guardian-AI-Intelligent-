import React from 'react';
import { Camera, AlertTriangle } from 'lucide-react';
import { CameraDevice } from '../types';
import { VideoPlayer } from './VideoPlayer';

interface CameraGridProps {
  cameras: CameraDevice[];
  visibleCameras: CameraDevice[];
  onCameraSelect: (id: string) => void;
  selectedCamera: string;
}

export const CameraGrid: React.FC<CameraGridProps> = ({
  visibleCameras,
  onCameraSelect,
  selectedCamera
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {visibleCameras.map(cam => (
        <div
          key={cam.id}
          onClick={() => onCameraSelect(cam.id)}
          className={`relative aspect-video bg-slate-900 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 border-2 group ${
            selectedCamera === cam.id ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-slate-800 hover:border-slate-600'
          } ${cam.riskScore > 50 ? 'animate-pulse-danger' : ''}`}
        >
          {/* Video Preview */}
          <div className="absolute inset-0 flex items-center justify-center">
            {cam.active && cam.stream ? (
              <div className="w-full h-full bg-black">
                <VideoPlayer stream={cam.stream} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-600 group-hover:text-slate-500 transition-colors">
                <Camera className="w-10 h-10 mb-2" />
                <span className="text-xs uppercase tracking-wider font-semibold">Signal Lost</span>
              </div>
            )}
          </div>

          {/* Camera Info Overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 backdrop-blur-[2px]">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate shadow-black drop-shadow-md">{cam.name}</p>
                <p className="text-xs text-slate-300 truncate shadow-black drop-shadow-md">{cam.location}</p>
              </div>
              <div className="flex items-center gap-2">
                {cam.riskScore > 30 && (
                  <span className="flex items-center gap-1 bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded text-[10px] font-bold border border-red-500/30">
                    RISK {cam.riskScore}
                  </span>
                )}
                <div className={`w-2.5 h-2.5 rounded-full shadow-lg ${
                  cam.status === 'online' ? 'bg-emerald-500 shadow-emerald-500/50' :
                  cam.status === 'processing' ? 'bg-amber-500 animate-pulse' :
                  'bg-rose-500'
                }`} />
              </div>
            </div>
          </div>

          {/* Risk Indicator */}
          {cam.riskScore > 70 && (
            <div className="absolute top-2 right-2 bg-red-900/80 p-1.5 rounded-lg border border-red-500/50 backdrop-blur-sm animate-bounce">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};