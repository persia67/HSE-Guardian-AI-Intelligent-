export interface Detection {
  id: string;
  type: 'ppe' | 'behavior' | 'geofence' | 'fall';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  bbox?: { x: number; y: number; w: number; h: number };
  timestamp: number;
  cameraId: string;
}

export interface CameraDevice {
  id: string;
  name: string;
  location: string;
  active: boolean;
  stream?: MediaStream;
  riskScore: number;
  lastDetection?: number;
  fps: number;
  status: 'online' | 'offline' | 'processing';
}

export interface SafetyScore {
  overall: number;
  ppe: number;
  behavior: number;
  environment: number;
}
