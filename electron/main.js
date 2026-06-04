/**
 * Electron 主进程 — 用于打包 Windows exe
 * 开发：npm install && npm start
 * 打包：npm run dist
 */
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;
const ROOT = path.join(__dirname, '..');

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 560,
    title: '简谱工作室',
    backgroundColor: '#f4f1ea',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  win.loadFile(path.join(ROOT, 'index.html'));

  win.webContents.setWindowOpenHandler(function (details) {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(function () {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
