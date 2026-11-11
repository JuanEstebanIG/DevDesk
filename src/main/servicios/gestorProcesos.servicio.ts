import { spawn, execFile, type ChildProcess } from 'child_process'
import { stripVTControlCharacters } from 'util'
import { BrowserWindow } from 'electron'
import fs from 'fs'
import * as comandosRepositorio from '../repositorios/comandos.repositorio'
import { esperarDisponibilidadServicio } from './verificadorSalud.servicio'
import type {
  EntradaLog,
  EstadoArranqueGrupoDTO,
  EstadoEjecucion,
  EstadoEjecucionComandoDTO,
  TipoFlujoLog
} from '../../compartido/tipos'

const LIMITE_LOGS_MEMORIA = 1500

interface EjecucionActiva {
  comandoId: number
  servicioId: number
  pid: number
  estado: EstadoEjecucion
  proceso: ChildProcess
  detenidoManualmente: boolean
  terminadoPorFalloSalud: boolean
  ultimoMensajeError: string | null
  promesaCierre: Promise<void>
}

class GestorDeProcesos {
  private ejecuciones = new Map<number, EjecucionActiva>()
  private estadosHistoricos = new Map<number, EstadoEjecucionComandoDTO>()
  private logsPorComando = new Map<number, EntradaLog[]>()
  private contadorLogs = 0

  public emitirEventoATodasLasVentanas(canal: string, carga: unknown): void {
    const ventanas = BrowserWindow.getAllWindows()
    for (const ventana of ventanas) {
      if (!ventana.isDestroyed()) {
        ventana.webContents.send(canal, carga)
      }
    }
  }

  public emitirEstadoGrupo(estado: EstadoArranqueGrupoDTO): void {
    this.emitirEventoATodasLasVentanas('grupo:estado', estado)
  }

  public registrarLog(
    comandoId: number,
    servicioId: number,
    flujo: TipoFlujoLog,
    texto: string
  ): void {
    const lineas = texto.replace(/\r\n/g, '\n').split('\n')
    for (const lineaCruda of lineas) {
      const linea = stripVTControlCharacters(lineaCruda).replace(/\[\d+(?:;\d+)*m/g, '')
      if (linea.trim().length === 0) continue

      this.contadorLogs += 1
      const entrada: EntradaLog = {
        id: `${Date.now()}-${this.contadorLogs}`,
        comandoId,
        servicioId,
        flujo,
        texto: linea,
        marcaTiempo: new Date().toLocaleTimeString('es-ES', { hour12: false })
      }

      const activa = this.ejecuciones.get(comandoId)
      if (activa) {
        const textoTrim = linea.trim()
        if (/EADDRINUSE|address already in use/i.test(textoTrim)) {
          activa.ultimoMensajeError = `El puerto requerido ya está ocupado por otro proceso (${textoTrim}).`
        } else if (
          /no se reconoce como un comando interno|is not recognized as an internal|command not found/i.test(
            textoTrim
          )
        ) {
          activa.ultimoMensajeError = `Comando o ejecutable no encontrado en el sistema (${textoTrim}).`
        } else if (flujo === 'stderr') {
          activa.ultimoMensajeError = textoTrim
        }
      }

      const listaActual = this.logsPorComando.get(comandoId) ?? []
      listaActual.push(entrada)
      if (listaActual.length > LIMITE_LOGS_MEMORIA) {
        listaActual.splice(0, listaActual.length - LIMITE_LOGS_MEMORIA)
      }
      this.logsPorComando.set(comandoId, listaActual)

      this.emitirEventoATodasLasVentanas('comando:log', entrada)
      this.emitirEventoATodasLasVentanas('servicio:log', entrada)
    }
  }

  private actualizarYEmitirEstado(
    comandoId: number,
    servicioId: number,
    pid: number | null,
    estado: EstadoEjecucion,
    ultimoError: string | null = null
  ): EstadoEjecucionComandoDTO {
    const dto: EstadoEjecucionComandoDTO = {
      comandoId,
      servicioId,
      pid,
      estado,
      ultimoError: estado === 'error' ? ultimoError : null
    }
    this.estadosHistoricos.set(comandoId, dto)

    const activa = this.ejecuciones.get(comandoId)
    if (activa) {
      activa.estado = estado
    }

    this.emitirEventoATodasLasVentanas('comando:estado', dto)
    return dto
  }

  private matarArbolDeProceso(pid: number): Promise<void> {
    if (!pid || pid <= 0) {
      return Promise.resolve()
    }

    if (process.platform === 'win32') {
      return new Promise((resolve) => {
        execFile('taskkill', ['/pid', String(pid), '/t', '/f'], () => {
          resolve()
        })
      })
    }

    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      // El proceso ya no existe
    }
    return Promise.resolve()
  }

