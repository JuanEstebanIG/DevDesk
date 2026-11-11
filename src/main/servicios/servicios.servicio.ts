import fs from 'fs'
import * as proyectosRepositorio from '../repositorios/proyectos.repositorio'
import * as serviciosRepositorio from '../repositorios/servicios.repositorio'
import * as comandosRepositorio from '../repositorios/comandos.repositorio'
import { detectarComandosEnCarpeta } from './detectorComandos.servicio'
import { gestorProcesos } from './gestorProcesos.servicio'
import { extraerHostYPuertoTcp, normalizarUrlHttp } from './verificadorSalud.servicio'
import { abrirCarpetaEnVsCode, abrirUrlEnNavegador } from './proyectos.servicio'
import type {
  ActualizarServicioDatos,
  ComandoDTO,
  ComandoDetectadoPrevioDTO,
  CrearComandoPersonalizadoDatos,
  CrearServicioDatos,
  EstadoArranqueGrupoDTO,
  EstadoEjecucionComandoDTO,
  ServicioDTO,
  TipoHealthCheck
} from '../../compartido/tipos'

const gruposCancelados = new Map<number, boolean>()

function validarConfiguracionHealthCheck(
  tipo: TipoHealthCheck | string | undefined,
  objetivo: string | null | undefined
): { tipoNormalizado: TipoHealthCheck; objetivoNormalizado: string | null } {
  const tipoFinal: TipoHealthCheck =
    tipo === 'http' || tipo === 'tcp' ? tipo : 'none'

  if (tipoFinal === 'none') {
    return { tipoNormalizado: 'none', objetivoNormalizado: null }
  }

  const objetivoLimpio = objetivo?.trim() ?? ''
  if (!objetivoLimpio) {
    throw new Error(
      `Debes especificar un puerto o URL para el health check de tipo ${tipoFinal.toUpperCase()}.`
    )
  }

  if (tipoFinal === 'tcp' && !extraerHostYPuertoTcp(objetivoLimpio)) {
    throw new Error(
      'Para un health check TCP ingresa un puerto válido (ej. 5432 o localhost:5432).'
    )
  }

  return {
    tipoNormalizado: tipoFinal,
    objetivoNormalizado: objetivoLimpio
  }
}

export function previsualizarComandosEnCarpeta(rutaCarpeta: string): ComandoDetectadoPrevioDTO[] {
  const rutaLimpia = rutaCarpeta?.trim() ?? ''
  if (!rutaLimpia || !fs.existsSync(rutaLimpia)) {
    return []
  }

  const detectados = detectarComandosEnCarpeta(rutaLimpia)
  return detectados.map((cmd) => ({
    etiqueta: cmd.etiqueta,
    comando: cmd.comando,
    esPrincipalSugerido: cmd.esPrincipal
  }))
}

export async function listarServiciosPorProyecto(proyectoId: number): Promise<ServicioDTO[]> {
  if (!proyectoId || typeof proyectoId !== 'number') {
    throw new Error('ID de proyecto inválido.')
  }
  return await serviciosRepositorio.listarServiciosPorProyecto(proyectoId)
}

export async function obtenerServicioPorId(id: number): Promise<ServicioDTO | null> {
  if (!id || typeof id !== 'number') {
    throw new Error('ID de servicio inválido.')
  }
  return await serviciosRepositorio.obtenerServicioPorId(id)
}

