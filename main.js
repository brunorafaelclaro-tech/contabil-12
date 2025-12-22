const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    autoHideMenuBar: true
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers to read/write JSON under app.getPath('userData')
ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('save-json', async (_, { fileName, json }) => {
  try {
    const base = app.getPath('userData');
    const filePath = path.join(base, fileName);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(json), 'utf8');
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});

ipcMain.handle('read-json', async (_, { fileName }) => {
  try {
    const base = app.getPath('userData');
    const filePath = path.join(base, fileName);
    const content = await fs.readFile(filePath, 'utf8');
    return { ok: true, json: JSON.parse(content), filePath };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
});