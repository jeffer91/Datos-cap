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
    selectVideo: () => ipcRenderer.invoke('dialog:selectVideo'),
    openPath: (targetPath) => ipcRenderer.invoke('fileSystem:openPath', targetPath)
  },

  videoImport: {
    getOptions: () => ipcRenderer.invoke('videoImport:getOptions'),
    importVideo: (payload) => ipcRenderer.invoke('videoImport:importVideo', payload),
    listRecentVideos: (limit = 10) => ipcRenderer.invoke('videoImport:listRecentVideos', limit),
    getVideo: (localId) => ipcRenderer.invoke('videoImport:getVideo', localId)
  },

  mediaProcessing: {
    processVideo: (payload) => ipcRenderer.invoke('mediaProcessing:processVideo', payload),
    diagnostic: () => ipcRenderer.invoke('mediaProcessing:diagnostic')
  },

  library: {
    getSummary: () => ipcRenderer.invoke('library:getSummary'),
    listAnalyses: (payload = {}) => ipcRenderer.invoke('library:listAnalyses', payload),
    listVideos: (payload = {}) => ipcRenderer.invoke('library:listVideos', payload),
    getAnalysisDetails: (analysisLocalId) => ipcRenderer.invoke('library:getAnalysisDetails', analysisLocalId),
    getRecentActivity: (limit = 8) => ipcRenderer.invoke('library:getRecentActivity', limit)
  },

  comparison: {
    listAnalyses: (limit = 50) => ipcRenderer.invoke('comparison:listAnalyses', limit),
    compare: (payload = {}) => ipcRenderer.invoke('comparison:compare', payload),
    diagnostic: () => ipcRenderer.invoke('comparison:diagnostic')
  },

  templates: {
    createMaster: (payload = {}) => ipcRenderer.invoke('templates:createMaster', payload),
    list: (payload = {}) => ipcRenderer.invoke('templates:list', payload),
    get: (localId) => ipcRenderer.invoke('templates:get', localId),
    diagnostic: () => ipcRenderer.invoke('templates:diagnostic')
  }
});
