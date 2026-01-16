import { app, BrowserWindow } from 'electron'
import path from 'path'
let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    const indexHtml = path.join(app.getAppPath(), 'dist/index.html')
    
    win.loadFile(indexHtml).catch((e) => {
      console.error('Error cargando index.html:', e)
    })
    
    // win.webContents.openDevTools() 
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})