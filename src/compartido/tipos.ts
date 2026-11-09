export type TipoHealthCheck = 'http' | 'tcp' | 'none'

export type OrigenComando = 'detectado' | 'personalizado'

export type EstadoEjecucion = 'detenido' | 'iniciando' | 'listo' | 'error'

export type TipoFlujoLog = 'stdout' | 'stderr' | 'sistema'

export interface EntradaLog {
  id: string
  comandoId: number
  servicioId: number
  flujo: TipoFlujoLog
  texto: string
  marcaTiempo: string
}

export interface EstadoEjecucionComandoDTO {
  comandoId: number
  servicioId: number
  pid: number | null
  estado: EstadoEjecucion
  ultimoError?: string | null
}

export interface EstadoArranqueGrupoDTO {
  proyectoId: number
  enCurso: boolean
  servicioActualId: number | null
  servicioActualNombre: string | null
  pasoActual: number
  totalPasos: number
  errorMensaje: string | null
}

export interface ComandoDetectadoPrevioDTO {
  etiqueta: string
  comando: string
  esPrincipalSugerido: boolean
}

export interface EventoLogComando {
  entrada: EntradaLog
}

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
  abrirVsCodeAlIniciar?: boolean
  abrirNavegadorAlIniciar?: boolean
  urlAperturaAuto?: string | null
  servicios?: ServicioDTO[]
}

export interface CrearProyectoDatos {
  nombre: string
  path: string
  abrirVsCodeAlIniciar?: boolean
  abrirNavegadorAlIniciar?: boolean
  urlAperturaAuto?: string | null
}

export interface ActualizarProyectoDatos {
  nombre?: string
  abrirVsCodeAlIniciar?: boolean
  abrirNavegadorAlIniciar?: boolean
  urlAperturaAuto?: string | null
}

export interface CrearServicioDatos {
  proyectoId: number
  nombre: string
  path: string
  tipoHealthCheck?: TipoHealthCheck
  objetivoHealthCheck?: string | null
  ordenArranque?: number
  etiquetaPrincipalSeleccionada?: string | null
  comandoManualPrincipal?: {
    etiqueta: string
    comando: string
  } | null
}

export interface ActualizarServicioDatos {
  nombre?: string
  path?: string
  tipoHealthCheck?: TipoHealthCheck
  objetivoHealthCheck?: string | null
  ordenArranque?: number
  comandoPrincipalId?: number
  comandoManualPrincipal?: {
    etiqueta: string
    comando: string
  } | null
}

export interface CrearComandoPersonalizadoDatos {
  servicioId: number
  etiqueta: string
  comando: string
  esPrincipal?: boolean
}

export interface ApiElectron {
  proyectos: {
    listar: () => Promise<ProyectoDTO[]>
    obtener: (id: number) => Promise<ProyectoDTO | null>
    crear: (datos: CrearProyectoDatos) => Promise<ProyectoDTO>
    actualizar: (id: number, datos: ActualizarProyectoDatos) => Promise<ProyectoDTO>
    eliminar: (id: number) => Promise<void>
    iniciarGrupo: (
      proyectoId: number,
      servicioIdsSeleccionados?: number[]
    ) => Promise<EstadoArranqueGrupoDTO>
    detenerGrupo: (proyectoId: number) => Promise<void>
    abrirVsCode: (rutaCarpeta: string) => Promise<void>
    abrirUrlExterna: (url: string) => Promise<void>
    onEstadoGrupo: (callback: (estado: EstadoArranqueGrupoDTO) => void) => () => void
  }
  servicios: {
    listarPorProyecto: (proyectoId: number) => Promise<ServicioDTO[]>
    obtener: (id: number) => Promise<ServicioDTO | null>
    detectarComandosEnCarpeta: (rutaCarpeta: string) => Promise<ComandoDetectadoPrevioDTO[]>
    crear: (datos: CrearServicioDatos) => Promise<ServicioDTO>
    actualizar: (id: number, datos: ActualizarServicioDatos) => Promise<ServicioDTO>
    reordenar: (proyectoId: number, idsServiciosEnOrden: number[]) => Promise<ServicioDTO[]>
    eliminar: (id: number) => Promise<void>
    iniciar: (servicioId: number) => Promise<EstadoEjecucionComandoDTO>
    detener: (servicioId: number) => Promise<EstadoEjecucionComandoDTO>
    reiniciar: (servicioId: number) => Promise<EstadoEjecucionComandoDTO>
  }
  comandos: {
    crearPersonalizado: (datos: CrearComandoPersonalizadoDatos) => Promise<ComandoDTO>
    establecerPrincipal: (servicioId: number, comandoId: number) => Promise<ComandoDTO[]>
    eliminar: (comandoId: number) => Promise<void>
    ejecutar: (comandoId: number) => Promise<EstadoEjecucionComandoDTO>
    detener: (comandoId: number) => Promise<EstadoEjecucionComandoDTO>
    reiniciar: (comandoId: number) => Promise<EstadoEjecucionComandoDTO>
    obtenerEstados: () => Promise<EstadoEjecucionComandoDTO[]>
    obtenerLogs: (comandoId: number) => Promise<EntradaLog[]>
    limpiarLogs: (comandoId: number) => Promise<void>
    onLog: (callback: (entrada: EntradaLog) => void) => () => void
    onEstado: (callback: (estado: EstadoEjecucionComandoDTO) => void) => () => void
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