export async function crearServicio(datos: CrearServicioDatos): Promise<ServicioDTO> {
  const nombreLimpio = datos.nombre.trim()
  const pathLimpio = datos.path.trim()

  if (!nombreLimpio) {
    throw new Error('El nombre del servicio es obligatorio.')
  }

  if (!pathLimpio) {
    throw new Error('La carpeta del servicio es obligatoria.')
  }

  const proyecto = await proyectosRepositorio.obtenerProyectoPorId(datos.proyectoId)
  if (!proyecto) {
    throw new Error('El proyecto asociado no existe.')
  }

  if (!fs.existsSync(pathLimpio)) {
    throw new Error(`La carpeta seleccionada para el servicio no existe: ${pathLimpio}`)
  }

  const estadisticas = fs.statSync(pathLimpio)
  if (!estadisticas.isDirectory()) {
    throw new Error('La ruta del servicio debe ser un directorio válido.')
  }

  const { tipoNormalizado, objetivoNormalizado } = validarConfiguracionHealthCheck(
    datos.tipoHealthCheck,
    datos.objetivoHealthCheck
  )

  let comandosIniciales = detectarComandosEnCarpeta(pathLimpio)

  const manualEtiqueta = datos.comandoManualPrincipal?.etiqueta?.trim() ?? ''
  const manualComando = datos.comandoManualPrincipal?.comando?.trim() ?? ''

  if (manualComando) {
    comandosIniciales = comandosIniciales.map((cmd) => ({
      ...cmd,
      esPrincipal: false
    }))
    comandosIniciales.unshift({
      etiqueta: manualEtiqueta || 'principal',
      comando: manualComando,
      origen: 'personalizado',
      esPrincipal: true
    })
  } else if (datos.etiquetaPrincipalSeleccionada) {
    const existeEtiqueta = comandosIniciales.some(
      (cmd) => cmd.etiqueta === datos.etiquetaPrincipalSeleccionada
    )
    if (existeEtiqueta) {
      comandosIniciales = comandosIniciales.map((cmd) => ({
        ...cmd,
        esPrincipal: cmd.etiqueta === datos.etiquetaPrincipalSeleccionada
      }))
    }
  }

  const ordenArranque =
    datos.ordenArranque && datos.ordenArranque > 0
      ? Math.floor(datos.ordenArranque)
      : await serviciosRepositorio.obtenerSiguienteOrdenArranque(datos.proyectoId)

  return await serviciosRepositorio.crearServicio({
    proyectoId: datos.proyectoId,
    nombre: nombreLimpio,
    path: pathLimpio,
    tipoHealthCheck: tipoNormalizado,
    objetivoHealthCheck: objetivoNormalizado,
    ordenArranque,
    comandosIniciales
  })
}

export async function actualizarServicio(
  id: number,
  datos: ActualizarServicioDatos
): Promise<ServicioDTO> {
  const servicioActual = await serviciosRepositorio.obtenerServicioPorId(id)
  if (!servicioActual) {
    throw new Error('El servicio que intentas actualizar no existe.')
  }

  const datosLimpios: ActualizarServicioDatos = { ...datos }

  if (datos.nombre !== undefined) {
    const nombreLimpio = datos.nombre.trim()
    if (!nombreLimpio) {
      throw new Error('El nombre del servicio no puede estar vacío.')
    }
    datosLimpios.nombre = nombreLimpio
  }

  if (datos.path !== undefined) {
    const pathLimpio = datos.path.trim()
    if (!pathLimpio || !fs.existsSync(pathLimpio) || !fs.statSync(pathLimpio).isDirectory()) {
      throw new Error('La nueva ruta del servicio no es un directorio válido.')
    }
    datosLimpios.path = pathLimpio
  }

  if (datos.tipoHealthCheck !== undefined || datos.objetivoHealthCheck !== undefined) {
    const tipoEvaluar = datos.tipoHealthCheck ?? servicioActual.tipoHealthCheck
    const objetivoEvaluar =
      datos.objetivoHealthCheck !== undefined
        ? datos.objetivoHealthCheck
        : servicioActual.objetivoHealthCheck

    const { tipoNormalizado, objetivoNormalizado } = validarConfiguracionHealthCheck(
      tipoEvaluar,
      objetivoEvaluar
    )
    datosLimpios.tipoHealthCheck = tipoNormalizado
    datosLimpios.objetivoHealthCheck = objetivoNormalizado
  }

  if (datos.ordenArranque !== undefined) {
    const ordenNum = Math.floor(Number(datos.ordenArranque))
    if (!Number.isFinite(ordenNum) || ordenNum < 1) {
      throw new Error('El orden de arranque debe ser un número entero mayor o igual a 1.')
    }
    datosLimpios.ordenArranque = ordenNum
  }

  await serviciosRepositorio.actualizarServicio(id, datosLimpios)

  const manualEtiqueta = datos.comandoManualPrincipal?.etiqueta?.trim() ?? ''
  const manualComando = datos.comandoManualPrincipal?.comando?.trim() ?? ''

  if (manualComando) {
    await comandosRepositorio.crearComando({
      servicioId: id,
      etiqueta: manualEtiqueta || 'principal',
      comando: manualComando,
      origen: 'personalizado',
      esPrincipal: true
    })
  } else if (datos.comandoPrincipalId !== undefined) {
    const pertenece = (servicioActual.comandos ?? []).some(
      (c) => c.id === datos.comandoPrincipalId
    )
    if (pertenece) {
      await comandosRepositorio.establecerComandoPrincipal(id, datos.comandoPrincipalId)
    }
  }

  const final = await serviciosRepositorio.obtenerServicioPorId(id)
  if (!final) {
    throw new Error('No fue posible recuperar el servicio actualizado.')
  }
  return final
}

