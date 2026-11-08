import http from 'http'
import https from 'https'
import net from 'net'
import type { TipoHealthCheck } from '../../compartido/tipos'

export interface ResultadoVerificacionSalud {
  exito: boolean
  motivoError?: string
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function normalizarUrlHttp(objetivoCrudo: string): string {
  const limpio = objetivoCrudo.trim()
  if (/^:?\d+$/.test(limpio)) {
    const puerto = limpio.replace(/^:/, '')
    return `http://localhost:${puerto}/`
  }
  if (!/^https?:\/\//i.test(limpio)) {
    return `http://${limpio}`
  }
  return limpio
}

export function extraerHostYPuertoTcp(objetivoCrudo: string): { host: string; puerto: number } | null {
  const limpio = objetivoCrudo.trim()

  if (/^:?\d+$/.test(limpio)) {
    const puerto = Number(limpio.replace(/^:/, ''))
    if (puerto > 0 && puerto <= 65535) {
      return { host: 'localhost', puerto }
    }
    return null
  }

  const sinProtocolo = limpio.replace(/^[a-z]+:\/\//i, '').split('/')[0]
  const ultimoDosPuntos = sinProtocolo.lastIndexOf(':')
  if (ultimoDosPuntos === -1) {
    return null
  }

  const hostParte = sinProtocolo.slice(0, ultimoDosPuntos).trim() || 'localhost'
  const puertoParte = Number(sinProtocolo.slice(ultimoDosPuntos + 1).trim())

  if (!Number.isInteger(puertoParte) || puertoParte <= 0 || puertoParte > 65535) {
    return null
  }

  return { host: hostParte, puerto: puertoParte }
}

function peticionHttpSimple(urlTexto: string, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    let urlObj: URL
    try {
      urlObj = new URL(urlTexto)
    } catch {
      resolve(false)
      return
    }

    const cliente = urlObj.protocol === 'https:' ? https : http
    const solicitud = cliente.get(
      urlTexto,
      {
        timeout: timeoutMs,
        headers: {
          Accept: '*/*',
          'User-Agent': 'DevDesk-HealthCheck/1.0'
        }
      },
      (respuesta) => {
        respuesta.resume()
        const codigo = respuesta.statusCode ?? 500
        resolve(codigo < 500)
      }
    )

    solicitud.on('timeout', () => {
      solicitud.destroy()
      resolve(false)
    })

    solicitud.on('error', () => {
      solicitud.destroy()
      resolve(false)
    })
  })
}

async function verificarHttpUnaVez(objetivoCrudo: string): Promise<boolean> {
  const urlNormalizada = normalizarUrlHttp(objetivoCrudo)
  const okDirecto = await peticionHttpSimple(urlNormalizada)
  if (okDirecto) return true

  try {
    const parsed = new URL(urlNormalizada)
    if (parsed.hostname === 'localhost') {
      const urlIpv4 = new URL(urlNormalizada)
      urlIpv4.hostname = '127.0.0.1'
      if (await peticionHttpSimple(urlIpv4.toString())) {
        return true
      }

      const urlIpv6 = new URL(urlNormalizada)
      urlIpv6.hostname = '[::1]'
      if (await peticionHttpSimple(urlIpv6.toString())) {
        return true
      }
    }
  } catch {
    // URL inválida
  }

  return false
}

function intentoConexionTcp(host: string, puerto: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let finalizado = false

    const cerrar = (resultado: boolean): void => {
      if (finalizado) return
      finalizado = true
      socket.destroy()
      resolve(resultado)
    }

    socket.setTimeout(timeoutMs)
    socket.once('connect', () => cerrar(true))
    socket.once('timeout', () => cerrar(false))
    socket.once('error', () => cerrar(false))

    socket.connect(puerto, host)
  })
}

async function verificarTcpUnaVez(objetivoCrudo: string): Promise<boolean> {
  const destino = extraerHostYPuertoTcp(objetivoCrudo)
  if (!destino) return false

  if (await intentoConexionTcp(destino.host, destino.puerto)) {
    return true
  }

  if (destino.host === 'localhost') {
    if (await intentoConexionTcp('127.0.0.1', destino.puerto)) {
      return true
    }
    if (await intentoConexionTcp('::1', destino.puerto)) {
      return true
    }
  }

  return false
}

export async function esperarDisponibilidadServicio(opciones: {
  tipo: TipoHealthCheck | string
  objetivo: string | null
  sigueProcesoActivo: () => boolean
  timeoutMs?: number
  intervaloMs?: number
}): Promise<ResultadoVerificacionSalud> {
  const {
    tipo,
    objetivo,
    sigueProcesoActivo,
    timeoutMs = 60_000,
    intervaloMs = 500
  } = opciones

  const objetivoLimpio = objetivo?.trim() ?? ''

  if (tipo === 'none' || !objetivoLimpio) {
    // Breve ventana de estabilización para detectar fallos inmediatos al arrancar
    for (let i = 0; i < 3; i++) {
      await esperar(200)
      if (!sigueProcesoActivo()) {
        return {
          exito: false,
          motivoError: 'El proceso terminó inmediatamente después de iniciarse.'
        }
      }
    }
    return { exito: true }
  }

  if (tipo === 'tcp' && !extraerHostYPuertoTcp(objetivoLimpio)) {
    return {
      exito: false,
      motivoError: `El objetivo TCP "${objetivoLimpio}" no contiene un puerto válido (1-65535).`
    }
  }

  const instanteInicio = Date.now()

  while (Date.now() - instanteInicio < timeoutMs) {
    if (!sigueProcesoActivo()) {
      return {
        exito: false,
        motivoError: 'El proceso se detuvo antes de superar el health check.'
      }
    }

    const disponible =
      tipo === 'http'
        ? await verificarHttpUnaVez(objetivoLimpio)
        : tipo === 'tcp'
          ? await verificarTcpUnaVez(objetivoLimpio)
          : true

    if (disponible) {
      return { exito: true }
    }

    if (!sigueProcesoActivo()) {
      return {
        exito: false,
        motivoError: 'El proceso se detuvo antes de superar el health check.'
      }
    }

    await esperar(intervaloMs)
  }

  return {
    exito: false,
    motivoError: `El servicio no superó el health check (${tipo.toUpperCase()} → ${objetivoLimpio}) dentro del tiempo límite de ${Math.round(timeoutMs / 1000)}s.`
  }
}
