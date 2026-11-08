import { spawn, execFile, type ChildProcess } from 'child_process'
import { BrowserWindow } from 'electron'
import fs from 'fs'
import * as comandosRepositorio from '../repositorios/comandos.repositorio'
import type {
  EntradaLog,
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
  promesaCierre: Promise<void>
}

class GestorDeProcesos {
  private ejecuciones = new Map<number, EjecucionActiva>()
  private estadosHistoricos = new Map<number, EstadoEjecucionComandoDTO>()
  private logsPorComando = new Map<number, EntradaLog[]>()
  private contadorLogs = 0

  private emitirEventoATodasLasVentanas(canal: string, carga: unknown): void {
    const ventanas = BrowserWindow.getAllWindows()
    for (const ventana of ventanas) {
      if (!ventana.isDestroyed()) {
        ventana.webContents.send(canal, carga)
      }
    }
  }

  private registrarLog(
    comandoId: number,
    servicioId: number,
    flujo: TipoFlujoLog,
    texto: string
  ): void {
    const lineas = texto.replace(/\r\n/g, '\n').split('\n')
    for (const linea of lineas) {
      if (linea.length === 0) continue

      this.contadorLogs += 1
      const entrada: EntradaLog = {
        id: `${Date.now()}-${this.contadorLogs}`,
        comandoId,
        servicioId,
        flujo,
        texto: linea,
        marcaTiempo: new Date().toLocaleTimeString('es-ES', { hour12: false })
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
    estado: EstadoEjecucion
  ): EstadoEjecucionComandoDTO {
    const dto: EstadoEjecucionComandoDTO = {
      comandoId,
      servicioId,
      pid,
      estado
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
        estado: ejecucionExistente.estado
      }
    }

    const comandoDatos = await comandosRepositorio.obtenerComandoPorId(comandoId)
    if (!comandoDatos) {
      throw new Error('El comando solicitado no existe.')
    }

    const { servicio } = comandoDatos
    if (!fs.existsSync(servicio.path)) {
      throw new Error(`La carpeta del servicio no existe: ${servicio.path}`)
    }

    this.registrarLog(
      comandoId,
      servicio.id,
      'sistema',
      `Iniciando [${comandoDatos.etiqueta}] → ${comandoDatos.comando} (${servicio.path})`
    )

    this.actualizarYEmitirEstado(comandoId, servicio.id, null, 'iniciando')

    const proceso = spawn(comandoDatos.comando, {
      cwd: servicio.path,
      shell: true,
      windowsHide: true,
      env: {
        ...process.env,
        FORCE_COLOR: '0'
      }
    })

    if (!proceso.pid || proceso.pid <= 0) {
      const estadoError = this.actualizarYEmitirEstado(comandoId, servicio.id, null, 'error')
      this.registrarLog(
        comandoId,
        servicio.id,
        'stderr',
        'No fue posible obtener un PID válido del sistema operativo al iniciar el comando.'
      )
      return estadoError
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
      estado: 'listo',
      proceso,
      detenidoManualmente: false,
      promesaCierre
    }

    this.ejecuciones.set(comandoId, nuevaEjecucion)
    const estadoListo = this.actualizarYEmitirEstado(comandoId, servicio.id, pidReal, 'listo')

    proceso.stdout?.on('data', (fragmento: Buffer) => {
      this.registrarLog(comandoId, servicio.id, 'stdout', fragmento.toString('utf-8'))
    })

    proceso.stderr?.on('data', (fragmento: Buffer) => {
      this.registrarLog(comandoId, servicio.id, 'stderr', fragmento.toString('utf-8'))
    })

    proceso.on('error', (error: Error) => {
      this.registrarLog(
        comandoId,
        servicio.id,
        'stderr',
        `Error en el proceso (PID ${pidReal}): ${error.message}`
      )
    })

    proceso.on('close', (codigoSalida: number | null) => {
      const actual = this.ejecuciones.get(comandoId)
      const fueManual = actual?.detenidoManualmente ?? false
      this.ejecuciones.delete(comandoId)

      if (fueManual || codigoSalida === 0) {
        this.registrarLog(
          comandoId,
          servicio.id,
          'sistema',
          fueManual
            ? `Proceso detenido manualmente (PID ${pidReal}).`
            : `Proceso finalizado correctamente (código 0).`
        )
        this.actualizarYEmitirEstado(comandoId, servicio.id, null, 'detenido')
      } else {
        this.registrarLog(
          comandoId,
          servicio.id,
          'stderr',
          `El proceso terminó con código de salida ${codigoSalida ?? 'desconocido'}.`
        )
        this.actualizarYEmitirEstado(comandoId, servicio.id, null, 'error')
      }

      resolverCierre()
    })

    return estadoListo
  }

  public async detenerProceso(comandoId: number): Promise<EstadoEjecucionComandoDTO> {
    const ejecucion = this.ejecuciones.get(comandoId)
    if (!ejecucion) {
      const previo = this.estadosHistoricos.get(comandoId)
      const comandoDatos = await comandosRepositorio.obtenerComandoPorId(comandoId)
      const servicioId = previo?.servicioId ?? comandoDatos?.servicioId ?? 0
      return this.actualizarYEmitirEstado(comandoId, servicioId, null, 'detenido')
    }

    ejecucion.detenidoManualmente = true
    await this.matarArbolDeProceso(ejecucion.pid)

    await Promise.race([
      ejecucion.promesaCierre,
      new Promise<void>((resolve) => setTimeout(resolve, 3000))
    ])

    this.ejecuciones.delete(comandoId)
    return this.actualizarYEmitirEstado(comandoId, ejecucion.servicioId, null, 'detenido')
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
