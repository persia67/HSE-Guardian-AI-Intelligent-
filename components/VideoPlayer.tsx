import React, { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  stream?: MediaStream;
  className?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ stream, className }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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