import { create } from 'zustand'
import type {
  ActualizarServicioDatos,
  ComandoDTO,
  CrearComandoPersonalizadoDatos,
  CrearProyectoDatos,
  CrearServicioDatos,
  EntradaLog,
  EstadoArranqueGrupoDTO,
  EstadoEjecucionComandoDTO,
  ProyectoDTO,
  ServicioDTO
} from '../../../compartido/tipos'

const LIMITE_LOGS_UI = 1500

function ordenarServicios(servicios: ServicioDTO[]): ServicioDTO[] {
  return [...servicios].sort((a, b) => {
    if (a.ordenArranque !== b.ordenArranque) {
      return a.ordenArranque - b.ordenArranque
    }
    return a.id - b.id
  })
}

interface EstadoApp {
  proyectos: ProyectoDTO[]
  cargandoProyectos: boolean
  errorProyectos: string | null
  estadosComandos: Record<number, EstadoEjecucionComandoDTO>
  estadosGrupos: Record<number, EstadoArranqueGrupoDTO>
  logsPorComando: Record<number, EntradaLog[]>

  cargarProyectos: () => Promise<void>
  crearProyecto: (datos: CrearProyectoDatos) => Promise<ProyectoDTO>
  eliminarProyecto: (id: number) => Promise<void>
  iniciarGrupoProyecto: (proyectoId: number) => Promise<void>
  detenerGrupoProyecto: (proyectoId: number) => Promise<void>

  crearServicio: (datos: CrearServicioDatos) => Promise<ServicioDTO>
  actualizarServicio: (
    proyectoId: number,
    servicioId: number,
    datos: ActualizarServicioDatos
  ) => Promise<ServicioDTO>
  reordenarServicios: (proyectoId: number, idsServiciosEnOrden: number[]) => Promise<void>
  eliminarServicio: (proyectoId: number, servicioId: number) => Promise<void>
  iniciarServicio: (servicioId: number) => Promise<void>
  detenerServicio: (servicioId: number) => Promise<void>
  reiniciarServicio: (servicioId: number) => Promise<void>

  crearComandoPersonalizado: (
    proyectoId: number,
    datos: CrearComandoPersonalizadoDatos
  ) => Promise<ComandoDTO>
  establecerComandoPrincipal: (
    proyectoId: number,
    servicioId: number,
    comandoId: number
  ) => Promise<void>
  eliminarComando: (proyectoId: number, servicioId: number, comandoId: number) => Promise<void>
  ejecutarComando: (comandoId: number) => Promise<void>
  detenerComando: (comandoId: number) => Promise<void>
  reiniciarComando: (comandoId: number) => Promise<void>

  sincronizarEstadosComandos: () => Promise<void>
  cargarLogsDeComando: (comandoId: number) => Promise<void>
  limpiarLogsDeComando: (comandoId: number) => Promise<void>
  registrarEntradaLog: (entrada: EntradaLog) => void
  actualizarEstadoComando: (estado: EstadoEjecucionComandoDTO) => void
  actualizarEstadoGrupo: (estado: EstadoArranqueGrupoDTO) => void
  limpiarError: () => void
}

function extraerMensajeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/^Error invoking remote method '[^']+': Error:\s*/i, '')
  }
  return 'Ocurrió un error inesperado.'
}