  public estaComandoActivo(comandoId: number): boolean {
    const ejecucion = this.ejecuciones.get(comandoId)
    return Boolean(ejecucion && !ejecucion.detenidoManualmente)
  }

  public async iniciarProceso(comandoId: number): Promise<EstadoEjecucionComandoDTO> {
    const ejecucionExistente = this.ejecuciones.get(comandoId)
    if (
      ejecucionExistente &&
      (ejecucionExistente.estado === 'iniciando' || ejecucionExistente.estado === 'listo')
    ) {
      return {
        comandoId: ejecucionExistente.comandoId,
        servicioId: ejecucionExistente.servicioId,
        pid: ejecucionExistente.pid,
        estado: ejecucionExistente.estado,
        ultimoError: null
      }
    }

    const comandoDatos = await comandosRepositorio.obtenerComandoPorId(comandoId)
    if (!comandoDatos) {
      throw new Error('El comando solicitado no existe.')
    }

    const { servicio } = comandoDatos
    if (!fs.existsSync(servicio.path)) {
      const msgCarpeta = `La carpeta del servicio no existe en disco: ${servicio.path}`
      this.registrarLog(comandoId, servicio.id, 'stderr', msgCarpeta)
      this.actualizarYEmitirEstado(comandoId, servicio.id, null, 'error', msgCarpeta)
      throw new Error(msgCarpeta)
    }

    this.registrarLog(
      comandoId,
      servicio.id,
      'sistema',
      `Iniciando [${comandoDatos.etiqueta}] → ${comandoDatos.comando} (${servicio.path})`
    )

    this.actualizarYEmitirEstado(comandoId, servicio.id, null, 'iniciando', null)

    const proceso = spawn(comandoDatos.comando, {
      cwd: servicio.path,
      shell: true,
      windowsHide: true,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1'
      }
    })

    if (!proceso.pid || proceso.pid <= 0) {
      const msgPid = 'No fue posible obtener un PID válido del sistema operativo al iniciar el comando.'
      this.registrarLog(comandoId, servicio.id, 'stderr', msgPid)
      return this.actualizarYEmitirEstado(comandoId, servicio.id, null, 'error', msgPid)
    }

    const pidReal = proceso.pid
    let resolverCierre!: () => void
    const promesaCierre = new Promise<void>((resolve) => {
      resolverCierre = resolve
    })

    const nuevaEjecucion: EjecucionActiva = {
      comandoId,
      servicioId: servicio.id,
      pid: pidReal,
      estado: 'iniciando',
      proceso,
      detenidoManualmente: false,
      terminadoPorFalloSalud: false,
      ultimoMensajeError: null,
      promesaCierre
    }

    this.ejecuciones.set(comandoId, nuevaEjecucion)
    this.actualizarYEmitirEstado(comandoId, servicio.id, pidReal, 'iniciando', null)

    proceso.stdout?.on('data', (fragmento: Buffer) => {
      this.registrarLog(comandoId, servicio.id, 'stdout', fragmento.toString('utf-8'))
    })

