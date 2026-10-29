const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petApi', {
  load: () => ipcRenderer.invoke('load'),
  save: data => ipcRenderer.send('save', data),
  saveSync: data => ipcRenderer.sendSync('save-sync', data),
  setIgnore: ignore => ipcRenderer.send('ignore', ignore),
  focus: () => ipcRenderer.send('focus'),
  state: st => ipcRenderer.send('state', st),
  menu: st => ipcRenderer.send('menu', st),
  trayIcon: dataUrl => ipcRenderer.send('tray-icon', dataUrl),
  sprite: key => ipcRenderer.invoke('sprite', key),
  aiStatus: () => ipcRenderer.invoke('ai-status'),
  aiSetKey: key => ipcRenderer.invoke('ai-set-key', key),
  aiClearKey: () => ipcRenderer.invoke('ai-clear-key'),
  aiChat: req => ipcRenderer.invoke('ai-chat', req),
  onAction: cb => ipcRenderer.on('action', (_e, id) => cb(id)),
  onCursor: cb => ipcRenderer.on('cursor', (_e, pt) => cb(pt))
});
