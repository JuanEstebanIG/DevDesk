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
  const cantidad = await prisma.servicio.count({
    where: { proyectoId }
  })
  return cantidad + 1
}

export async function crearServicio(
  datos: CrearServicioRepositorioDatos
): Promise<ServicioConComandos> {
  const prisma = obtenerClientePrisma()

  return await prisma.$transaction(async (tx) => {
    const existentes = await tx.servicio.findMany({
      where: { proyectoId: datos.proyectoId },
      orderBy: [{ ordenArranque: 'asc' }, { id: 'asc' }],
      select: { id: true }
    })

    const creado = await tx.servicio.create({
      data: {
        proyectoId: datos.proyectoId,
        nombre: datos.nombre,
        path: datos.path,
        tipoHealthCheck: datos.tipoHealthCheck,
        objetivoHealthCheck: datos.objetivoHealthCheck,
        ordenArranque: existentes.length + 1,
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
      }
    })

    const idsOrdenados = existentes.map((s) => s.id)
    const indiceDestino = Math.max(
      0,
      Math.min(datos.ordenArranque - 1, idsOrdenados.length)
    )
    idsOrdenados.splice(indiceDestino, 0, creado.id)

    for (let i = 0; i < idsOrdenados.length; i++) {
      await tx.servicio.update({
        where: { id: idsOrdenados[i] },
        data: { ordenArranque: i + 1 }
      })
    }

    const servicioFinal = await tx.servicio.findUniqueOrThrow({
      where: { id: creado.id },
      include: {
        comandos: {
          orderBy: { id: 'asc' }
        }
      }
    })

    return servicioFinal
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

  return await prisma.$transaction(async (tx) => {
    const actual = await tx.servicio.findUniqueOrThrow({
      where: { id }
    })

    await tx.servicio.update({
      where: { id },
      data: {
        ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
        ...(datos.path !== undefined ? { path: datos.path } : {}),
        ...(datos.tipoHealthCheck !== undefined ? { tipoHealthCheck: datos.tipoHealthCheck } : {}),
        ...(datos.objetivoHealthCheck !== undefined
          ? { objetivoHealthCheck: datos.objetivoHealthCheck }
          : {})
      }
    })

    const todos = await tx.servicio.findMany({
      where: { proyectoId: actual.proyectoId },
      orderBy: [{ ordenArranque: 'asc' }, { id: 'asc' }],
      select: { id: true }
    })

    const idsSinActual = todos.filter((s) => s.id !== id).map((s) => s.id)
    const ordenSolicitado =
      datos.ordenArranque !== undefined ? datos.ordenArranque : actual.ordenArranque
    const indiceDestino = Math.max(
      0,
      Math.min(ordenSolicitado - 1, idsSinActual.length)
    )
    idsSinActual.splice(indiceDestino, 0, id)

    for (let i = 0; i < idsSinActual.length; i++) {
      await tx.servicio.update({
        where: { id: idsSinActual[i] },
        data: { ordenArranque: i + 1 }
      })
    }

    return await tx.servicio.findUniqueOrThrow({
      where: { id },
      include: {
        comandos: {
          orderBy: { id: 'asc' }
        }
      }
    })
  })
}

export async function reordenarServicios(
  proyectoId: number,
  idsServiciosEnOrden: number[]
): Promise<ServicioConComandos[]> {
  const prisma = obtenerClientePrisma()

  return await prisma.$transaction(async (tx) => {
    const actuales = await tx.servicio.findMany({
      where: { proyectoId },
      orderBy: [{ ordenArranque: 'asc' }, { id: 'asc' }],
      select: { id: true }
    })

    const conjuntoValidos = new Set(actuales.map((s) => s.id))
    const ordenFinal: number[] = []

    for (const id of idsServiciosEnOrden) {
      if (conjuntoValidos.has(id) && !ordenFinal.includes(id)) {
        ordenFinal.push(id)
      }
    }

    for (const s of actuales) {
      if (!ordenFinal.includes(s.id)) {
        ordenFinal.push(s.id)
      }
    }

    for (let i = 0; i < ordenFinal.length; i++) {
      await tx.servicio.update({
        where: { id: ordenFinal[i] },
        data: { ordenArranque: i + 1 }
      })
    }

    return await tx.servicio.findMany({
      where: { proyectoId },
      orderBy: [{ ordenArranque: 'asc' }, { id: 'asc' }],
      include: {
        comandos: {
          orderBy: { id: 'asc' }
        }
      }
    })
  })
}

export async function eliminarServicio(id: number): Promise<void> {
  const prisma = obtenerClientePrisma()

  await prisma.$transaction(async (tx) => {
    const servicio = await tx.servicio.findUnique({
      where: { id },
      select: { proyectoId: true }
    })

    await tx.servicio.delete({
      where: { id }
    })

    if (servicio) {
      const restantes = await tx.servicio.findMany({
        where: { proyectoId: servicio.proyectoId },
        orderBy: [{ ordenArranque: 'asc' }, { id: 'asc' }],
        select: { id: true }
      })

      for (let i = 0; i < restantes.length; i++) {
        await tx.servicio.update({
          where: { id: restantes[i].id },
          data: { ordenArranque: i + 1 }
        })
      }
    }
  })
}
