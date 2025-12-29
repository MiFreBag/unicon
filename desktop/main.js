// desktop/main.js
// Electron main process that runs the backend (in production) and loads the UI

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const devUrl = 'http://localhost:5174/unicon/';
  const prodUrl = 'http://localhost:3001/unicon/';
  const startUrl = isDev ? devUrl : prodUrl;

  mainWindow.loadURL(startUrl);

  // Block navigation within the window (mitigate drive-by navigations)
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());

  // Optional: open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', async () => {
  // In production, start the Express/WS server inside the Electron main process
  if (!isDev) {
    // Ensure static files are available under server/public
    // Expect that client build was copied to server/public beforehand (see desktop:pack)
    process.env.PORT = process.env.PORT || '3001';
    process.env.WS_PORT = process.env.WS_PORT || '8080';

    // Start the server; it will log ports and serve /unicon and /unicon/api
    try {
      const serverModule = require(path.join(__dirname, '../server/universal-server.js'));
      if (serverModule && typeof serverModule.startServers === 'function') {
        serverModule.startServers();
      } else {
        // fallback: require side-effect (older versions)
        require(path.join(__dirname, '../server/universal-server.js'));
      }
    } catch (e) {
      console.error('Failed to start internal server:', e);
    }
  }

  createWindow();
});

app.on('window-all-closed', () => {
  // On Windows/Linux, quit the app when all windows are closed
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