    proceso.stderr?.on('data', (fragmento: Buffer) => {
      this.registrarLog(comandoId, servicio.id, 'stderr', fragmento.toString('utf-8'))
    })

    proceso.on('error', (error: Error) => {
      const msgErr = `Error al ejecutar proceso (PID ${pidReal}): ${error.message}`
      nuevaEjecucion.ultimoMensajeError = msgErr
      this.registrarLog(comandoId, servicio.id, 'stderr', msgErr)
    })

    proceso.on('close', (codigoSalida: number | null) => {
      const actual = this.ejecuciones.get(comandoId)
      const fueManual = actual?.detenidoManualmente ?? false
      const fueFalloSalud = actual?.terminadoPorFalloSalud ?? false
      const detalleStderr = actual?.ultimoMensajeError ?? null
      this.ejecuciones.delete(comandoId)

      if (fueFalloSalud) {
        const previo = this.estadosHistoricos.get(comandoId)
        this.actualizarYEmitirEstado(
          comandoId,
          servicio.id,
          null,
          'error',
          previo?.ultimoError ?? detalleStderr ?? 'El servicio no superó su health check.'
        )
      } else if (fueManual || codigoSalida === 0) {
        this.registrarLog(
          comandoId,
          servicio.id,
          'sistema',
          fueManual
            ? `Proceso detenido manualmente (PID ${pidReal}).`
            : `Proceso finalizado correctamente (código 0).`
        )
        this.actualizarYEmitirEstado(comandoId, servicio.id, null, 'detenido', null)
      } else {
        const msgSalida = `El comando "${comandoDatos.comando}" terminó con código ${codigoSalida ?? 'desconocido'}${
          detalleStderr ? `: ${detalleStderr}` : '.'
        }`
        this.registrarLog(
          comandoId,
          servicio.id,
          'stderr',
          `El proceso terminó con código de salida ${codigoSalida ?? 'desconocido'}.`
        )
        this.actualizarYEmitirEstado(comandoId, servicio.id, null, 'error', msgSalida)
      }

      resolverCierre()
    })

    const aplicaHealthCheck =
      comandoDatos.esPrincipal &&
      (servicio.tipoHealthCheck === 'http' || servicio.tipoHealthCheck === 'tcp') &&
      Boolean(servicio.objetivoHealthCheck?.trim())

    if (aplicaHealthCheck) {
      this.registrarLog(
        comandoId,
        servicio.id,
        'sistema',
        `Verificando disponibilidad (${servicio.tipoHealthCheck.toUpperCase()} → ${servicio.objetivoHealthCheck})...`
      )
    }

    const resultadoSalud = await esperarDisponibilidadServicio({
      tipo: aplicaHealthCheck ? servicio.tipoHealthCheck : 'none',
      objetivo: aplicaHealthCheck ? servicio.objetivoHealthCheck : null,
      sigueProcesoActivo: () => {
        const actual = this.ejecuciones.get(comandoId)
        return Boolean(actual && actual.pid === pidReal && !actual.detenidoManualmente)
      }
    })

    const ejecucionTrasVerificacion = this.ejecuciones.get(comandoId)

    if (ejecucionTrasVerificacion?.detenidoManualmente) {
      return this.actualizarYEmitirEstado(comandoId, servicio.id, null, 'detenido', null)
    }

    if (!resultadoSalud.exito) {
      const previo = this.estadosHistoricos.get(comandoId)
      const motivoFinal =
        previo?.ultimoError ??
        ejecucionTrasVerificacion?.ultimoMensajeError ??
        resultadoSalud.motivoError ??
        'Fallo al verificar disponibilidad del servicio.'

      if (resultadoSalud.motivoError) {
        this.registrarLog(comandoId, servicio.id, 'stderr', resultadoSalud.motivoError)
      }
      await this.detenerProcesoPorFalloSalud(comandoId, servicio.id, motivoFinal)
      return this.actualizarYEmitirEstado(comandoId, servicio.id, null, 'error', motivoFinal)
    }

