// desktop/preload.js
// Expose a minimal, safe API to the renderer via contextBridge
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('unicon', {
  // Example: expose versions for sanity checks
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});