export async function eliminarServicio(id: number): Promise<void> {
  const servicio = await serviciosRepositorio.obtenerServicioPorId(id)
  if (!servicio) {
    throw new Error('El servicio que intentas eliminar no existe.')
  }

  await gestorProcesos.detenerProcesosDeServicio(id)
  await serviciosRepositorio.eliminarServicio(id)
}

export async function reordenarServicios(
  proyectoId: number,
  idsServiciosEnOrden: number[]
): Promise<ServicioDTO[]> {
  if (!proyectoId || typeof proyectoId !== 'number') {
    throw new Error('ID de proyecto inválido.')
  }
  if (!Array.isArray(idsServiciosEnOrden)) {
    throw new Error('La secuencia de servicios es inválida.')
  }
  return await serviciosRepositorio.reordenarServicios(proyectoId, idsServiciosEnOrden)
}

async function resolverComandoPrincipal(servicioId: number): Promise<number> {
  const servicio = await serviciosRepositorio.obtenerServicioPorId(servicioId)
  if (!servicio) {
    throw new Error('El servicio solicitado no existe.')
  }

  if (!servicio.comandos || servicio.comandos.length === 0) {
    throw new Error(
      `El servicio "${servicio.nombre}" no tiene comandos configurados para ejecutar.`
    )
  }

  const comandoPrincipal =
    servicio.comandos.find((cmd) => cmd.esPrincipal) ?? servicio.comandos[0]

  return comandoPrincipal.id
}

export async function iniciarServicioPrincipal(
  servicioId: number
): Promise<EstadoEjecucionComandoDTO> {
  const comandoId = await resolverComandoPrincipal(servicioId)
  return await gestorProcesos.iniciarProceso(comandoId)
}

export async function detenerServicioPrincipal(
  servicioId: number
): Promise<EstadoEjecucionComandoDTO> {
  const comandoId = await resolverComandoPrincipal(servicioId)
  return await gestorProcesos.detenerProceso(comandoId)
}

export async function reiniciarServicioPrincipal(
  servicioId: number
): Promise<EstadoEjecucionComandoDTO> {
  const comandoId = await resolverComandoPrincipal(servicioId)
  return await gestorProcesos.reiniciarProceso(comandoId)
}

