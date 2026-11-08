import { contextBridge, ipcRenderer } from 'electron'
import type {
  ActualizarServicioDatos,
  ApiElectron,
  ComandoDTO,
  CrearComandoPersonalizadoDatos,
  CrearProyectoDatos,
  CrearServicioDatos,
  EntradaLog,
  EstadoArranqueGrupoDTO,
  EstadoEjecucionComandoDTO,
  ProyectoDTO,
  ServicioDTO
} from '../compartido/tipos'

const api: ApiElectron = {
  proyectos: {
    listar: (): Promise<ProyectoDTO[]> => ipcRenderer.invoke('proyecto:listar'),
    obtener: (id: number): Promise<ProyectoDTO | null> =>
      ipcRenderer.invoke('proyecto:obtener', id),
    crear: (datos: CrearProyectoDatos): Promise<ProyectoDTO> =>
      ipcRenderer.invoke('proyecto:crear', datos),
    eliminar: (id: number): Promise<void> => ipcRenderer.invoke('proyecto:eliminar', id),
    iniciarGrupo: (proyectoId: number): Promise<EstadoArranqueGrupoDTO> =>
      ipcRenderer.invoke('proyecto:iniciarGrupo', proyectoId),
    detenerGrupo: (proyectoId: number): Promise<void> =>
      ipcRenderer.invoke('proyecto:detenerGrupo', proyectoId),
    onEstadoGrupo: (callback: (estado: EstadoArranqueGrupoDTO) => void): (() => void) => {
      const manejador = (
        _event: Electron.IpcRendererEvent,
        estado: EstadoArranqueGrupoDTO
      ): void => {
        callback(estado)
      }
      ipcRenderer.on('grupo:estado', manejador)
      return () => {
        ipcRenderer.removeListener('grupo:estado', manejador)
      }
    }
  },
  servicios: {
    listarPorProyecto: (proyectoId: number): Promise<ServicioDTO[]> =>
      ipcRenderer.invoke('servicio:listarPorProyecto', proyectoId),
    obtener: (id: number): Promise<ServicioDTO | null> =>
      ipcRenderer.invoke('servicio:obtener', id),
    crear: (datos: CrearServicioDatos): Promise<ServicioDTO> =>
      ipcRenderer.invoke('servicio:crear', datos),
    actualizar: (id: number, datos: ActualizarServicioDatos): Promise<ServicioDTO> =>
      ipcRenderer.invoke('servicio:actualizar', id, datos),
    eliminar: (id: number): Promise<void> => ipcRenderer.invoke('servicio:eliminar', id),
    iniciar: (servicioId: number): Promise<EstadoEjecucionComandoDTO> =>
      ipcRenderer.invoke('servicio:iniciar', servicioId),
    detener: (servicioId: number): Promise<EstadoEjecucionComandoDTO> =>
      ipcRenderer.invoke('servicio:detener', servicioId),
    reiniciar: (servicioId: number): Promise<EstadoEjecucionComandoDTO> =>
      ipcRenderer.invoke('servicio:reiniciar', servicioId)
  },
  comandos: {
    crearPersonalizado: (datos: CrearComandoPersonalizadoDatos): Promise<ComandoDTO> =>
      ipcRenderer.invoke('comando:crearPersonalizado', datos),
    establecerPrincipal: (servicioId: number, comandoId: number): Promise<ComandoDTO[]> =>
      ipcRenderer.invoke('comando:establecerPrincipal', servicioId, comandoId),
    eliminar: (comandoId: number): Promise<void> =>
      ipcRenderer.invoke('comando:eliminar', comandoId),
    ejecutar: (comandoId: number): Promise<EstadoEjecucionComandoDTO> =>
      ipcRenderer.invoke('comando:ejecutar', comandoId),
    detener: (comandoId: number): Promise<EstadoEjecucionComandoDTO> =>
      ipcRenderer.invoke('comando:detener', comandoId),
    reiniciar: (comandoId: number): Promise<EstadoEjecucionComandoDTO> =>
      ipcRenderer.invoke('comando:reiniciar', comandoId),
    obtenerEstados: (): Promise<EstadoEjecucionComandoDTO[]> =>
      ipcRenderer.invoke('comando:obtenerEstados'),
    obtenerLogs: (comandoId: number): Promise<EntradaLog[]> =>
      ipcRenderer.invoke('comando:obtenerLogs', comandoId),
    limpiarLogs: (comandoId: number): Promise<void> =>
      ipcRenderer.invoke('comando:limpiarLogs', comandoId),
    onLog: (callback: (entrada: EntradaLog) => void): (() => void) => {
      const manejador = (_event: Electron.IpcRendererEvent, entrada: EntradaLog): void => {
        callback(entrada)
      }
      ipcRenderer.on('comando:log', manejador)
      return () => {
        ipcRenderer.removeListener('comando:log', manejador)
      }
    },
    onEstado: (callback: (estado: EstadoEjecucionComandoDTO) => void): (() => void) => {
      const manejador = (
        _event: Electron.IpcRendererEvent,
        estado: EstadoEjecucionComandoDTO
      ): void => {
        callback(estado)
      }
      ipcRenderer.on('comando:estado', manejador)
      return () => {
        ipcRenderer.removeListener('comando:estado', manejador)
      }
    }
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
