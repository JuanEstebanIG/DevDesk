import { ipcMain } from 'electron'
import * as proyectosServicio from '../servicios/proyectos.servicio'
import type { CrearProyectoDatos } from '../../compartido/tipos'

export function registrarControladorProyectos(): void {
  ipcMain.handle('proyecto:listar', async () => {
    return await proyectosServicio.listarProyectos()
  })

  ipcMain.handle('proyecto:crear', async (_event, datos: CrearProyectoDatos) => {
    return await proyectosServicio.crearProyecto(datos)
  })

  ipcMain.handle('proyecto:eliminar', async (_event, id: number) => {
    await proyectosServicio.eliminarProyecto(id)
  })
}
