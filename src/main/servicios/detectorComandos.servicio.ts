import fs from 'fs'
import path from 'path'
import type { NuevoComandoInicial } from '../repositorios/servicios.repositorio'

interface PackageJsonEstructura {
  scripts?: Record<string, unknown>
}

export function detectarComandosEnCarpeta(rutaCarpeta: string): NuevoComandoInicial[] {
  const rutaPackageJson = path.join(rutaCarpeta, 'package.json')

  if (!fs.existsSync(rutaPackageJson)) {
    return []
  }

  try {
    const estadisticas = fs.statSync(rutaPackageJson)
    if (!estadisticas.isFile()) {
      return []
    }

    const contenidoRaw = fs.readFileSync(rutaPackageJson, 'utf-8')
    const parseado = JSON.parse(contenidoRaw) as PackageJsonEstructura

    if (!parseado.scripts || typeof parseado.scripts !== 'object') {
      return []
    }

    const entradasValidas = Object.entries(parseado.scripts).filter(
      ([etiqueta, script]) =>
        etiqueta.trim().length > 0 && typeof script === 'string' && script.trim().length > 0
    )

    if (entradasValidas.length === 0) {
      return []
    }

    const etiquetas = entradasValidas.map(([etiqueta]) => etiqueta.trim())
    const etiquetaPrincipalPorDefecto = etiquetas.includes('dev')
      ? 'dev'
      : etiquetas.includes('start')
        ? 'start'
        : etiquetas[0]

    return entradasValidas.map(([etiqueta]) => {
      const etiquetaLimpia = etiqueta.trim()
      return {
        etiqueta: etiquetaLimpia,
        comando: `npm run ${etiquetaLimpia}`,
        origen: 'detectado',
        esPrincipal: etiquetaLimpia === etiquetaPrincipalPorDefecto
      }
    })
  } catch {
    return []
  }
}
