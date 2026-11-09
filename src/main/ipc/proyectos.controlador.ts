import { ipcMain } from 'electron'
import * as proyectosServicio from '../servicios/proyectos.servicio'
import * as serviciosServicio from '../servicios/servicios.servicio'
import type { ActualizarProyectoDatos, CrearProyectoDatos } from '../../compartido/tipos'

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

  ipcMain.handle(
    'proyecto:actualizar',
    async (_event, id: number, datos: ActualizarProyectoDatos) => {
      return await proyectosServicio.actualizarProyecto(id, datos)
    }
  )

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

  ipcMain.handle('proyecto:abrirVsCode', async (_event, rutaCarpeta: string) => {
    await proyectosServicio.abrirCarpetaEnVsCode(rutaCarpeta)
  })

  ipcMain.handle('proyecto:abrirUrlExterna', async (_event, url: string) => {
    await proyectosServicio.abrirUrlEnNavegador(url)
  })
}
