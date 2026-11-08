import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registrarControladorProyectos } from './ipc/proyectos.controlador'
import { registrarControladorDialogos } from './ipc/dialogos.controlador'

function crearVentana(): void {
  const ventanaPrincipal = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      sandbox: false
    }
  })

  ventanaPrincipal.on('ready-to-show', () => {
    ventanaPrincipal.show()
  })

  ventanaPrincipal.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    ventanaPrincipal.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    ventanaPrincipal.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.devdesk.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registrarControladorProyectos()
  registrarControladorDialogos()

  crearVentana()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
