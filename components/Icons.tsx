
import React from 'react';

const IconBase = ({ d, size = 24, color = 'currentColor', className = '' }: any) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke={color} 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
    className={className}
  >
    {Array.isArray(d) ? d.map((path, i) => <path key={i} d={path} />) : <path d={d} />}
  </svg>
);

export const Shield = (props: any) => <IconBase d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" {...props} />;
export const ShieldCheck = (props: any) => <IconBase d={["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10", "m9 12 2 2 4-4"]} {...props} />;
export const ShieldAlert = (props: any) => <IconBase d={["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10", "M12 8v4", "M12 16h.01"]} {...props} />;
export const Play = (props: any) => <IconBase d="M5 3l14 9-14 9V3z" {...props} />;
export const Pause = (props: any) => <IconBase d={["M6 4h4v16H6z", "M14 4h4v16h-4z"]} {...props} />;
export const Grid = (props: any) => <IconBase d={["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"]} {...props} />;
export const Maximize2 = (props: any) => <IconBase d={["M15 3h6v6", "M9 21H3v-6", "M21 3l-7 7", "M3 21l7-7"]} {...props} />;
export const AlertTriangle = (props: any) => <IconBase d={["M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z", "M12 9v4", "M12 17h.01"]} {...props} />;
export const AlertCircle = (props: any) => <IconBase d={["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10", "M12 8v4", "M12 16h.01"]} {...props} />;
export const Activity = (props: any) => <IconBase d="M22 12h-4l-3 9L9 3l-3 9H2" {...props} />;
export const CheckCircle2 = (props: any) => <IconBase d={["M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z", "m9 12 2 2 4-4"]} {...props} />;
export const FileText = (props: any) => <IconBase d={["M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z", "M14 2v6h6", "M16 13H8", "M16 17H8", "M10 9H8"]} {...props} />;
export const X = (props: any) => <IconBase d={["M18 6L6 18", "M6 6l12 12"]} {...props} />;
export const Loader2 = (props: any) => <IconBase d="M21 12a9 9 0 1 1-6.219-8.56" className="animate-spin" {...props} />;
export const Settings2 = (props: any) => <IconBase d={["M17 19H3", "M21 5H9", "M13 5a3 3 0 1 0-6 0", "M17 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6"]} {...props} />;
export const WifiOff = (props: any) => <IconBase d={["M2 2l20 20", "M8.5 16.5a5 5 0 0 1 7 0", "M2 8.82a15 15 0 0 1 4.17-2.66", "M1.42 9l13.41 13.41"]} {...props} />;
export const Camera = (props: any) => <IconBase d={["M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z", "M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"]} {...props} />;
export const Sparkles = (props: any) => <IconBase d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" {...props} />;
export const ScanEye = (props: any) => <IconBase d={["M3 7V5a2 2 0 0 1 2-2h2", "M17 3h2a2 2 0 0 1 2 2v2", "M21 17v2a2 2 0 0 1-2 2h-2", "M7 21H5a2 2 0 0 1-2-2v-2", "M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6", "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7"]} {...props} />;
export const ChevronLeft = (props: any) => <IconBase d="M15 18l-6-6 6-6" {...props} />;
export const ChevronRight = (props: any) => <IconBase d="M9 18l6-6-6-6" {...props} />;
export const Lock = (props: any) => <IconBase d={["M16 11V7a4 4 0 0 0-8 0v4", "M5 11h14v10H5z"]} {...props} />;
export const Fingerprint = (props: any) => <IconBase d={["M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 6", "M5 16v-2a7 7 0 0 1 14 0v2", "M8 11v1a4 4 0 0 0 8 0v-1", "M12 18v2"]} {...props} />;
export const HardDrive = (props: any) => <IconBase d={["M22 12H2", "M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z", "M6 16h.01", "M10 16h.01"]} {...props} />;
export const Globe = (props: any) => <IconBase d={["M2 12h20", "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z", "M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10z"]} {...props} />;
export const Plus = (props: any) => <IconBase d={["M12 5v14", "M5 12h14"]} {...props} />;
export const Trash2 = (props: any) => <IconBase d={["M3 6h18", "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"]} {...props} />;
export const Key = (props: any) => <IconBase d={["M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"]} {...props} />;
export const Save = (props: any) => <IconBase d={["M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v13a2 2 0 0 1-2 2z", "M17 21v-8H7v8", "M7 3v5h8"]} {...props} />;
export const Check = (props: any) => <IconBase d="M20 6L9 17l-5-5" {...props} />;
export const Cpu = (props: any) => <IconBase d={["M5 16V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z", "M9 9h6v6H9z", "M12 2v2", "M12 20v2", "M2 12h2", "M20 12h2"]} {...props} />;
export const Download = (props: any) => <IconBase d={["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"]} {...props} />;
export const RefreshCw = (props: any) => <IconBase d={["M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5", "M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16", "M16 21h5v-5"]} {...props} />;
export const MonitorOff = (props: any) => <IconBase d={["M2 2l20 20", "M10 20h4", "M12 17v3", "M17 17H7", "M2 8l3 3", "M19 8l2-2"]} {...props} />;
export const Info = (props: any) => <IconBase d={["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10", "M12 8v4", "M12 16h.01"]} {...props} />;
export const Target = (props: any) => <IconBase d={["M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z", "M12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4z"]} {...props} />;
export const Crosshair = (props: any) => <IconBase d={["M12 2v4", "M12 18v4", "M2 12h4", "M18 12h4", "M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0"]} {...props} />;
export const Maximize = (props: any) => <IconBase d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" {...props} />;
