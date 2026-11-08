import React, { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'

function separarRuta(rutaCompleta: string): { directorioPadre: string; carpetaFinal: string } {
  const limpia = rutaCompleta.replace(/[/\\]+$/, '')
  const ultimoSeparador = Math.max(limpia.lastIndexOf('\\'), limpia.lastIndexOf('/'))
  if (ultimoSeparador === -1) {
    return { directorioPadre: '', carpetaFinal: limpia }
  }
  return {
    directorioPadre: limpia.slice(0, ultimoSeparador + 1),
    carpetaFinal: limpia.slice(ultimoSeparador + 1)
  }
}

export function ProyectosPagina(): React.JSX.Element {
  const {
    proyectos,
    cargandoProyectos,
    errorProyectos,
    cargarProyectos,
    crearProyecto,
    eliminarProyecto,
    limpiarError
  } = useAppStore()

  const [nombre, setNombre] = useState('')
  const [rutaCarpeta, setRutaCarpeta] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [confirmandoEliminarId, setConfirmandoEliminarId] = useState<number | null>(null)
  const [proyectoActivoId, setProyectoActivoId] = useState<number | null>(null)

  useEffect(() => {
    cargarProyectos()
  }, [cargarProyectos])

  const manejarSeleccionarCarpeta = async (): Promise<void> => {
    limpiarError()
    const carpetaSeleccionada = await window.api.dialogos.abrirCarpeta(rutaCarpeta || undefined)
    if (carpetaSeleccionada) {
      setRutaCarpeta(carpetaSeleccionada)
      if (!nombre.trim()) {
        const segmentos = carpetaSeleccionada.split(/[/\\]/).filter(Boolean)
        const ultimoSegmento = segmentos[segmentos.length - 1]
        if (ultimoSegmento) {
          setNombre(ultimoSegmento)
        }
      }
    }
  }

  const manejarCrearProyecto = async (evento: React.FormEvent): Promise<void> => {
    evento.preventDefault()
    if (!nombre.trim() || !rutaCarpeta.trim()) return

    setGuardando(true)
    try {
      const creado = await crearProyecto({
        nombre: nombre.trim(),
        path: rutaCarpeta.trim()
      })
      setNombre('')
      setRutaCarpeta('')
      setProyectoActivoId(creado.id)
    } catch {
      // El store ya captura y expone errorProyectos
    } finally {
      setGuardando(false)
    }
  }

  const manejarEliminarProyecto = async (id: number): Promise<void> => {
    try {
      await eliminarProyecto(id)
      setConfirmandoEliminarId(null)
      if (proyectoActivoId === id) {
        setProyectoActivoId(null)
      }
    } catch {
      // El store ya captura y expone errorProyectos
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-[65ch]">
          <h1 className="font-display text-2xl font-bold tracking-tight text-txt">
            Proyectos en este equipo
          </h1>
          <p className="text-sm text-txt-secondary leading-relaxed">
            Vincula las carpetas raíz de tus aplicaciones para detectar sus scripts y coordinar el
            arranque de servicios locales desde un solo tablero.
          </p>
        </div>
      </div>

      {errorProyectos && (
        <div
          role="alert"
          className="bg-surface border border-border border-l-[3px] border-l-red px-4 py-3.5 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 text-sm text-txt">
            <span aria-hidden="true" className="inline-block w-2 h-2 bg-red shrink-0" />
            <div>
              <span className="font-medium text-red">No se pudo completar la operación: </span>
              <span className="text-txt-secondary">{errorProyectos}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={limpiarError}
            className="text-xs font-mono text-txt-secondary hover:text-txt bg-elevated border border-border px-2.5 py-1 transition-colors duration-150 cursor-pointer shrink-0"
          >
            Cerrar aviso
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna principal: Bahías de rack de proyectos */}
        <section aria-label="Listado de proyectos" className="lg:col-span-8 space-y-3">
          {cargandoProyectos ? (
            <div className="bg-surface border border-border p-8">
              <p className="text-sm text-txt-secondary font-mono">
                Leyendo proyectos registrados en disco...
              </p>
            </div>
          ) : proyectos.length === 0 ? (
            <div className="bg-surface border border-border border-l-[3px] border-l-accent p-6 space-y-5">
              <div className="space-y-1.5 max-w-[60ch]">
                <h2 className="font-display text-lg font-semibold text-txt">
                  Ningún proyecto vinculado todavía
                </h2>
                <p className="text-sm text-txt-secondary">
                  Selecciona una carpeta local desde el panel lateral o usa el botón de abajo para
                  registrar tu primer entorno de trabajo.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="bg-elevated border border-border p-3.5 space-y-1">
                  <span className="font-mono text-xs text-accent font-medium">Paso 1</span>
                  <p className="text-xs text-txt font-medium">Vincula la carpeta raíz</p>
                  <p className="text-xs text-txt-secondary">
                    Elige el directorio donde viven tus repositorios o paquetes.
                  </p>
                </div>
                <div className="bg-elevated border border-border p-3.5 space-y-1">
                  <span className="font-mono text-xs text-txt-muted font-medium">Paso 2</span>
                  <p className="text-xs text-txt font-medium">Agrega sus servicios</p>
                  <p className="text-xs text-txt-secondary">
                    DevDesk leerá los scripts de cada <code className="font-mono">package.json</code>.
                  </p>
                </div>
                <div className="bg-elevated border border-border p-3.5 space-y-1">
                  <span className="font-mono text-xs text-txt-muted font-medium">Paso 3</span>
                  <p className="text-xs text-txt font-medium">Inicia en secuencia</p>
                  <p className="text-xs text-txt-secondary">
                    Arranca todo el grupo verificando puertos antes de avanzar.
                  </p>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={manejarSeleccionarCarpeta}
                  className="bg-elevated border border-accent text-txt hover:bg-accent/15 px-4 py-2 text-xs font-medium transition-colors duration-150 cursor-pointer"
                >
                  Elegir primera carpeta...
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {proyectos.map((proyecto) => {
                const cantidadServicios = proyecto.servicios?.length ?? 0
                const confirmando = confirmandoEliminarId === proyecto.id
                const esActivo = proyectoActivoId === proyecto.id
                const { directorioPadre, carpetaFinal } = separarRuta(proyecto.path)

                return (
                  <article
                    key={proyecto.id}
                    onClick={() => setProyectoActivoId(proyecto.id)}
                    className={`bg-surface border border-border border-l-[3px] ${
                      esActivo ? 'border-l-accent' : 'border-l-border hover:border-l-accent'
                    } p-4 transition-colors duration-150`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h2 className="font-display text-[16px] font-bold text-txt tracking-tight truncate">
                            {proyecto.nombre}
                          </h2>
                          <span className="font-mono text-xs bg-elevated border border-border px-2 py-0.5 text-txt-secondary">
                            {cantidadServicios}{' '}
                            {cantidadServicios === 1 ? 'servicio' : 'servicios'}
                          </span>
                        </div>

                        <div
                          title={proyecto.path}
                          className="font-mono text-xs bg-elevated border border-border px-2.5 py-1.5 truncate flex items-center"
                        >
                          <span className="text-txt-secondary truncate">{directorioPadre}</span>
                          <span className="text-txt font-medium shrink-0">{carpetaFinal}</span>
                        </div>
                      </div>

                      <div
                        className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {confirmando ? (
                          <div className="flex items-center gap-2 bg-elevated border border-red/40 px-2.5 py-1">
                            <span className="text-xs text-txt">¿Quitar del registro?</span>
                            <button
                              type="button"
                              onClick={() => manejarEliminarProyecto(proyecto.id)}
                              className="text-xs font-medium text-red hover:bg-red/15 px-2 py-0.5 transition-colors duration-150 cursor-pointer"
                            >
                              Quitar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmandoEliminarId(null)}
                              className="text-xs text-txt-secondary hover:text-txt px-2 py-0.5 transition-colors duration-150 cursor-pointer"
                            >
                              Conservar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmandoEliminarId(proyecto.id)}
                            className="text-xs text-txt-secondary hover:text-red hover:bg-red/10 border border-transparent hover:border-red/25 px-2.5 py-1.5 transition-colors duration-150 cursor-pointer"
                          >
                            Quitar proyecto
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {/* Columna lateral: Panel de registro siempre acoplado */}
        <aside className="lg:col-span-4 lg:sticky lg:top-16">
          <form
            onSubmit={manejarCrearProyecto}
            className="bg-surface border border-border border-t-2 border-t-accent p-5 space-y-4"
          >
            <div className="border-b border-border pb-3 space-y-1">
              <h2 className="font-display text-[16px] font-bold text-txt tracking-tight">
                Registrar proyecto
              </h2>
              <p className="text-xs text-txt-secondary">
                Selecciona una carpeta existente en tu disco para agregarla al tablero.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="input-ruta-carpeta"
                  className="block text-xs font-medium text-txt"
                >
                  Carpeta raíz
                </label>
                <div className="flex gap-2">
                  <input
                    id="input-ruta-carpeta"
                    type="text"
                    value={rutaCarpeta}
                    onChange={(e) => setRutaCarpeta(e.target.value)}
                    placeholder="C:\dev\mi-proyecto"
                    className="flex-1 min-w-0 bg-elevated border border-border focus:border-accent focus:outline-none px-3 py-2 text-xs font-mono text-txt placeholder:text-txt-muted transition-colors duration-150"
                    required
                  />
                  <button
                    type="button"
                    onClick={manejarSeleccionarCarpeta}
                    className="bg-elevated border border-border hover:border-txt-secondary hover:text-txt text-txt-secondary px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors duration-150 cursor-pointer"
                  >
                    Elegir carpeta...
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="input-nombre-proyecto"
                  className="block text-xs font-medium text-txt"
                >
                  Nombre del proyecto
                </label>
                <input
                  id="input-nombre-proyecto"
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Plataforma StudyGo"
                  className="w-full bg-elevated border border-border focus:border-accent focus:outline-none px-3 py-2 text-sm font-sans text-txt placeholder:text-txt-muted transition-colors duration-150"
                  required
                />
                <p className="text-[11px] text-txt-muted">
                  Se completa automáticamente con el nombre de la carpeta al elegirla.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              {(nombre.trim() || rutaCarpeta.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setNombre('')
                    setRutaCarpeta('')
                    limpiarError()
                  }}
                  className="bg-elevated border border-border hover:border-txt-secondary text-txt-secondary hover:text-txt px-3 py-2 text-xs font-medium transition-colors duration-150 cursor-pointer"
                >
                  Limpiar
                </button>
              )}
              <button
                type="submit"
                disabled={guardando || !nombre.trim() || !rutaCarpeta.trim()}
                className="w-full sm:w-auto flex-1 bg-elevated border border-accent text-txt hover:bg-accent/15 disabled:opacity-40 disabled:pointer-events-none px-4 py-2 text-xs font-medium transition-colors duration-150 cursor-pointer"
              >
                {guardando ? 'Guardando proyecto...' : 'Guardar proyecto'}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  )
}
