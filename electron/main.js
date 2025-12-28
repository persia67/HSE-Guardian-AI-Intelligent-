/**
 * Electron Main Process
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  let mainWindow;

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 720,
      minWidth: 1024,
      minHeight: 768,
      backgroundColor: '#020617', // Match slate-950
      title: 'HSE Guardian AI',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    });

    // Remove menu bar for kiosk-like feel
    mainWindow.setMenuBarVisibility(false);

    // Load the app
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
  }

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}