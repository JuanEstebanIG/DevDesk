import fs from 'fs'
import * as proyectosRepositorio from '../repositorios/proyectos.repositorio'
import * as serviciosRepositorio from '../repositorios/servicios.repositorio'
import * as comandosRepositorio from '../repositorios/comandos.repositorio'
import { detectarComandosEnCarpeta } from './detectorComandos.servicio'
import { gestorProcesos } from './gestorProcesos.servicio'
import type {
  ActualizarServicioDatos,
  ComandoDTO,
  CrearComandoPersonalizadoDatos,
  CrearServicioDatos,
  EstadoEjecucionComandoDTO,
  ServicioDTO
} from '../../compartido/tipos'

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

  const comandosIniciales = detectarComandosEnCarpeta(pathLimpio)
  const ordenArranque = await serviciosRepositorio.obtenerSiguienteOrdenArranque(datos.proyectoId)

  return await serviciosRepositorio.crearServicio({
    proyectoId: datos.proyectoId,
    nombre: nombreLimpio,
    path: pathLimpio,
    tipoHealthCheck: datos.tipoHealthCheck ?? 'none',
    objetivoHealthCheck: datos.objetivoHealthCheck ?? null,
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

  return await serviciosRepositorio.actualizarServicio(id, datosLimpios)
}

export async function eliminarServicio(id: number): Promise<void> {
  const servicio = await serviciosRepositorio.obtenerServicioPorId(id)
  if (!servicio) {
    throw new Error('El servicio que intentas eliminar no existe.')
  }

  await gestorProcesos.detenerProcesosDeServicio(id)
  await serviciosRepositorio.eliminarServicio(id)
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