export async function iniciarGrupoProyecto(
  proyectoId: number,
  servicioIdsSeleccionados?: number[]
): Promise<EstadoArranqueGrupoDTO> {
  const todosLosServicios = await serviciosRepositorio.listarServiciosPorProyecto(proyectoId)
  if (todosLosServicios.length === 0) {
    throw new Error('Este proyecto no tiene servicios registrados para iniciar.')
  }

  const servicios =
    servicioIdsSeleccionados !== undefined
      ? todosLosServicios.filter((s) => servicioIdsSeleccionados.includes(s.id))
      : todosLosServicios

  if (servicios.length === 0) {
    throw new Error('Selecciona al menos un servicio para iniciar el arranque del grupo.')
  }

  gruposCancelados.set(proyectoId, false)

  for (let indice = 0; indice < servicios.length; indice++) {
    if (gruposCancelados.get(proyectoId)) {
      const estadoCancelado: EstadoArranqueGrupoDTO = {
        proyectoId,
        enCurso: false,
        servicioActualId: null,
        servicioActualNombre: null,
        pasoActual: indice,
        totalPasos: servicios.length,
        errorMensaje: null
      }
      gestorProcesos.emitirEstadoGrupo(estadoCancelado)
      return estadoCancelado
    }

    const servicio = servicios[indice]
    const estadoProgreso: EstadoArranqueGrupoDTO = {
      proyectoId,
      enCurso: true,
      servicioActualId: servicio.id,
      servicioActualNombre: servicio.nombre,
      pasoActual: indice + 1,
      totalPasos: servicios.length,
      errorMensaje: null
    }
    gestorProcesos.emitirEstadoGrupo(estadoProgreso)

    const comandoPrincipal =
      servicio.comandos.find((cmd) => cmd.esPrincipal) ?? servicio.comandos[0]

    if (!comandoPrincipal) {
      const estadoFalloSinCmd: EstadoArranqueGrupoDTO = {
        proyectoId,
        enCurso: false,
        servicioActualId: servicio.id,
        servicioActualNombre: servicio.nombre,
        pasoActual: indice + 1,
        totalPasos: servicios.length,
        errorMensaje: `El arranque del grupo se detuvo porque "${servicio.nombre}" no tiene un comando configurado.`
      }
      gestorProcesos.emitirEstadoGrupo(estadoFalloSinCmd)
      return estadoFalloSinCmd
    }

    let resultado: EstadoEjecucionComandoDTO
    try {
      resultado = await gestorProcesos.iniciarProceso(comandoPrincipal.id)
    } catch (error) {
      const detalle = error instanceof Error ? error.message : 'Error al iniciar proceso.'
      const estadoExcepcion: EstadoArranqueGrupoDTO = {
        proyectoId,
        enCurso: false,
        servicioActualId: servicio.id,
        servicioActualNombre: servicio.nombre,
        pasoActual: indice + 1,
        totalPasos: servicios.length,
        errorMensaje: `El arranque del grupo se detuvo en "${servicio.nombre}": ${detalle}`
      }
      gestorProcesos.emitirEstadoGrupo(estadoExcepcion)
      return estadoExcepcion
    }

    if (gruposCancelados.get(proyectoId)) {
      const estadoCancelado: EstadoArranqueGrupoDTO = {
        proyectoId,
        enCurso: false,
        servicioActualId: null,
        servicioActualNombre: null,
        pasoActual: indice + 1,
        totalPasos: servicios.length,
        errorMensaje: null
      }
      gestorProcesos.emitirEstadoGrupo(estadoCancelado)
      return estadoCancelado
    }

    if (resultado.estado !== 'listo') {
      const estadoFallo: EstadoArranqueGrupoDTO = {
        proyectoId,
        enCurso: false,
        servicioActualId: servicio.id,
        servicioActualNombre: servicio.nombre,
        pasoActual: indice + 1,
        totalPasos: servicios.length,
        errorMensaje: `El arranque del grupo se detuvo en "${servicio.nombre}" (paso ${indice + 1} de ${servicios.length})${
          resultado.ultimoError ? `: ${resultado.ultimoError}` : ' porque el servicio falló o no superó su health check.'
        } Los servicios anteriores permanecen activos.`
      }
      gestorProcesos.emitirEstadoGrupo(estadoFallo)
      return estadoFallo
    }
  }

  const estadoCompletado: EstadoArranqueGrupoDTO = {
    proyectoId,
    enCurso: false,
    servicioActualId: null,
    servicioActualNombre: null,
    pasoActual: servicios.length,
    totalPasos: servicios.length,
    errorMensaje: null
  }
  gestorProcesos.emitirEstadoGrupo(estadoCompletado)

  try {
    const proyecto = await proyectosRepositorio.obtenerProyectoPorId(proyectoId)
    if (proyecto) {
      if (proyecto.abrirVsCodeAlIniciar) {
        await abrirCarpetaEnVsCode(proyecto.path).catch(() => {
          // Ignorar fallo no crítico al lanzar VS Code
        })
      }

      if (proyecto.abrirNavegadorAlIniciar) {
        const servicioHttp = servicios.find(
          (s) => s.tipoHealthCheck === 'http' && Boolean(s.objetivoHealthCheck?.trim())
        )
        const urlObjetivo =
          proyecto.urlAperturaAuto?.trim() ||
          (servicioHttp?.objetivoHealthCheck
            ? normalizarUrlHttp(servicioHttp.objetivoHealthCheck)
            : '')

        if (urlObjetivo) {
          await abrirUrlEnNavegador(urlObjetivo).catch(() => {
            // Ignorar fallo no crítico al abrir navegador
          })
        }
      }
    }
  } catch {
    // Las automatizaciones post-arranque no deben alterar el resultado del grupo
  }

  return estadoCompletado
}

