import { ipcMain, dialog, BrowserWindow } from 'electron'

export function registrarControladorDialogos(): void {
  ipcMain.handle('dialog:abrirCarpeta', async (event, rutaInicial?: string): Promise<string | null> => {
    const ventana = BrowserWindow.fromWebContents(event.sender)
    const opciones: Electron.OpenDialogOptions = {
      title: 'Seleccionar carpeta',
      defaultPath: rutaInicial || undefined,
      properties: ['openDirectory']
    }

    const resultado = ventana
      ? await dialog.showOpenDialog(ventana, opciones)
      : await dialog.showOpenDialog(opciones)

    if (resultado.canceled || resultado.filePaths.length === 0) {
      return null
    }

    return resultado.filePaths[0]
  })
}
