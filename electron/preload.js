const { contextBridge, ipcRenderer } = require('electron');

/**
 * SECURITY: Context Bridge
 * Expose only specific, safe methods to the renderer process.
 * Do NOT expose the entire 'ipcRenderer' or 'fs' module.
 */

contextBridge.exposeInMainWorld('electronAPI', {
  // Example: simple safe notification
  sendAlert: (message) => ipcRenderer.send('app-alert', message),
  
  // Method to get app version securely
  getAppVersion: () => process.env.npm_package_version || '2.4.1-desktop',
  
  // Check if running in Electron
  isElectron: true
});

// Prevent drag and drop of files (prevent replacing the app UI with a dropped file)
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());