    if (!this.ejecuciones.has(comandoId)) {
      const estadoFinal = this.estadosHistoricos.get(comandoId)
      return (
        estadoFinal ??
        this.actualizarYEmitirEstado(comandoId, servicio.id, null, 'detenido', null)
      )
    }

    if (aplicaHealthCheck) {
      this.registrarLog(
        comandoId,
        servicio.id,
        'sistema',
        `Health check superado (${servicio.tipoHealthCheck.toUpperCase()} → ${servicio.objetivoHealthCheck}). Servicio listo.`
      )
    }

    return this.actualizarYEmitirEstado(comandoId, servicio.id, pidReal, 'listo', null)
  }

  private async detenerProcesoPorFalloSalud(
    comandoId: number,
    servicioId: number,
    motivoError: string
  ): Promise<void> {
    const ejecucion = this.ejecuciones.get(comandoId)
    if (!ejecucion) {
      this.actualizarYEmitirEstado(comandoId, servicioId, null, 'error', motivoError)
      return
    }

    ejecucion.terminadoPorFalloSalud = true
    this.actualizarYEmitirEstado(comandoId, servicioId, null, 'error', motivoError)
    await this.matarArbolDeProceso(ejecucion.pid)
    await Promise.race([
      ejecucion.promesaCierre,
      new Promise<void>((resolve) => setTimeout(resolve, 3000))
    ])
    this.ejecuciones.delete(comandoId)
    this.actualizarYEmitirEstado(comandoId, servicioId, null, 'error', motivoError)
  }

  public async detenerProceso(comandoId: number): Promise<EstadoEjecucionComandoDTO> {
    const ejecucion = this.ejecuciones.get(comandoId)
    if (!ejecucion) {
      const previo = this.estadosHistoricos.get(comandoId)
      const comandoDatos = await comandosRepositorio.obtenerComandoPorId(comandoId)
      const servicioId = previo?.servicioId ?? comandoDatos?.servicioId ?? 0
      return this.actualizarYEmitirEstado(comandoId, servicioId, null, 'detenido', null)
    }

    ejecucion.detenidoManualmente = true
    await this.matarArbolDeProceso(ejecucion.pid)

    await Promise.race([
      ejecucion.promesaCierre,
      new Promise<void>((resolve) => setTimeout(resolve, 3000))
    ])

    this.ejecuciones.delete(comandoId)
    return this.actualizarYEmitirEstado(comandoId, ejecucion.servicioId, null, 'detenido', null)
  }

  public async reiniciarProceso(comandoId: number): Promise<EstadoEjecucionComandoDTO> {
    await this.detenerProceso(comandoId)
    return await this.iniciarProceso(comandoId)
  }

  public async detenerProcesosDeServicio(servicioId: number): Promise<void> {
    const comandosDelServicio: number[] = []
    for (const [comandoId, ejecucion] of this.ejecuciones.entries()) {
      if (ejecucion.servicioId === servicioId) {
        comandosDelServicio.push(comandoId)
      }
    }

    for (const comandoId of comandosDelServicio) {
      await this.detenerProceso(comandoId)
    }
  }

  public async detenerTodosLosProcesos(): Promise<void> {
    const comandosActivos = Array.from(this.ejecuciones.keys())
    await Promise.all(comandosActivos.map((comandoId) => this.detenerProceso(comandoId)))
  }

  public obtenerEstadosActuales(): EstadoEjecucionComandoDTO[] {
    return Array.from(this.estadosHistoricos.values())
  }

  public obtenerLogsDeComando(comandoId: number): EntradaLog[] {
    return this.logsPorComando.get(comandoId) ?? []
  }

  public limpiarLogsDeComando(comandoId: number): void {
    this.logsPorComando.set(comandoId, [])
  }
}

export const gestorProcesos = new GestorDeProcesos()
