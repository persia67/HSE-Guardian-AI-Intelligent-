import React, { useState, useEffect } from 'react';
import { X, RefreshCw, HardDrive, Globe, Plus, Camera, Trash2, Key, Save, Check, ShieldAlert } from 'lucide-react';
import { CameraDevice } from '../types';

interface CameraSetupModalProps {
  cameras: CameraDevice[];
  onUpdateCameras: (cameras: CameraDevice[]) => void;
  onClose: () => void;
}

export const CameraSetupModal: React.FC<CameraSetupModalProps> = ({ cameras, onUpdateCameras, onClose }) => {
  const [activeTab, setActiveTab] = useState<'local' | 'network' | 'settings'>('local');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [ipForm, setIpForm] = useState({ name: '', location: '', url: '' });
  
  // API Key State
  const [apiKey, setApiKey] = useState('');
  const [isKeySaved, setIsKeySaved] = useState(false);

  // Load initial data
  useEffect(() => {
    refreshDevices();
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  // Scan for local hardware
  const refreshDevices = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      console.warn("Media Devices API not supported in this environment");
      return;
    }

    try {
      // 1. Enumerate first to see if any video devices exist
      let devices = await navigator.mediaDevices.enumerateDevices();
      const hasVideoInput = devices.some(d => d.kind === 'videoinput');

      // 2. Only request permissions if we detect video inputs
      // This prevents "Requested device not found" error when no camera exists
      if (hasVideoInput) {
        try {
          // Request permission to get labels
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          // Stop stream immediately as we only needed permissions
          stream.getTracks().forEach(t => t.stop());
          
          // Re-enumerate to get devices with labels
          devices = await navigator.mediaDevices.enumerateDevices();
        } catch (permErr: any) {
          // Gracefully handle permission denial or device access errors
          console.warn("Camera permission denied or device inaccessible:", permErr.message);
        }
      }

      const videoInputs = devices.filter(d => d.kind === 'videoinput');
      setAvailableDevices(videoInputs);
    } catch (err) {
      console.warn("Error enumerating devices:", err);
    }
  };

  const addLocalDevice = (device: MediaDeviceInfo) => {
    const newCam: CameraDevice = {
      id: `local-${device.deviceId.substring(0, 8)}`,
      name: device.label || `USB Camera ${availableDevices.indexOf(device) + 1}`,
      location: 'Local Hardware',
      active: false,
      riskScore: 0,
      fps: 0,
      status: 'offline',
      connectionType: 'local',
      deviceId: device.deviceId
    };
    onUpdateCameras([newCam, ...cameras]);
  };

  const addIpCamera = () => {
    if (!ipForm.url) return;
    const newCam: CameraDevice = {
      id: `ip-${Date.now()}`,
      name: ipForm.name || 'IP Camera',
      location: ipForm.location || 'Remote',
      active: true, // Auto active for IP
      riskScore: 0,
      fps: 0,
      status: 'online',
      connectionType: 'network',
      streamUrl: ipForm.url
    };
    onUpdateCameras([newCam, ...cameras]);
    setIpForm({ name: '', location: '', url: '' });
  };

  const removeCamera = (id: string) => {
    onUpdateCameras(cameras.filter(c => c.id !== id));
  };

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('gemini_api_key', apiKey.trim());
      setIsKeySaved(true);
      setTimeout(() => setIsKeySaved(false), 2000);
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h3 className="text-xl font-bold text-white">System Configuration</h3>
            <p className="text-sm text-slate-400">Manage hardware inputs, networks, and AI settings</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab('local')}
            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'local' ? 'border-blue-500 text-blue-500 bg-blue-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <HardDrive className="w-4 h-4" /> Local Hardware
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'network' ? 'border-purple-500 text-purple-500 bg-purple-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Globe className="w-4 h-4" /> Network / IP
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === 'settings' ? 'border-amber-500 text-amber-500 bg-amber-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            <Key className="w-4 h-4" /> AI Settings
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-950/50">
          {activeTab === 'local' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <div>
                  <h4 className="font-bold text-white">Available Video Inputs</h4>
                  <p className="text-xs text-slate-400">Scan for Webcams, Capture Cards, and HDMI Inputs</p>
                </div>
                <button 
                  onClick={refreshDevices}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> Rescan Hardware
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableDevices.map((device, idx) => (
                  <div key={device.deviceId} className="bg-slate-900 border border-slate-700 p-4 rounded-xl flex items-center justify-between group hover:border-blue-500/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-800 p-2 rounded-lg text-slate-400 group-hover:text-blue-400">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-white truncate max-w-[200px]">{device.label || `Device ${idx + 1}`}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{device.deviceId.substring(0, 12)}...</div>
                      </div>
                    </div>
                    {cameras.some(c => c.deviceId === device.deviceId) ? (
                      <span className="text-xs text-emerald-500 font-bold px-3 py-1 bg-emerald-500/10 rounded-full">ADDED</span>
                    ) : (
                      <button 
                        onClick={() => addLocalDevice(device)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    )}
                  </div>
                ))}
                {availableDevices.length === 0 && (
                  <div className="col-span-full py-8 text-center text-slate-500 bg-slate-900/50 border border-dashed border-slate-700 rounded-xl">
                    <p>No local camera devices found.</p>
                    <p className="text-xs mt-1">Check connections or use Network Streams.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'network' && (
            <div className="space-y-6">
              <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-4">
                <h4 className="font-bold text-white">Add IP Camera</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Camera Name (e.g., Gate 1)"
                    value={ipForm.name}
                    onChange={e => setIpForm({...ipForm, name: e.target.value})}
                    className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                  <input
                    type="text"
                    placeholder="Location"
                    value={ipForm.location}
                    onChange={e => setIpForm({...ipForm, location: e.target.value})}
                    className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                  <input
                    type="text"
                    placeholder="Stream URL (http://.../mjpeg)"
                    value={ipForm.url}
                    onChange={e => setIpForm({...ipForm, url: e.target.value})}
                    className="col-span-1 md:col-span-2 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 font-mono text-sm"
                  />
                </div>
                <div className="flex justify-end">
                   <button 
                    onClick={addIpCamera}
                    disabled={!ipForm.url}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg flex items-center gap-2"
                   >
                     <Plus className="w-4 h-4" /> Add Stream
                   </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="bg-amber-500/10 p-3 rounded-xl">
                    <Key className="w-8 h-8 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-white text-lg">Google Gemini API Configuration</h4>
                    <p className="text-slate-400 text-sm mt-1">
                      Enter your Gemini API key to enable AI reporting and analysis. This key will be stored locally in your browser.
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">API Key</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white font-mono focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                    />
                    <button
                      onClick={saveApiKey}
                      className={`px-6 rounded-lg font-bold flex items-center gap-2 transition-all ${
                        isKeySaved 
                          ? 'bg-emerald-600 text-white' 
                          : 'bg-amber-600 hover:bg-amber-500 text-white'
                      }`}
                    >
                      {isKeySaved ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                      {isKeySaved ? 'Saved' : 'Save Key'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-blue-900/20 border border-blue-500/20 rounded-lg text-blue-300 text-xs mt-2">
                   <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                   <p>Your API key is stored securely in LocalStorage. Clear your browser cache to remove it.</p>
                </div>
              </div>
            </div>
          )}
          
          {activeTab !== 'settings' && (
            <div className="mt-8">
              <h4 className="font-bold text-white mb-4">Configured Cameras ({cameras.length})</h4>
              <div className="grid grid-cols-1 gap-2">
                {cameras.map((cam, idx) => (
                  <div key={cam.id} className="flex items-center justify-between bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-600 w-6">{idx + 1}</span>
                      <div>
                        <div className="font-bold text-sm text-slate-200">{cam.name}</div>
                        <div className="text-xs text-slate-500 flex gap-2">
                          <span>{cam.location}</span>
                          <span className="text-slate-600">•</span>
                          <span className="uppercase">{cam.connectionType}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeCamera(cam.id)}
                      className="text-slate-500 hover:text-rose-500 p-2 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};