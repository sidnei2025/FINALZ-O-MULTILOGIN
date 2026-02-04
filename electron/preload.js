const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nebulaAPI', {
  launchProfile: (profile, customBrowserPath) => ipcRenderer.invoke('launch-profile', profile, customBrowserPath),
  launchProfileNative: (profile, customBrowserPath) => ipcRenderer.invoke('launch-profile-native', profile, customBrowserPath),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openPopup: (url, partition) => ipcRenderer.invoke('open-popup', { url, partition }),
  checkProxy: (proxy) => ipcRenderer.invoke('check-proxy', proxy),
  deleteProfileFolder: (profileId) => ipcRenderer.invoke('delete-profile-folder', profileId),
  setCookies: (cookies, partition) => ipcRenderer.invoke('set-cookies', { cookies, partition }),
  getCookies: (partition) => ipcRenderer.invoke('get-cookies', { partition }),
  setProxy: (proxy, partition) => ipcRenderer.invoke('set-proxy', { proxy, partition }),
  // Sincronização de sessão via Cloud
  captureSession: (profileId, targetUrl) => ipcRenderer.invoke('capture-session', { profileId, targetUrl }),
  injectSession: (profileId, sessionData, targetUrl) => ipcRenderer.invoke('inject-session', { profileId, sessionData, targetUrl }),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_event, value) => callback(value)),
  platform: process.platform
});