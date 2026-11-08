import type { Proyecto, Servicio, Comando } from '@prisma/client'
import { obtenerClientePrisma } from './clientePrisma'
import type { CrearProyectoDatos } from '../../compartido/tipos'

export type ProyectoConRelaciones = Proyecto & {
  servicios: (Servicio & {
    comandos: Comando[]
  })[]
}

export async function crearProyecto(datos: CrearProyectoDatos): Promise<ProyectoConRelaciones> {
  const prisma = obtenerClientePrisma()
  return await prisma.proyecto.create({
    data: {
      nombre: datos.nombre,
      path: datos.path
    },
    include: {
      servicios: {
        orderBy: { ordenArranque: 'asc' },
        include: { comandos: true }
      }
    }
  })
}

export async function listarProyectos(): Promise<ProyectoConRelaciones[]> {
  const prisma = obtenerClientePrisma()
  const proyectos = await prisma.proyecto.findMany({
    orderBy: { fechaCreacion: 'desc' },
    include: {
      servicios: {
        orderBy: [{ ordenArranque: 'asc' }, { id: 'asc' }],
        include: { comandos: true }
      }
    }
  })

  for (const proyecto of proyectos) {
    const requiereNormalizacion = proyecto.servicios.some(
      (srv, indice) => srv.ordenArranque !== indice + 1
    )
    if (requiereNormalizacion) {
      for (let i = 0; i < proyecto.servicios.length; i++) {
        const srv = proyecto.servicios[i]
        srv.ordenArranque = i + 1
        await prisma.servicio.update({
          where: { id: srv.id },
          data: { ordenArranque: i + 1 }
        })
      }
    }
  }

  return proyectos
}

export async function obtenerProyectoPorId(id: number): Promise<ProyectoConRelaciones | null> {
  const prisma = obtenerClientePrisma()
  return await prisma.proyecto.findUnique({
    where: { id },
    include: {
      servicios: {
        orderBy: { ordenArranque: 'asc' },
        include: { comandos: true }
      }
    }
  })
}

export async function obtenerProyectoPorPath(path: string): Promise<Proyecto | null> {
  const prisma = obtenerClientePrisma()
  return await prisma.proyecto.findUnique({
    where: { path }
  })
}

export async function eliminarProyecto(id: number): Promise<void> {
  const prisma = obtenerClientePrisma()
  await prisma.proyecto.delete({
    where: { id }
  })
}
