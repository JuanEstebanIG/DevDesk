import { create } from 'zustand'
import type { CrearProyectoDatos, ProyectoDTO } from '../../../compartido/tipos'

interface EstadoApp {
  proyectos: ProyectoDTO[]
  cargandoProyectos: boolean
  errorProyectos: string | null
  cargarProyectos: () => Promise<void>
  crearProyecto: (datos: CrearProyectoDatos) => Promise<ProyectoDTO>
  eliminarProyecto: (id: number) => Promise<void>
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

  limpiarError: (): void => {
    set({ errorProyectos: null })
  }
}))
