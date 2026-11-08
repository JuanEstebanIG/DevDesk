import { ipcMain } from 'electron'
import * as serviciosServicio from '../servicios/servicios.servicio'
import { gestorProcesos } from '../servicios/gestorProcesos.servicio'
import type { CrearComandoPersonalizadoDatos } from '../../compartido/tipos'

export function registrarControladorComandos(): void {
  ipcMain.handle(
    'comando:crearPersonalizado',
    async (_event, datos: CrearComandoPersonalizadoDatos) => {
      return await serviciosServicio.crearComandoPersonalizado(datos)
    }
  )

  ipcMain.handle(
    'comando:establecerPrincipal',
    async (_event, servicioId: number, comandoId: number) => {
      return await serviciosServicio.establecerComandoPrincipal(servicioId, comandoId)
    }
  )

  ipcMain.handle('comando:eliminar', async (_event, comandoId: number) => {
    await serviciosServicio.eliminarComando(comandoId)
  })

  ipcMain.handle('comando:ejecutar', async (_event, comandoId: number) => {
    return await gestorProcesos.iniciarProceso(comandoId)
  })

  ipcMain.handle('comando:detener', async (_event, comandoId: number) => {
    return await gestorProcesos.detenerProceso(comandoId)
  })

  ipcMain.handle('comando:reiniciar', async (_event, comandoId: number) => {
    return await gestorProcesos.reiniciarProceso(comandoId)
  })

  ipcMain.handle('comando:obtenerEstados', () => {
    return gestorProcesos.obtenerEstadosActuales()
  })

  ipcMain.handle('comando:obtenerLogs', (_event, comandoId: number) => {
    return gestorProcesos.obtenerLogsDeComando(comandoId)
  })

  ipcMain.handle('comando:limpiarLogs', (_event, comandoId: number) => {
    gestorProcesos.limpiarLogsDeComando(comandoId)
  })
}
