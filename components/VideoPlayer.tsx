import React, { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  stream?: MediaStream;
  streamUrl?: string;
  className?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ stream, streamUrl, className }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Handle Network Stream (MJPEG/Image source)
  if (streamUrl) {
    // Basic implementation for MJPEG streams often used in IP cams via HTTP
    return (
      <img 
        src={streamUrl} 
        className={className} 
        alt="Live Stream"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }} 
      />
    );
  }

  return (
    <video
      ref={videoRef}
      className={className}
      autoPlay
      muted
      playsInline
    />
  );
};