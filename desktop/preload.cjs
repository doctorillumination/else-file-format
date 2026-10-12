'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('elseDesktop', {
  chooseFile: () => ipcRenderer.invoke('else:choose'),
  confirmDiscard: () => ipcRenderer.invoke('else:confirm-discard'),
  saveFile: (value) => ipcRenderer.invoke('else:save', value),
  viewSource: (value) => ipcRenderer.invoke('else:source', value),
  dragPDF: (value) => ipcRenderer.invoke('else:drag-pdf', value),
  pendingFile: () => ipcRenderer.invoke('else:pending'),
  onFile: (callback) => { ipcRenderer.on('else:file', (_event, value) => callback(value)); },
  onAction: (callback) => { ipcRenderer.on('else:action', (_event, value) => callback(value)); }
});
