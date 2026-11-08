import type { Servicio, Comando } from '@prisma/client'
import { obtenerClientePrisma } from './clientePrisma'
import type { ActualizarServicioDatos, OrigenComando, TipoHealthCheck } from '../../compartido/tipos'

export type ServicioConComandos = Servicio & {
  comandos: Comando[]
}

export interface NuevoComandoInicial {
  etiqueta: string
  comando: string
  origen: OrigenComando
  esPrincipal: boolean
}

export interface CrearServicioRepositorioDatos {
  proyectoId: number
  nombre: string
  path: string
  tipoHealthCheck: TipoHealthCheck
  objetivoHealthCheck: string | null
  ordenArranque: number
  comandosIniciales: NuevoComandoInicial[]
}

export async function obtenerSiguienteOrdenArranque(proyectoId: number): Promise<number> {
  const prisma = obtenerClientePrisma()
  const ultimo = await prisma.servicio.findFirst({
    where: { proyectoId },
    orderBy: { ordenArranque: 'desc' },
    select: { ordenArranque: true }
  })
  return (ultimo?.ordenArranque ?? 0) + 1
}

export async function crearServicio(
  datos: CrearServicioRepositorioDatos
): Promise<ServicioConComandos> {
  const prisma = obtenerClientePrisma()
  return await prisma.servicio.create({
    data: {
      proyectoId: datos.proyectoId,
      nombre: datos.nombre,
      path: datos.path,
      tipoHealthCheck: datos.tipoHealthCheck,
      objetivoHealthCheck: datos.objetivoHealthCheck,
      ordenArranque: datos.ordenArranque,
      comandos:
        datos.comandosIniciales.length > 0
          ? {
              create: datos.comandosIniciales.map((cmd) => ({
                etiqueta: cmd.etiqueta,
                comando: cmd.comando,
                origen: cmd.origen,
                esPrincipal: cmd.esPrincipal
              }))
            }
          : undefined
    },
    include: {
      comandos: {
        orderBy: { id: 'asc' }
      }
    }
  })
}

export async function listarServiciosPorProyecto(
  proyectoId: number
): Promise<ServicioConComandos[]> {
  const prisma = obtenerClientePrisma()
  return await prisma.servicio.findMany({
    where: { proyectoId },
    orderBy: [{ ordenArranque: 'asc' }, { id: 'asc' }],
    include: {
      comandos: {
        orderBy: { id: 'asc' }
      }
    }
  })
}

export async function obtenerServicioPorId(id: number): Promise<ServicioConComandos | null> {
  const prisma = obtenerClientePrisma()
  return await prisma.servicio.findUnique({
    where: { id },
    include: {
      comandos: {
        orderBy: { id: 'asc' }
      }
    }
  })
}

export async function actualizarServicio(
  id: number,
  datos: ActualizarServicioDatos
): Promise<ServicioConComandos> {
  const prisma = obtenerClientePrisma()
  return await prisma.servicio.update({
    where: { id },
    data: {
      ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
      ...(datos.path !== undefined ? { path: datos.path } : {}),
      ...(datos.tipoHealthCheck !== undefined ? { tipoHealthCheck: datos.tipoHealthCheck } : {}),
      ...(datos.objetivoHealthCheck !== undefined
        ? { objetivoHealthCheck: datos.objetivoHealthCheck }
        : {}),
      ...(datos.ordenArranque !== undefined ? { ordenArranque: datos.ordenArranque } : {})
    },
    include: {
      comandos: {
        orderBy: { id: 'asc' }
      }
    }
  })
}

export async function eliminarServicio(id: number): Promise<void> {
  const prisma = obtenerClientePrisma()
  await prisma.servicio.delete({
    where: { id }
  })
}
