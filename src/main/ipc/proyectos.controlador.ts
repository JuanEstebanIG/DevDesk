import { ipcMain } from 'electron'
import * as proyectosServicio from '../servicios/proyectos.servicio'
import * as serviciosServicio from '../servicios/servicios.servicio'
import type { CrearProyectoDatos } from '../../compartido/tipos'

export function registrarControladorProyectos(): void {
  ipcMain.handle('proyecto:listar', async () => {
    return await proyectosServicio.listarProyectos()
  })

  ipcMain.handle('proyecto:obtener', async (_event, id: number) => {
    return await proyectosServicio.obtenerProyectoPorId(id)
  })

  ipcMain.handle('proyecto:crear', async (_event, datos: CrearProyectoDatos) => {
    return await proyectosServicio.crearProyecto(datos)
  })

  ipcMain.handle('proyecto:eliminar', async (_event, id: number) => {
    await proyectosServicio.eliminarProyecto(id)
  })

  ipcMain.handle(
    'proyecto:iniciarGrupo',
    async (_event, proyectoId: number, servicioIdsSeleccionados?: number[]) => {
      return await serviciosServicio.iniciarGrupoProyecto(proyectoId, servicioIdsSeleccionados)
    }
  )

  ipcMain.handle('proyecto:detenerGrupo', async (_event, proyectoId: number) => {
    await serviciosServicio.detenerGrupoProyecto(proyectoId)
  })
}
