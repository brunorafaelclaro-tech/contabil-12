const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Save a JSON object under app.getPath('userData')/<fileName>
  saveJSON: async (fileName, jsonObj) => {
    try {
      const res = await ipcRenderer.invoke('save-json', { fileName, json: jsonObj });
      return res;
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  },

  // Read a JSON file previously saved under app.getPath('userData')/<fileName>
  readJSON: async (fileName) => {
    try {
      const res = await ipcRenderer.invoke('read-json', { fileName });
      return res;
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  },

  // Return the userData path (useful for debugging)
  getUserDataPath: async () => {
    try {
      const res = await ipcRenderer.invoke('get-user-data-path');
      return res;
    } catch (err) {
      return null;
    }
  }
});