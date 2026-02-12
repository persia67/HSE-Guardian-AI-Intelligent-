import React, { useState, useEffect } from 'react';
import { X, RefreshCw, HardDrive, Globe, Plus, Camera, Trash2, Cpu, Download, WifiOff, Check, AlertCircle } from './Icons';
import { CameraDevice, OfflineAIState } from '../types';
import { theme } from '../theme';

interface CameraSetupModalProps {
  cameras: CameraDevice[];
  onUpdateCameras: (cameras: CameraDevice[]) => void;
  onClose: () => void;
  offlineAI: OfflineAIState;
  onToggleOfflineAI: (enable: boolean) => void;
}

export const CameraSetupModal: React.FC<CameraSetupModalProps> = ({ 
  cameras, 
  onUpdateCameras, 
  onClose,
  offlineAI,
  onToggleOfflineAI
}) => {
  const [activeTab, setActiveTab] = useState<'local' | 'network' | 'settings'>('local');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [ipForm, setIpForm] = useState({ name: '', location: '', url: '' });

  useEffect(() => {
    refreshDevices();
  }, []);

  const refreshDevices = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideoInput = devices.some(d => d.kind === 'videoinput');
      if (hasVideoInput && devices.some(d => d.label === '')) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(t => t.stop());
          devices = await navigator.mediaDevices.enumerateDevices();
        } catch (e) { console.warn(e); }
      }
      setAvailableDevices(devices.filter(d => d.kind === 'videoinput'));
    } catch (err) { console.warn(err); }
  };

  const addLocalDevice = (device: MediaDeviceInfo) => {
    onUpdateCameras([{
      id: `local-${device.deviceId.substring(0, 8)}`,
      name: device.label || `USB Camera`,
      location: 'Local Hardware',
      active: false, riskScore: 0, fps: 0, status: 'offline', connectionType: 'local', deviceId: device.deviceId
    }, ...cameras]);
  };

  const addIpCamera = () => {
    if (!ipForm.url) return;
    onUpdateCameras([{
      id: `ip-${Date.now()}`,
      name: ipForm.name || 'IP Camera',
      location: ipForm.location || 'Remote',
      active: true, riskScore: 0, fps: 0, status: 'online', connectionType: 'network', streamUrl: ipForm.url
    }, ...cameras]);
    setIpForm({ name: '', location: '', url: '' });
  };

  const removeCamera = (id: string) => onUpdateCameras(cameras.filter(c => c.id !== id));
  
  const inputStyle: React.CSSProperties = {
    backgroundColor: theme.colors.bg,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: 8,
    padding: '8px 16px',
    color: '#fff',
    outline: 'none',
    width: '100%',
    marginBottom: 8,
    fontFamily: theme.fonts.mono
  };

  const buttonStyle = (primary = false, disabled = false) => ({
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 12, fontWeight: 'bold',
    backgroundColor: disabled ? theme.colors.border : (primary ? theme.colors.primary : theme.colors.border),
    color: disabled ? theme.colors.textMuted : '#fff',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', gap: 8
  });

  const tabStyle = (isActive: boolean) => ({
    flex: 1, padding: 16,
    border: 'none', borderBottom: `2px solid ${isActive ? theme.colors.primary : 'transparent'}`,
    backgroundColor: isActive ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
    color: isActive ? theme.colors.primary : theme.colors.textMuted,
    fontWeight: 'bold', textTransform: 'uppercase' as const, fontSize: 14,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}>
      <div style={{ backgroundColor: theme.colors.panel, border: `1px solid ${theme.colors.border}`, width: '100%', maxWidth: 896, borderRadius: 12, display: 'flex', flexDirection: 'column', maxHeight: '85vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        
        {/* Header */}
        <div style={{ ...theme.layout.flexBetween, padding: 24, borderBottom: `1px solid ${theme.colors.border}` }}>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 'bold', color: '#fff', margin: 0 }}>System Configuration</h3>
            <p style={{ fontSize: 14, color: theme.colors.textMuted, margin: '4px 0 0 0' }}>Manage hardware inputs, networks, and AI settings</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: theme.colors.textMuted, cursor: 'pointer' }}><X size={24} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${theme.colors.border}` }}>
          <button onClick={() => setActiveTab('local')} style={tabStyle(activeTab === 'local')}><HardDrive size={16} /> Local Hardware</button>
          <button onClick={() => setActiveTab('network')} style={tabStyle(activeTab === 'network')}><Globe size={16} /> Network / IP</button>
          <button onClick={() => setActiveTab('settings')} style={tabStyle(activeTab === 'settings')}><Cpu size={16} /> AI Core</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, backgroundColor: 'rgba(2, 6, 23, 0.5)' }}>
          {activeTab === 'local' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ ...theme.layout.flexBetween, padding: 16, backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: 8, border: `1px solid ${theme.colors.border}` }}>
                <div><h4 style={{ margin: 0, fontWeight: 'bold' }}>Available Video Inputs</h4></div>
                <button onClick={refreshDevices} style={buttonStyle()}><RefreshCw size={16} /> Rescan</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {availableDevices.map((device, idx) => (
                  <div key={device.deviceId} style={{ ...theme.layout.flexBetween, padding: 16, backgroundColor: theme.colors.panel, borderRadius: 12, border: `1px solid ${theme.colors.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Camera size={24} color={theme.colors.textMuted} />
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: 14 }}>{device.label || `Device ${idx + 1}`}</div>
                        <div style={{ fontSize: 10, fontFamily: theme.fonts.mono, color: theme.colors.textMuted }}>{device.deviceId.substring(0, 12)}...</div>
                      </div>
                    </div>
                    <button onClick={() => addLocalDevice(device)} style={buttonStyle(true)}><Plus size={12} /> Add</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'network' && (
            <div style={{ padding: 24, backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: 12, border: `1px solid ${theme.colors.border}` }}>
               <h4 style={{ margin: '0 0 16px 0', fontWeight: 'bold' }}>Add IP Camera</h4>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                 <input type="text" placeholder="Name" value={ipForm.name} onChange={e => setIpForm({...ipForm, name: e.target.value})} style={inputStyle} />
                 <input type="text" placeholder="Location" value={ipForm.location} onChange={e => setIpForm({...ipForm, location: e.target.value})} style={inputStyle} />
                 <input type="text" placeholder="Stream URL" value={ipForm.url} onChange={e => setIpForm({...ipForm, url: e.target.value})} style={inputStyle} />
               </div>
               <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                 <button onClick={addIpCamera} style={{...buttonStyle(), backgroundColor: 'purple'}}><Plus size={16} /> Add Stream</button>
               </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Local AI Management */}
              <div style={{ padding: 24, backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: 12, border: `1px solid ${theme.colors.border}` }}>
                 <div style={{ display: 'flex', gap: 16 }}>
                   <div style={{ padding: 12, borderRadius: '50%', backgroundColor: 'rgba(37, 99, 235, 0.1)', height: 'fit-content' }}>
                     <Cpu size={32} color={theme.colors.primary} />
                   </div>
                   <div style={{ flex: 1 }}>
                     <h4 style={{ margin: 0, fontWeight: 'bold', fontSize: 18 }}>Local AI Engine (WebGPU)</h4>
                     <p style={{ margin: '4px 0 16px 0', fontSize: 14, color: theme.colors.textMuted }}>
                       This system uses the <b>Phi-3.5 Vision</b> model running entirely on your GPU. No internet required for analysis.
                     </p>
                     
                     <div style={{ ...theme.layout.flexBetween, marginTop: 16, padding: 16, backgroundColor: theme.colors.panel, borderRadius: 8, border: `1px solid ${theme.colors.border}` }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                         {offlineAI.isModelLoaded ? <Check size={24} color={theme.colors.success} /> : <Download size={24} color={theme.colors.textMuted} />}
                         <div>
                           <div style={{ fontWeight: 'bold', fontSize: 14 }}>{offlineAI.isModelLoaded ? 'Model Ready' : 'Model Not Loaded'}</div>
                           <div style={{ fontSize: 12, color: theme.colors.textMuted }}>{offlineAI.isModelLoaded ? offlineAI.modelName : 'Requires ~2GB Download'}</div>
                         </div>
                       </div>
                       <button 
                        onClick={() => onToggleOfflineAI(!offlineAI.isModelLoaded)} 
                        disabled={offlineAI.isLoading || offlineAI.isModelLoaded}
                        style={buttonStyle(!offlineAI.isModelLoaded, offlineAI.isLoading || offlineAI.isModelLoaded)}
                       >
                         {offlineAI.isLoading ? 'Downloading...' : offlineAI.isModelLoaded ? 'Active' : 'Load Model'}
                       </button>
                     </div>

                     {/* Progress Bar */}
                     {offlineAI.isLoading && (
                       <div style={{ marginTop: 16 }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                           <span>{offlineAI.loadingText}</span>
                           <span>{Math.round(offlineAI.progress)}%</span>
                         </div>
                         <div style={{ height: 6, width: '100%', backgroundColor: theme.colors.border, borderRadius: 999, overflow: 'hidden' }}>
                           <div style={{ height: '100%', backgroundColor: theme.colors.primary, width: `${offlineAI.progress}%`, transition: 'width 0.2s' }}></div>
                         </div>
                       </div>
                     )}

                     {!offlineAI.isModelLoaded && !offlineAI.isLoading && (
                       <div style={{ display: 'flex', gap: 8, marginTop: 12, fontSize: 12, color: theme.colors.warning }}>
                         <AlertCircle size={16} />
                         <span>First load requires internet to cache the model. Subsequent loads are offline.</span>
                       </div>
                     )}
                   </div>
                 </div>
              </div>

               {/* Object Detection Core */}
               <div style={{ padding: 24, backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: 12, border: `1px solid ${theme.colors.border}` }}>
                 <div style={{ display: 'flex', gap: 16 }}>
                   <div style={{ padding: 12, borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', height: 'fit-content' }}>
                     <WifiOff size={32} color={theme.colors.success} />
                   </div>
                   <div style={{ flex: 1 }}>
                     <h4 style={{ margin: 0, fontWeight: 'bold' }}>Lightweight Detection (COCO-SSD)</h4>
                     <p style={{ margin: '4px 0', fontSize: 14, color: theme.colors.textMuted }}>Always-on lightweight model for person and vehicle detection.</p>
                     <div style={{ marginTop: 8, display: 'inline-block', padding: '4px 8px', borderRadius: 4, backgroundColor: theme.colors.successBg, color: theme.colors.success, fontSize: 12, fontWeight: 'bold' }}>
                       AUTO-LOADED
                     </div>
                   </div>
                 </div>
              </div>

            </div>
          )}

          {activeTab !== 'settings' && (
            <div style={{ marginTop: 32 }}>
              <h4 style={{ fontWeight: 'bold', marginBottom: 16 }}>Configured Cameras ({cameras.length})</h4>
              {cameras.map((cam, idx) => (
                <div key={cam.id} style={{ ...theme.layout.flexBetween, padding: 12, backgroundColor: theme.colors.panel, borderRadius: 8, marginBottom: 8, border: `1px solid ${theme.colors.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontFamily: theme.fonts.mono, color: theme.colors.textMuted }}>{idx + 1}</span>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: 14 }}>{cam.name}</div>
                      <div style={{ fontSize: 12, color: theme.colors.textMuted }}>{cam.location} • {cam.connectionType.toUpperCase()}</div>
                    </div>
                  </div>
                  <button onClick={() => removeCamera(cam.id)} style={{ background: 'none', border: 'none', color: theme.colors.textMuted, cursor: 'pointer' }}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
