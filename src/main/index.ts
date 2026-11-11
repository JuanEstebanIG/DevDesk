import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registrarControladorProyectos } from './ipc/proyectos.controlador'
import { registrarControladorServicios } from './ipc/servicios.controlador'
import { registrarControladorComandos } from './ipc/comandos.controlador'
import { registrarControladorDialogos } from './ipc/dialogos.controlador'
import { gestorProcesos } from './servicios/gestorProcesos.servicio'

function crearVentana(): void {
  const ventanaPrincipal = new BrowserWindow({
    width: 1240,
    height: 820,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#14171c',
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
  registrarControladorServicios()
  registrarControladorComandos()
  registrarControladorDialogos()

  crearVentana()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana()
  })
})

let cerrandoProcesos = false

app.on('before-quit', (evento) => {
  if (cerrandoProcesos) return
  evento.preventDefault()
  cerrandoProcesos = true
  gestorProcesos.detenerTodosLosProcesos().finally(() => {
    app.quit()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
