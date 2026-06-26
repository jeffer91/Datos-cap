const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('videoAuditor', {
  app: {
    name: 'Video Auditor App',
    version: '0.1.0',
    mode: 'local-electron',

    initialize: () => ipcRenderer.invoke('app:initialize'),
    getStatus: () => ipcRenderer.invoke('app:getStatus'),
    diagnostic: () => ipcRenderer.invoke('app:diagnostic'),
    getConfig: () => ipcRenderer.invoke('app:getConfig')
  },

  system: {
    ping: () => ipcRenderer.invoke('app:ping')
  },

  fileSystem: {
    selectVideo: () => ipcRenderer.invoke('dialog:selectVideo')
  },

  videoImport: {
    getOptions: () => ipcRenderer.invoke('videoImport:getOptions'),
    importVideo: (payload) => ipcRenderer.invoke('videoImport:importVideo', payload),
    listRecentVideos: (limit = 10) =>
      ipcRenderer.invoke('videoImport:listRecentVideos', limit),
    getVideo: (localId) => ipcRenderer.invoke('videoImport:getVideo', localId)
  },

  mediaProcessing: {
    processVideo: (payload) =>
      ipcRenderer.invoke('mediaProcessing:processVideo', payload),
    diagnostic: () => ipcRenderer.invoke('mediaProcessing:diagnostic')
  }
});
