export type TipoHealthCheck = 'http' | 'tcp' | 'none'

export type OrigenComando = 'detectado' | 'personalizado'

export interface ComandoDTO {
  id: number
  servicioId: number
  etiqueta: string
  comando: string
  origen: OrigenComando | string
  esPrincipal: boolean
}

export interface ServicioDTO {
  id: number
  nombre: string
  path: string
  tipoHealthCheck: TipoHealthCheck | string
  objetivoHealthCheck: string | null
  ordenArranque: number
  proyectoId: number
  comandos?: ComandoDTO[]
}

export interface ProyectoDTO {
  id: number
  nombre: string
  path: string
  fechaCreacion: string | Date
  servicios?: ServicioDTO[]
}

export interface CrearProyectoDatos {
  nombre: string
  path: string
}

export interface ApiElectron {
  proyectos: {
    listar: () => Promise<ProyectoDTO[]>
    crear: (datos: CrearProyectoDatos) => Promise<ProyectoDTO>
    eliminar: (id: number) => Promise<void>
  }
  dialogos: {
    abrirCarpeta: (rutaInicial?: string) => Promise<string | null>
  }
}

declare global {
  interface Window {
    api: ApiElectron
  }
}