export async function detenerGrupoProyecto(proyectoId: number): Promise<void> {
  gruposCancelados.set(proyectoId, true)
  const servicios = await serviciosRepositorio.listarServiciosPorProyecto(proyectoId)

  for (const servicio of servicios) {
    await gestorProcesos.detenerProcesosDeServicio(servicio.id)
  }

  gestorProcesos.emitirEstadoGrupo({
    proyectoId,
    enCurso: false,
    servicioActualId: null,
    servicioActualNombre: null,
    pasoActual: 0,
    totalPasos: servicios.length,
    errorMensaje: null
  })
}

export async function crearComandoPersonalizado(
  datos: CrearComandoPersonalizadoDatos
): Promise<ComandoDTO> {
  const etiquetaLimpia = datos.etiqueta.trim()
  const comandoLimpio = datos.comando.trim()

  if (!etiquetaLimpia) {
    throw new Error('La etiqueta del comando es obligatoria.')
  }

  if (!comandoLimpio) {
    throw new Error('El comando a ejecutar es obligatorio.')
  }

  const servicio = await serviciosRepositorio.obtenerServicioPorId(datos.servicioId)
  if (!servicio) {
    throw new Error('El servicio asociado no existe.')
  }

  const noTieneComandosPrevios = (servicio.comandos?.length ?? 0) === 0
  const debeSerPrincipal = Boolean(datos.esPrincipal) || noTieneComandosPrevios

  return await comandosRepositorio.crearComando({
    servicioId: datos.servicioId,
    etiqueta: etiquetaLimpia,
    comando: comandoLimpio,
    origen: 'personalizado',
    esPrincipal: debeSerPrincipal
  })
}

export async function establecerComandoPrincipal(
  servicioId: number,
  comandoId: number
): Promise<ComandoDTO[]> {
  const comando = await comandosRepositorio.obtenerComandoPorId(comandoId)
  if (!comando || comando.servicioId !== servicioId) {
    throw new Error('El comando seleccionado no pertenece a este servicio.')
  }

  return await comandosRepositorio.establecerComandoPrincipal(servicioId, comandoId)
}

export async function eliminarComando(comandoId: number): Promise<void> {
  const comando = await comandosRepositorio.obtenerComandoPorId(comandoId)
  if (!comando) {
    throw new Error('El comando que intentas eliminar no existe.')
  }

  await gestorProcesos.detenerProceso(comandoId)
  await comandosRepositorio.eliminarComando(comandoId)

  if (comando.esPrincipal) {
    const restantes = await comandosRepositorio.listarComandosPorServicio(comando.servicioId)
    if (restantes.length > 0 && !restantes.some((cmd) => cmd.esPrincipal)) {
      await comandosRepositorio.establecerComandoPrincipal(comando.servicioId, restantes[0].id)
    }
  }
}
