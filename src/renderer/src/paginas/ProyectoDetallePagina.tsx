import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import type { EstadoEjecucion, ServicioDTO } from '../../../compartido/tipos'

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

function obtenerEtiquetaEstado(estado: EstadoEjecucion): {
  texto: string
  colorPunto: string
  colorTexto: string
} {
  switch (estado) {
    case 'listo':
      return {
        texto: 'En ejecución',
        colorPunto: 'bg-green shadow-[0_0_6px_rgba(42,216,130,0.5)]',
        colorTexto: 'text-green'
      }
    case 'iniciando':
      return {
        texto: 'Iniciando...',
        colorPunto: 'bg-yellow shadow-[0_0_6px_rgba(245,176,39,0.5)]',
        colorTexto: 'text-yellow'
      }
    case 'error':
      return {
        texto: 'Con fallo',
        colorPunto: 'bg-red shadow-[0_0_6px_rgba(240,68,82,0.5)]',
        colorTexto: 'text-red'
      }
    default:
      return {
        texto: 'Detenido',
        colorPunto: 'bg-txt-muted',
        colorTexto: 'text-txt-secondary'
      }
  }
}

export function ProyectoDetallePagina(): React.JSX.Element {
  const { proyectoId } = useParams<{ proyectoId: string }>()
  const navegar = useNavigate()
  const idNumerico = Number(proyectoId)

  const {
    proyectos,
    cargandoProyectos,
    errorProyectos,
    estadosComandos,
    cargarProyectos,
    crearServicio,
    eliminarServicio,
    iniciarServicio,
    detenerServicio,
    reiniciarServicio,
    limpiarError
  } = useAppStore()

  const [nombreServicio, setNombreServicio] = useState('')
  const [rutaServicio, setRutaServicio] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [confirmandoEliminarId, setConfirmandoEliminarId] = useState<number | null>(null)
  const [operandoServicioId, setOperandoServicioId] = useState<number | null>(null)

  useEffect(() => {
    if (proyectos.length === 0) {
      cargarProyectos()
    }
  }, [proyectos.length, cargarProyectos])

  const proyecto = proyectos.find((p) => p.id === idNumerico)

  const manejarSeleccionarCarpeta = async (): Promise<void> => {
    if (!proyecto) return
    limpiarError()
    const rutaPorDefecto = rutaServicio.trim() || proyecto.path
    const carpetaSeleccionada = await window.api.dialogos.abrirCarpeta(rutaPorDefecto)
    if (carpetaSeleccionada) {
      setRutaServicio(carpetaSeleccionada)
      if (!nombreServicio.trim()) {
        const segmentos = carpetaSeleccionada.split(/[/\\]/).filter(Boolean)
        const ultimoSegmento = segmentos[segmentos.length - 1]
        if (ultimoSegmento) {
          setNombreServicio(ultimoSegmento)
        }
      }
    }
  }

  const manejarCrearServicio = async (evento: React.FormEvent): Promise<void> => {
    evento.preventDefault()
    if (!proyecto || !nombreServicio.trim() || !rutaServicio.trim()) return

    setGuardando(true)
    try {
      const creado = await crearServicio({
        proyectoId: proyecto.id,
        nombre: nombreServicio.trim(),
        path: rutaServicio.trim()
      })
      setNombreServicio('')
      setRutaServicio('')
      navegar(`/proyectos/${proyecto.id}/servicios/${creado.id}`)
    } catch {
      // El store expone el error
    } finally {
      setGuardando(false)
    }
  }

  const manejarEliminarServicio = async (servicioId: number): Promise<void> => {
    if (!proyecto) return
    try {
      await eliminarServicio(proyecto.id, servicioId)
      setConfirmandoEliminarId(null)
    } catch {
      // El store expone el error
    }
  }

  const manejarAccionPrincipal = async (
    servicio: ServicioDTO,
    accion: 'iniciar' | 'detener' | 'reiniciar'
  ): Promise<void> => {
    setOperandoServicioId(servicio.id)
    try {
      if (accion === 'iniciar') {
        await iniciarServicio(servicio.id)
      } else if (accion === 'detener') {
        await detenerServicio(servicio.id)
      } else {
        await reiniciarServicio(servicio.id)
      }
    } catch {
      // El store expone el error
    } finally {
      setOperandoServicioId(null)
    }
  }

  if (cargandoProyectos && !proyecto) {
    return (
      <div className="bg-surface border border-border p-8">
        <p className="text-sm font-mono text-txt-secondary">Cargando proyecto...</p>
      </div>
    )
  }

  if (!proyecto) {
    return (
      <div className="bg-surface border border-border border-l-[3px] border-l-red p-6 space-y-4">
        <h1 className="font-display text-lg font-bold text-txt">Proyecto no encontrado</h1>
        <p className="text-sm text-txt-secondary">
          El proyecto solicitado no existe o fue eliminado del registro.
        </p>
        <div>
          <Link
            to="/"
            className="inline-block bg-elevated border border-border hover:border-accent text-txt px-4 py-2 text-xs font-medium transition-colors duration-150"
          >
            Volver a proyectos
          </Link>
        </div>
      </div>
    )
  }

  const servicios = proyecto.servicios ?? []

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 max-w-[70ch]">
          <div className="flex items-center gap-2 text-xs font-mono text-txt-secondary">
            <Link
              to="/"
              className="hover:text-accent transition-colors duration-150 cursor-pointer"
            >
              ← Proyectos
            </Link>
            <span className="text-border">/</span>
            <span className="text-txt">{proyecto.path}</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-txt">
            {proyecto.nombre}
          </h1>
          <p className="text-sm text-txt-secondary leading-relaxed">
            Registra cada servicio del proyecto eligiendo su subcarpeta. DevDesk detectará
            automáticamente todos los scripts de su <code className="font-mono">package.json</code>.
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
              <span className="font-medium text-red">Operación interrumpida: </span>
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
        {/* Listado de servicios del proyecto */}
        <section aria-label="Servicios del proyecto" className="lg:col-span-8 space-y-3">
          {servicios.length === 0 ? (
            <div className="bg-surface border border-border border-l-[3px] border-l-accent p-6 space-y-4">
              <div className="space-y-1.5 max-w-[60ch]">
                <h2 className="font-display text-lg font-semibold text-txt">
                  Este proyecto aún no tiene servicios
                </h2>
                <p className="text-sm text-txt-secondary">
                  Agrega un servicio desde el panel derecho seleccionando su carpeta (por ejemplo,
                  la carpeta del frontend, backend o API). El selector se abrirá directamente en{' '}
                  <code className="font-mono text-txt">{proyecto.path}</code>.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={manejarSeleccionarCarpeta}
                  className="bg-elevated border border-accent text-txt hover:bg-accent/15 px-4 py-2 text-xs font-medium transition-colors duration-150 cursor-pointer"
                >
                  Elegir carpeta de servicio...
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {servicios.map((servicio) => {
                const comandos = servicio.comandos ?? []
                const comandoPrincipal =
                  comandos.find((cmd) => cmd.esPrincipal) ?? comandos[0] ?? null
                const estadoPrincipal: EstadoEjecucion = comandoPrincipal
                  ? (estadosComandos[comandoPrincipal.id]?.estado ?? 'detenido')
                  : 'detenido'
                const pidPrincipal = comandoPrincipal
                  ? (estadosComandos[comandoPrincipal.id]?.pid ?? null)
                  : null
                const comandosCorriendo = comandos.filter((cmd) => {
                  const est = estadosComandos[cmd.id]?.estado
                  return est === 'listo' || est === 'iniciando'
                }).length

                const infoEstado = obtenerEtiquetaEstado(estadoPrincipal)
                const { directorioPadre, carpetaFinal } = separarRuta(servicio.path)
                const confirmando = confirmandoEliminarId === servicio.id
                const operando = operandoServicioId === servicio.id
                const estaActivo = estadoPrincipal === 'listo' || estadoPrincipal === 'iniciando'

                return (
                  <article
                    key={servicio.id}
                    className={`bg-surface border border-border border-l-[3px] ${
                      estaActivo
                        ? 'border-l-green'
                        : estadoPrincipal === 'error'
                          ? 'border-l-red'
                          : 'border-l-border hover:border-l-accent'
                    } p-4 transition-colors duration-150 space-y-3`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <Link
                            to={`/proyectos/${proyecto.id}/servicios/${servicio.id}`}
                            className="font-display text-[16px] font-bold text-txt hover:text-accent tracking-tight transition-colors duration-150 truncate cursor-pointer"
                          >
                            {servicio.nombre}
                          </Link>

                          <span className="inline-flex items-center gap-1.5 font-mono text-xs bg-elevated border border-border px-2 py-0.5">
                            <span
                              aria-hidden="true"
                              className={`inline-block w-1.5 h-1.5 ${infoEstado.colorPunto}`}
                            />
                            <span className={infoEstado.colorTexto}>{infoEstado.texto}</span>
                            {pidPrincipal && (
                              <span className="text-txt-muted">· PID {pidPrincipal}</span>
                            )}
                          </span>

                          {comandosCorriendo > 1 && (
                            <span className="font-mono text-xs bg-elevated border border-green/40 text-green px-2 py-0.5">
                              {comandosCorriendo} comandos activos
                            </span>
                          )}
                        </div>

                        <div
                          title={servicio.path}
                          className="font-mono text-xs bg-elevated border border-border px-2.5 py-1.5 truncate flex items-center"
                        >
                          <span className="text-txt-secondary truncate">{directorioPadre}</span>
                          <span className="text-txt font-medium shrink-0">{carpetaFinal}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {comandoPrincipal && (
                          <>
                            {!estaActivo ? (
                              <button
                                type="button"
                                disabled={operando}
                                onClick={() => manejarAccionPrincipal(servicio, 'iniciar')}
                                className="bg-elevated border border-accent text-txt hover:bg-accent/15 disabled:opacity-40 px-3 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer"
                              >
                                Iniciar ({comandoPrincipal.etiqueta})
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  disabled={operando}
                                  onClick={() => manejarAccionPrincipal(servicio, 'reiniciar')}
                                  className="bg-elevated border border-border hover:border-txt-secondary text-txt-secondary hover:text-txt disabled:opacity-40 px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer"
                                >
                                  Reiniciar
                                </button>
                                <button
                                  type="button"
                                  disabled={operando}
                                  onClick={() => manejarAccionPrincipal(servicio, 'detener')}
                                  className="bg-elevated border border-red/50 text-red hover:bg-red/15 disabled:opacity-40 px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer"
                                >
                                  Detener
                                </button>
                              </>
                            )}
                          </>
                        )}

                        <Link
                          to={`/proyectos/${proyecto.id}/servicios/${servicio.id}`}
                          className="bg-elevated border border-border hover:border-accent text-txt px-3 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer"
                        >
                          Comandos y consola ({comandos.length})
                        </Link>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="font-mono text-txt-secondary truncate">
                        {comandoPrincipal ? (
                          <span>
                            Principal:{' '}
                            <span className="text-txt font-medium">
                              {comandoPrincipal.etiqueta}
                            </span>{' '}
                            <span className="text-txt-muted">({comandoPrincipal.comando})</span>
                          </span>
                        ) : (
                          <span className="text-txt-muted">
                            Sin comandos detectados — entra al detalle para agregar uno manual
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-end shrink-0">
                        {confirmando ? (
                          <div className="flex items-center gap-2 bg-elevated border border-red/40 px-2.5 py-1">
                            <span className="text-xs text-txt">¿Eliminar servicio?</span>
                            <button
                              type="button"
                              onClick={() => manejarEliminarServicio(servicio.id)}
                              className="text-xs font-medium text-red hover:bg-red/15 px-2 py-0.5 transition-colors duration-150 cursor-pointer"
                            >
                              Eliminar
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
                            onClick={() => setConfirmandoEliminarId(servicio.id)}
                            className="text-xs text-txt-secondary hover:text-red hover:bg-red/10 px-2 py-1 transition-colors duration-150 cursor-pointer"
                          >
                            Quitar servicio
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

        {/* Panel acoplado: Registrar nuevo servicio */}
        <aside className="lg:col-span-4 lg:sticky lg:top-16">
          <form
            onSubmit={manejarCrearServicio}
            className="bg-surface border border-border border-t-2 border-t-accent p-5 space-y-4"
          >
            <div className="border-b border-border pb-3 space-y-1">
              <h2 className="font-display text-[16px] font-bold text-txt tracking-tight">
                Registrar servicio
              </h2>
              <p className="text-xs text-txt-secondary">
                El selector se abrirá en la carpeta raíz de{' '}
                <span className="text-txt font-medium">{proyecto.nombre}</span>.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="input-ruta-servicio"
                  className="block text-xs font-medium text-txt"
                >
                  Carpeta del servicio
                </label>
                <div className="flex gap-2">
                  <input
                    id="input-ruta-servicio"
                    type="text"
                    value={rutaServicio}
                    onChange={(e) => setRutaServicio(e.target.value)}
                    placeholder={proyecto.path}
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
                  htmlFor="input-nombre-servicio"
                  className="block text-xs font-medium text-txt"
                >
                  Nombre del servicio
                </label>
                <input
                  id="input-nombre-servicio"
                  type="text"
                  value={nombreServicio}
                  onChange={(e) => setNombreServicio(e.target.value)}
                  placeholder="Ej. API Backend o Web App"
                  className="w-full bg-elevated border border-border focus:border-accent focus:outline-none px-3 py-2 text-sm font-sans text-txt placeholder:text-txt-muted transition-colors duration-150"
                  required
                />
                <p className="text-[11px] text-txt-muted">
                  Al guardar, se detectarán automáticamente todos los scripts de su{' '}
                  <code className="font-mono">package.json</code> como{' '}
                  <code className="font-mono">npm run &lt;script&gt;</code>.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              {(nombreServicio.trim() || rutaServicio.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setNombreServicio('')
                    setRutaServicio('')
                    limpiarError()
                  }}
                  className="bg-elevated border border-border hover:border-txt-secondary text-txt-secondary hover:text-txt px-3 py-2 text-xs font-medium transition-colors duration-150 cursor-pointer"
                >
                  Limpiar
                </button>
              )}
              <button
                type="submit"
                disabled={guardando || !nombreServicio.trim() || !rutaServicio.trim()}
                className="w-full sm:w-auto flex-1 bg-elevated border border-accent text-txt hover:bg-accent/15 disabled:opacity-40 disabled:pointer-events-none px-4 py-2 text-xs font-medium transition-colors duration-150 cursor-pointer"
              >
                {guardando ? 'Detectando comandos...' : 'Guardar servicio'}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  )
}
