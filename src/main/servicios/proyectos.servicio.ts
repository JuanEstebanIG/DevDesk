import fs from 'fs'
import { spawn } from 'child_process'
import { shell } from 'electron'
import * as proyectosRepositorio from '../repositorios/proyectos.repositorio'
import { gestorProcesos } from './gestorProcesos.servicio'
import { normalizarUrlHttp } from './verificadorSalud.servicio'
import type {
  ActualizarProyectoDatos,
  CrearProyectoDatos,
  ProyectoDTO
} from '../../compartido/tipos'

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
    path: pathLimpio,
    abrirVsCodeAlIniciar: Boolean(datos.abrirVsCodeAlIniciar),
    abrirNavegadorAlIniciar: Boolean(datos.abrirNavegadorAlIniciar),
    urlAperturaAuto: datos.urlAperturaAuto?.trim() || null
  })
}

export async function actualizarProyecto(
  id: number,
  datos: ActualizarProyectoDatos
): Promise<ProyectoDTO> {
  if (!id || typeof id !== 'number') {
    throw new Error('ID de proyecto inválido.')
  }

  const proyecto = await proyectosRepositorio.obtenerProyectoPorId(id)
  if (!proyecto) {
    throw new Error('El proyecto que intentas actualizar no existe.')
  }

  const datosLimpios: ActualizarProyectoDatos = { ...datos }
  if (datos.nombre !== undefined) {
    const nombreLimpio = datos.nombre.trim()
    if (!nombreLimpio) {
      throw new Error('El nombre del proyecto no puede estar vacío.')
    }
    datosLimpios.nombre = nombreLimpio
  }

  if (datos.urlAperturaAuto !== undefined) {
    const urlLimpia = datos.urlAperturaAuto?.trim() ?? ''
    datosLimpios.urlAperturaAuto = urlLimpia ? normalizarUrlHttp(urlLimpia) : null
  }

  return await proyectosRepositorio.actualizarProyecto(id, datosLimpios)
}

export async function eliminarProyecto(id: number): Promise<void> {
  if (!id || typeof id !== 'number') {
    throw new Error('ID de proyecto inválido.')
  }

  const proyecto = await proyectosRepositorio.obtenerProyectoPorId(id)
  if (!proyecto) {
    throw new Error('El proyecto que intentas eliminar no existe.')
  }

  for (const servicio of proyecto.servicios) {
    await gestorProcesos.detenerProcesosDeServicio(servicio.id)
  }

  await proyectosRepositorio.eliminarProyecto(id)
}

export function abrirCarpetaEnVsCode(rutaCarpeta: string): Promise<void> {
  const rutaLimpia = rutaCarpeta?.trim() ?? ''
  if (!rutaLimpia || !fs.existsSync(rutaLimpia)) {
    return Promise.reject(new Error(`La carpeta no existe en disco: ${rutaLimpia}`))
  }

  return new Promise((resolve, reject) => {
    const proceso = spawn('code', ['.'], {
      cwd: rutaLimpia,
      shell: true,
      windowsHide: true,
      detached: true,
      stdio: 'ignore'
    })

    proceso.on('error', () => {
      reject(
        new Error(
          'No se pudo ejecutar el comando "code". Verifica que VS Code esté instalado y agregado al PATH.'
        )
      )
    })

    proceso.unref()
    setTimeout(() => resolve(), 250)
  })
}

export async function abrirUrlEnNavegador(urlCruda: string): Promise<void> {
  const urlLimpia = urlCruda?.trim() ?? ''
  if (!urlLimpia) {
    throw new Error('La URL a abrir en el navegador está vacía.')
  }

  const urlFinal = normalizarUrlHttp(urlLimpia)
  await shell.openExternal(urlFinal)
}
