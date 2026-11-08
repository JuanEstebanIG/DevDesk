import fs from 'fs'
import * as proyectosRepositorio from '../repositorios/proyectos.repositorio'
import type { CrearProyectoDatos, ProyectoDTO } from '../../compartido/tipos'

export async function listarProyectos(): Promise<ProyectoDTO[]> {
  return await proyectosRepositorio.listarProyectos()
}

export async function obtenerProyectoPorId(id: number): Promise<ProyectoDTO | null> {
  return await proyectosRepositorio.obtenerProyectoPorId(id)
}

export async function crearProyecto(datos: CrearProyectoDatos): Promise<ProyectoDTO> {
  const nombreLimpio = datos.nombre.trim()
  const pathLimpio = datos.path.trim()

  if (!nombreLimpio) {
    throw new Error('El nombre del proyecto es obligatorio.')
  }

  if (!pathLimpio) {
    throw new Error('La ruta de la carpeta del proyecto es obligatoria.')
  }

  if (!fs.existsSync(pathLimpio)) {
    throw new Error(`La carpeta seleccionada no existe: ${pathLimpio}`)
  }

  const estadisticas = fs.statSync(pathLimpio)
  if (!estadisticas.isDirectory()) {
    throw new Error('La ruta seleccionada debe ser un directorio válido.')
  }

  const existente = await proyectosRepositorio.obtenerProyectoPorPath(pathLimpio)
  if (existente) {
    throw new Error('Ya existe un proyecto registrado con esa misma carpeta.')
  }

  return await proyectosRepositorio.crearProyecto({
    nombre: nombreLimpio,
    path: pathLimpio
  })
}

export async function eliminarProyecto(id: number): Promise<void> {
  if (!id || typeof id !== 'number') {
    throw new Error('ID de proyecto inválido.')
  }

  const proyecto = await proyectosRepositorio.obtenerProyectoPorId(id)
  if (!proyecto) {
    throw new Error('El proyecto que intentas eliminar no existe.')
  }

  await proyectosRepositorio.eliminarProyecto(id)
}
