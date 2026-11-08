import { PrismaClient } from '@prisma/client'

let instanciaPrisma: PrismaClient | null = null

export function obtenerClientePrisma(): PrismaClient {
  if (!instanciaPrisma) {
    instanciaPrisma = new PrismaClient()
  }
  return instanciaPrisma
}
