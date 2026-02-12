import React, { useEffect, useRef, memo } from 'react';

interface VideoPlayerProps {
  stream?: MediaStream;
  streamUrl?: string;
  style?: React.CSSProperties;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = memo(({ stream, streamUrl, style }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const commonStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    ...style
  };

  // Handle Network Stream (MJPEG/Image source)
  if (streamUrl) {
    return (
      <img 
        src={streamUrl} 
        alt="Live Stream"
        style={commonStyle}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }} 
      />
    );
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      style={commonStyle}
    />
  );
});

VideoPlayer.displayName = 'VideoPlayer';
