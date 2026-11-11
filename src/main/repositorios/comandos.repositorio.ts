import type { Comando, Servicio } from '@prisma/client'
import { obtenerClientePrisma } from './clientePrisma'
import type { OrigenComando } from '../../compartido/tipos'

export type ComandoConServicio = Comando & {
  servicio: Servicio
}

export interface CrearComandoRepositorioDatos {
  servicioId: number
  etiqueta: string
  comando: string
  origen: OrigenComando
  esPrincipal: boolean
}

export async function obtenerComandoPorId(id: number): Promise<ComandoConServicio | null> {
  const prisma = obtenerClientePrisma()
  return await prisma.comando.findUnique({
    where: { id },
    include: {
      servicio: true
    }
  })
}

export async function listarComandosPorServicio(servicioId: number): Promise<Comando[]> {
  const prisma = obtenerClientePrisma()
  return await prisma.comando.findMany({
    where: { servicioId },
    orderBy: { id: 'asc' }
  })
}

export async function obtenerComandoPrincipalDeServicio(
  servicioId: number
): Promise<ComandoConServicio | null> {
  const prisma = obtenerClientePrisma()
  return await prisma.comando.findFirst({
    where: {
      servicioId,
      esPrincipal: true
    },
    include: {
      servicio: true
    }
  })
}

export async function crearComando(datos: CrearComandoRepositorioDatos): Promise<Comando> {
  const prisma = obtenerClientePrisma()
  return await prisma.$transaction(async (tx) => {
    if (datos.esPrincipal) {
      await tx.comando.updateMany({
        where: { servicioId: datos.servicioId },
        data: { esPrincipal: false }
      })
    }

    return await tx.comando.create({
      data: {
        servicioId: datos.servicioId,
        etiqueta: datos.etiqueta,
        comando: datos.comando,
        origen: datos.origen,
        esPrincipal: datos.esPrincipal
      }
    })
  })
}

export async function establecerComandoPrincipal(
  servicioId: number,
  comandoId: number
): Promise<Comando[]> {
  const prisma = obtenerClientePrisma()
  return await prisma.$transaction(async (tx) => {
    await tx.comando.updateMany({
      where: { servicioId },
      data: { esPrincipal: false }
    })

    await tx.comando.update({
      where: { id: comandoId },
      data: { esPrincipal: true }
    })

    return await tx.comando.findMany({
      where: { servicioId },
      orderBy: { id: 'asc' }
    })
  })
}

export async function eliminarComando(id: number): Promise<void> {
  const prisma = obtenerClientePrisma()
  await prisma.comando.delete({
    where: { id }
  })
}
