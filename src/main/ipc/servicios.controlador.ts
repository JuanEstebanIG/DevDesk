import { ipcMain } from 'electron'
import * as serviciosServicio from '../servicios/servicios.servicio'
import type { ActualizarServicioDatos, CrearServicioDatos } from '../../compartido/tipos'

export function registrarControladorServicios(): void {
  ipcMain.handle('servicio:listarPorProyecto', async (_event, proyectoId: number) => {
    return await serviciosServicio.listarServiciosPorProyecto(proyectoId)
  })

  ipcMain.handle('servicio:obtener', async (_event, id: number) => {
    return await serviciosServicio.obtenerServicioPorId(id)
  })

  ipcMain.handle('servicio:detectarComandos', (_event, rutaCarpeta: string) => {
    return serviciosServicio.previsualizarComandosEnCarpeta(rutaCarpeta)
  })

  ipcMain.handle('servicio:crear', async (_event, datos: CrearServicioDatos) => {
    return await serviciosServicio.crearServicio(datos)
  })

  ipcMain.handle(
    'servicio:actualizar',
    async (_event, id: number, datos: ActualizarServicioDatos) => {
      return await serviciosServicio.actualizarServicio(id, datos)
    }
  )

  ipcMain.handle(
    'servicio:reordenar',
    async (_event, proyectoId: number, idsServiciosEnOrden: number[]) => {
      return await serviciosServicio.reordenarServicios(proyectoId, idsServiciosEnOrden)
    }
  )

  ipcMain.handle('servicio:eliminar', async (_event, id: number) => {
    await serviciosServicio.eliminarServicio(id)
  })

  ipcMain.handle('servicio:iniciar', async (_event, servicioId: number) => {
    return await serviciosServicio.iniciarServicioPrincipal(servicioId)
  })

  ipcMain.handle('servicio:detener', async (_event, servicioId: number) => {
    return await serviciosServicio.detenerServicioPrincipal(servicioId)
  })

  ipcMain.handle('servicio:reiniciar', async (_event, servicioId: number) => {
    return await serviciosServicio.reiniciarServicioPrincipal(servicioId)
  })
}