export const useAppStore = create<EstadoApp>((set) => ({
  proyectos: [],
  cargandoProyectos: false,
  errorProyectos: null,
  estadosComandos: {},
  estadosGrupos: {},
  logsPorComando: {},

  cargarProyectos: async (): Promise<void> => {
    set({ cargandoProyectos: true, errorProyectos: null })
    try {
      const proyectos = await window.api.proyectos.listar()
      set({ proyectos, cargandoProyectos: false })
    } catch (error) {
      set({
        errorProyectos: extraerMensajeError(error),
        cargandoProyectos: false
      })
    }
  },

  crearProyecto: async (datos: CrearProyectoDatos): Promise<ProyectoDTO> => {
    set({ errorProyectos: null })
    try {
      const nuevoProyecto = await window.api.proyectos.crear(datos)
      set((estado) => ({
        proyectos: [nuevoProyecto, ...estado.proyectos]
      }))
      return nuevoProyecto
    } catch (error) {
      const mensaje = extraerMensajeError(error)
      set({ errorProyectos: mensaje })
      throw new Error(mensaje)
    }
  },

  eliminarProyecto: async (id: number): Promise<void> => {
    set({ errorProyectos: null })
    try {
      await window.api.proyectos.eliminar(id)
      set((estado) => ({
        proyectos: estado.proyectos.filter((proyecto) => proyecto.id !== id)
      }))
    } catch (error) {
      const mensaje = extraerMensajeError(error)
      set({ errorProyectos: mensaje })
      throw new Error(mensaje)
    }
  },

  iniciarGrupoProyecto: async (proyectoId: number): Promise<void> => {
    set({ errorProyectos: null })
    try {
      const resultado = await window.api.proyectos.iniciarGrupo(proyectoId)
      set((estado) => ({
        estadosGrupos: {
          ...estado.estadosGrupos,
          [proyectoId]: resultado
        },
        errorProyectos: resultado.errorMensaje ?? estado.errorProyectos
      }))
    } catch (error) {
      const mensaje = extraerMensajeError(error)
      set({ errorProyectos: mensaje })
      throw new Error(mensaje)
    }
  },

  detenerGrupoProyecto: async (proyectoId: number): Promise<void> => {
    set({ errorProyectos: null })
    try {
      await window.api.proyectos.detenerGrupo(proyectoId)
    } catch (error) {
      const mensaje = extraerMensajeError(error)
      set({ errorProyectos: mensaje })
      throw new Error(mensaje)
    }
  },

  crearServicio: async (datos: CrearServicioDatos): Promise<ServicioDTO> => {
    set({ errorProyectos: null })
    try {
      const nuevoServicio = await window.api.servicios.crear(datos)
      const listaActualizada = await window.api.servicios.listarPorProyecto(datos.proyectoId)
      set((estado) => ({
        proyectos: estado.proyectos.map((proyecto) =>
          proyecto.id === datos.proyectoId
            ? {
                ...proyecto,
                servicios: ordenarServicios(listaActualizada)
              }
            : proyecto
        )
      }))
      return nuevoServicio
    } catch (error) {
      const mensaje = extraerMensajeError(error)
      set({ errorProyectos: mensaje })
      throw new Error(mensaje)
    }
  },

  actualizarServicio: async (
    proyectoId: number,
    servicioId: number,
    datos: ActualizarServicioDatos
  ): Promise<ServicioDTO> => {
    set({ errorProyectos: null })
    try {
      const actualizado = await window.api.servicios.actualizar(servicioId, datos)
      const listaActualizada = await window.api.servicios.listarPorProyecto(proyectoId)
      set((estado) => ({
        proyectos: estado.proyectos.map((proyecto) =>
          proyecto.id === proyectoId
            ? {
                ...proyecto,
                servicios: ordenarServicios(listaActualizada)
              }
            : proyecto
        )
      }))
      return actualizado
    } catch (error) {
      const mensaje = extraerMensajeError(error)
      set({ errorProyectos: mensaje })
      throw new Error(mensaje)
    }
  },

  reordenarServicios: async (
    proyectoId: number,
    idsServiciosEnOrden: number[]
  ): Promise<void> => {
    set({ errorProyectos: null })
    try {
      const listaActualizada = await window.api.servicios.reordenar(
        proyectoId,
        idsServiciosEnOrden
      )
      set((estado) => ({
        proyectos: estado.proyectos.map((proyecto) =>
          proyecto.id === proyectoId
            ? {
                ...proyecto,
                servicios: ordenarServicios(listaActualizada)
              }
            : proyecto
        )
      }))
    } catch (error) {
      const mensaje = extraerMensajeError(error)
      set({ errorProyectos: mensaje })
      throw new Error(mensaje)
    }
  },

  eliminarServicio: async (proyectoId: number, servicioId: number): Promise<void> => {
    set({ errorProyectos: null })
    try {
      await window.api.servicios.eliminar(servicioId)
      const listaActualizada = await window.api.servicios.listarPorProyecto(proyectoId)
      set((estado) => ({
        proyectos: estado.proyectos.map((proyecto) =>
          proyecto.id === proyectoId
            ? {
                ...proyecto,
                servicios: ordenarServicios(listaActualizada)
              }
            : proyecto
        )
      }))
    } catch (error) {
      const mensaje = extraerMensajeError(error)
      set({ errorProyectos: mensaje })
      throw new Error(mensaje)
    }
  },

  iniciarServicio: async (servicioId: number): Promise<void> => {
    set({ errorProyectos: null })
    try {
      const estadoEjecucion = await window.api.servicios.iniciar(servicioId)
      set((estado) => ({
        estadosComandos: {
          ...estado.estadosComandos,
          [estadoEjecucion.comandoId]: estadoEjecucion
        }
      }))
    } catch (error) {
      const mensaje = extraerMensajeError(error)
      set({ errorProyectos: mensaje })
      throw new Error(mensaje)
    }
  },

  detenerServicio: async (servicioId: number): Promise<void> => {
    set({ errorProyectos: null })
    try {
      const estadoEjecucion = await window.api.servicios.detener(servicioId)
      set((estado) => ({
        estadosComandos: {
          ...estado.estadosComandos,
          [estadoEjecucion.comandoId]: estadoEjecucion
        }
      }))
    } catch (error) {
      const mensaje = extraerMensajeError(error)
      set({ errorProyectos: mensaje })
      throw new Error(mensaje)
    }
  },

  reiniciarServicio: async (servicioId: number): Promise<void> => {
    set({ errorProyectos: null })
    try {
      const estadoEjecucion = await window.api.servicios.reiniciar(servicioId)
      set((estado) => ({
        estadosComandos: {
          ...estado.estadosComandos,
          [estadoEjecucion.comandoId]: estadoEjecucion
        }
      }))
    } catch (error) {
      const mensaje = extraerMensajeError(error)
      set({ errorProyectos: mensaje })
      throw new Error(mensaje)
    }
  },

  crearComandoPersonalizado: async (
    proyectoId: number,
    datos: CrearComandoPersonalizadoDatos
  ): Promise<ComandoDTO> => {
    set({ errorProyectos: null })
    try {
      const nuevoComando = await window.api.comandos.crearPersonalizado(datos)
      const servicioActualizado = await window.api.servicios.obtener(datos.servicioId)
      if (servicioActualizado) {
        set((estado) => ({
          proyectos: estado.proyectos.map((proyecto) =>
            proyecto.id === proyectoId
              ? {
                  ...proyecto,
                  servicios: (proyecto.servicios ?? []).map((srv) =>
                    srv.id === datos.servicioId ? servicioActualizado : srv
                  )
                }
              : proyecto
          )
        }))
      }
      return nuevoComando
    } catch (error) {
      const mensaje = extraerMensajeError(error)
      set({ errorProyectos: mensaje })
      throw new Error(mensaje)
    }
  },

  establecerComandoPrincipal: async (
    proyectoId: number,
    servicioId: number,
    comandoId: number
  ): Promise<void> => {
    set({ errorProyectos: null })
    try {
      const comandosActualizados = await window.api.comandos.establecerPrincipal(
        servicioId,
        comandoId
      )
      set((estado) => ({
        proyectos: estado.proyectos.map((proyecto) =>
          proyecto.id === proyectoId
            ? {
                ...proyecto,
                servicios: (proyecto.servicios ?? []).map((srv) =>
                  srv.id === servicioId ? { ...srv, comandos: comandosActualizados } : srv
                )
              }
            : proyecto
        )
      }))
    } catch (error) {
      const mensaje = extraerMensajeError(error)
      set({ errorProyectos: mensaje })
      throw new Error(mensaje)
    }
  },

  eliminarComando: async (
    proyectoId: number,
    servicioId: number,
    comandoId: number
  ): Promise<void> => {
    set({ errorProyectos: null })
    try {
      await window.api.comandos.eliminar(comandoId)
      const servicioActualizado = await window.api.servicios.obtener(servicioId)
      set((estado) => ({
        proyectos: estado.proyectos.map((proyecto) =>
          proyecto.id === proyectoId
            ? {
                ...proyecto,
                servicios: (proyecto.servicios ?? []).map((srv) =>
                  srv.id === servicioId && servicioActualizado ? servicioActualizado : srv
                )
              }
            : proyecto
        )
      }))
    } catch (error) {
      const mensaje = extraerMensajeError(error)
      set({ errorProyectos: mensaje })
      throw new Error(mensaje)
    }
  },

  ejecutarComando: async (comandoId: number): Promise<void> => {
    set({ errorProyectos: null })
    try {
      const estadoEjecucion = await window.api.comandos.ejecutar(comandoId)
      set((estado) => ({
        estadosComandos: {
          ...estado.estadosComandos,
          [comandoId]: estadoEjecucion
        }
      }))
    } catch (error) {
      const mensaje = extraerMensajeError(error)
      set({ errorProyectos: mensaje })
      throw new Error(mensaje)
    }
  },

  detenerComando: async (comandoId: number): Promise<void> => {
    set({ errorProyectos: null })
    try {
      const estadoEjecucion = await window.api.comandos.detener(comandoId)
      set((estado) => ({
        estadosComandos: {
          ...estado.estadosComandos,
          [comandoId]: estadoEjecucion
        }
      }))
    } catch (error) {
      const mensaje = extraerMensajeError(error)
      set({ errorProyectos: mensaje })
      throw new Error(mensaje)
    }
  },

  reiniciarComando: async (comandoId: number): Promise<void> => {
    set({ errorProyectos: null })
    try {
      const estadoEjecucion = await window.api.comandos.reiniciar(comandoId)
      set((estado) => ({
        estadosComandos: {
          ...estado.estadosComandos,
          [comandoId]: estadoEjecucion
        }
      }))
    } catch (error) {
      const mensaje = extraerMensajeError(error)
      set({ errorProyectos: mensaje })
      throw new Error(mensaje)
    }
  },

  sincronizarEstadosComandos: async (): Promise<void> => {
    try {
      const lista = await window.api.comandos.obtenerEstados()
      const mapa: Record<number, EstadoEjecucionComandoDTO> = {}
      for (const item of lista) {
        mapa[item.comandoId] = item
      }
      set({ estadosComandos: mapa })
    } catch {
      // Ignorar si aún no está listo
    }
  },

  cargarLogsDeComando: async (comandoId: number): Promise<void> => {
    try {
      const entradas = await window.api.comandos.obtenerLogs(comandoId)
      set((estado) => ({
        logsPorComando: {
          ...estado.logsPorComando,
          [comandoId]: entradas
        }
      }))
    } catch {
      // Ignorar errores de carga inicial de logs
    }
  },

  limpiarLogsDeComando: async (comandoId: number): Promise<void> => {
    await window.api.comandos.limpiarLogs(comandoId)
    set((estado) => ({
      logsPorComando: {
        ...estado.logsPorComando,
        [comandoId]: []
      }
    }))
  },

  registrarEntradaLog: (entrada: EntradaLog): void => {
    set((estado) => {
      const actuales = estado.logsPorComando[entrada.comandoId] ?? []
      const nuevos = [...actuales, entrada]
      if (nuevos.length > LIMITE_LOGS_UI) {
        nuevos.splice(0, nuevos.length - LIMITE_LOGS_UI)
      }
      return {
        logsPorComando: {
          ...estado.logsPorComando,
          [entrada.comandoId]: nuevos
        }
      }
    })
  },

  actualizarEstadoComando: (estadoEjecucion: EstadoEjecucionComandoDTO): void => {
    set((estado) => ({
      estadosComandos: {
        ...estado.estadosComandos,
        [estadoEjecucion.comandoId]: estadoEjecucion
      }
    }))
  },

  actualizarEstadoGrupo: (estadoGrupo: EstadoArranqueGrupoDTO): void => {
    set((estado) => ({
      estadosGrupos: {
        ...estado.estadosGrupos,
        [estadoGrupo.proyectoId]: estadoGrupo
      },
      errorProyectos: estadoGrupo.errorMensaje ?? estado.errorProyectos
    }))
  },

  limpiarError: (): void => {
    set({ errorProyectos: null })
  }
}))
