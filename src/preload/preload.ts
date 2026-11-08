import { contextBridge, ipcRenderer } from 'electron'
import type { ApiElectron, CrearProyectoDatos, ProyectoDTO } from '../compartido/tipos'

const api: ApiElectron = {
  proyectos: {
    listar: (): Promise<ProyectoDTO[]> => ipcRenderer.invoke('proyecto:listar'),
    crear: (datos: CrearProyectoDatos): Promise<ProyectoDTO> =>
      ipcRenderer.invoke('proyecto:crear', datos),
    eliminar: (id: number): Promise<void> => ipcRenderer.invoke('proyecto:eliminar', id)
  },
  dialogos: {
    abrirCarpeta: (rutaInicial?: string): Promise<string | null> =>
      ipcRenderer.invoke('dialog:abrirCarpeta', rutaInicial)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
