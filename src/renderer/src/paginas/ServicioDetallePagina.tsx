import React, { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import type { ComandoDTO, EstadoEjecucion } from '../../../compartido/tipos'

function obtenerEtiquetaEstado(estado: EstadoEjecucion): {
  texto: string
  colorPunto: string
  colorTexto: string
} {
  switch (estado) {
    case 'listo':
      return {
        texto: 'Listo',
        colorPunto: 'bg-green shadow-[0_0_6px_rgba(42,216,130,0.5)]',
        colorTexto: 'text-green'
      }
    case 'iniciando':
      return {
        texto: 'Iniciando',
        colorPunto: 'bg-yellow shadow-[0_0_6px_rgba(245,176,39,0.5)]',
        colorTexto: 'text-yellow'
      }
    case 'error':
      return {
        texto: 'Error',
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

export function ServicioDetallePagina(): React.JSX.Element {
  const { proyectoId, servicioId } = useParams<{ proyectoId: string; servicioId: string }>()
  const idProyectoNum = Number(proyectoId)
  const idServicioNum = Number(servicioId)

  const {
    proyectos,
    cargandoProyectos,
    errorProyectos,
    estadosComandos,
    logsPorComando,
    cargarProyectos,
    iniciarServicio,
    detenerServicio,
    reiniciarServicio,
    crearComandoPersonalizado,
    establecerComandoPrincipal,
    eliminarComando,
    ejecutarComando,
    detenerComando,
    reiniciarComando,
    cargarLogsDeComando,
    limpiarLogsDeComando,
    limpiarError
  } = useAppStore()

  const [comandoSeleccionadoId, setComandoSeleccionadoId] = useState<number | null>(null)
  const [etiquetaNueva, setEtiquetaNueva] = useState('')
  const [comandoNuevo, setComandoNuevo] = useState('')
  const [marcarComoPrincipal, setMarcarComoPrincipal] = useState(false)
  const [guardandoComando, setGuardandoComando] = useState(false)
  const [operandoComandoId, setOperandoComandoId] = useState<number | null>(null)
  const [confirmandoEliminarCmdId, setConfirmandoEliminarCmdId] = useState<number | null>(null)

  const contenedorConsolaRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (proyectos.length === 0) {
      cargarProyectos()
    }
  }, [proyectos.length, cargarProyectos])

  const proyecto = proyectos.find((p) => p.id === idProyectoNum)
  const servicio = proyecto?.servicios?.find((s) => s.id === idServicioNum)
  const comandos = servicio?.comandos ?? []

  useEffect(() => {
    if (comandos.length === 0) {
      setComandoSeleccionadoId(null)
      return
    }
    const existeSeleccionado = comandos.some((c) => c.id === comandoSeleccionadoId)
    if (!existeSeleccionado) {
      const principal = comandos.find((c) => c.esPrincipal) ?? comandos[0]
      setComandoSeleccionadoId(principal.id)
    }
  }, [comandos, comandoSeleccionadoId])

  useEffect(() => {
    for (const cmd of comandos) {
      cargarLogsDeComando(cmd.id)
    }
  }, [servicio?.id, comandos.length, cargarLogsDeComando])

  const logsActivos = comandoSeleccionadoId ? (logsPorComando[comandoSeleccionadoId] ?? []) : []

  useEffect(() => {
    const nodo = contenedorConsolaRef.current
    if (nodo) {
      nodo.scrollTop = nodo.scrollHeight
    }
  }, [logsActivos.length, comandoSeleccionadoId])

  const manejarAccionComando = async (
    comando: ComandoDTO,
    accion: 'ejecutar' | 'detener' | 'reiniciar'
  ): Promise<void> => {
    setComandoSeleccionadoId(comando.id)
    setOperandoComandoId(comando.id)
    try {
      if (accion === 'ejecutar') {
        await ejecutarComando(comando.id)
      } else if (accion === 'detener') {
        await detenerComando(comando.id)
      } else {
        await reiniciarComando(comando.id)
      }
    } catch {
      // El store expone el error
    } finally {
      setOperandoComandoId(null)
    }
  }

  const manejarAgregarComando = async (evento: React.FormEvent): Promise<void> => {
    evento.preventDefault()
    if (!proyecto || !servicio || !etiquetaNueva.trim() || !comandoNuevo.trim()) return

    setGuardandoComando(true)
    try {
      const creado = await crearComandoPersonalizado(proyecto.id, {
        servicioId: servicio.id,
        etiqueta: etiquetaNueva.trim(),
        comando: comandoNuevo.trim(),
        esPrincipal: marcarComoPrincipal
      })
      setEtiquetaNueva('')
      setComandoNuevo('')
      setMarcarComoPrincipal(false)
      setComandoSeleccionadoId(creado.id)
    } catch {
      // El store expone el error
    } finally {
      setGuardandoComando(false)
    }
  }

  const manejarEliminarComando = async (comandoId: number): Promise<void> => {
    if (!proyecto || !servicio) return
    try {
      await eliminarComando(proyecto.id, servicio.id, comandoId)
      setConfirmandoEliminarCmdId(null)
    } catch {
      // El store expone el error
    }
  }

  if (cargandoProyectos && !servicio) {
    return (
      <div className="bg-surface border border-border p-8">
        <p className="text-sm font-mono text-txt-secondary">Cargando detalle del servicio...</p>
      </div>
    )
  }

  if (!proyecto || !servicio) {
    return (
      <div className="bg-surface border border-border border-l-[3px] border-l-red p-6 space-y-4">
        <h1 className="font-display text-lg font-bold text-txt">Servicio no encontrado</h1>
        <p className="text-sm text-txt-secondary">
          El servicio solicitado no existe o fue eliminado.
        </p>
        <div>
          <Link
            to={proyecto ? `/proyectos/${proyecto.id}` : '/'}
            className="inline-block bg-elevated border border-border hover:border-accent text-txt px-4 py-2 text-xs font-medium transition-colors duration-150"
          >
            Volver al proyecto
          </Link>
        </div>
      </div>
    )
  }

  const comandoPrincipal = comandos.find((c) => c.esPrincipal) ?? comandos[0] ?? null
  const estadoPrincipal: EstadoEjecucion = comandoPrincipal
    ? (estadosComandos[comandoPrincipal.id]?.estado ?? 'detenido')
    : 'detenido'
  const principalActivo = estadoPrincipal === 'listo' || estadoPrincipal === 'iniciando'
  const comandoEnConsola = comandos.find((c) => c.id === comandoSeleccionadoId) ?? null
  const estadoEnConsola: EstadoEjecucion = comandoEnConsola
    ? (estadosComandos[comandoEnConsola.id]?.estado ?? 'detenido')
    : 'detenido'
  const pidEnConsola = comandoEnConsola
    ? (estadosComandos[comandoEnConsola.id]?.pid ?? null)
    : null

  return (
    <div className="space-y-6">
      {/* Cabecera del servicio y controles del comando principal */}
      <div className="border-b border-border pb-5 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2 max-w-[70ch]">
          <div className="flex items-center gap-2 text-xs font-mono text-txt-secondary flex-wrap">
            <Link
              to={`/proyectos/${proyecto.id}`}
              className="hover:text-accent transition-colors duration-150 cursor-pointer"
            >
              ← {proyecto.nombre}
            </Link>
            <span className="text-border">/</span>
            <span className="text-txt">{servicio.path}</span>
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-txt">
            {servicio.nombre}
          </h1>
          <p className="text-sm text-txt-secondary">
            Ejecuta cualquier comando de forma independiente o define cuál se usará como comando
            principal al iniciar el servicio.
          </p>
        </div>

        {comandoPrincipal && (
          <div className="flex items-center gap-2 bg-surface border border-border p-2.5 self-start lg:self-auto">
            <div className="px-2 text-xs font-mono">
              <span className="text-txt-muted">Principal: </span>
              <span className="text-txt font-medium">{comandoPrincipal.etiqueta}</span>
            </div>
            {!principalActivo ? (
              <button
                type="button"
                onClick={() => {
                  setComandoSeleccionadoId(comandoPrincipal.id)
                  iniciarServicio(servicio.id)
                }}
                className="bg-elevated border border-accent text-txt hover:bg-accent/15 px-3 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer"
              >
                Iniciar servicio
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setComandoSeleccionadoId(comandoPrincipal.id)
                    reiniciarServicio(servicio.id)
                  }}
                  className="bg-elevated border border-border hover:border-txt-secondary text-txt-secondary hover:text-txt px-3 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer"
                >
                  Reiniciar servicio
                </button>
                <button
                  type="button"
                  onClick={() => detenerServicio(servicio.id)}
                  className="bg-elevated border border-red/50 text-red hover:bg-red/15 px-3 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer"
                >
                  Detener servicio
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {errorProyectos && (
        <div
          role="alert"
          className="bg-surface border border-border border-l-[3px] border-l-red px-4 py-3.5 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 text-sm text-txt">
            <span aria-hidden="true" className="inline-block w-2 h-2 bg-red shrink-0" />
            <div>
              <span className="font-medium text-red">Error: </span>
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
        {/* Columna izquierda: Lista de comandos y registro manual */}
        <section aria-label="Comandos del servicio" className="lg:col-span-5 space-y-5">
          <div className="bg-surface border border-border p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <h2 className="font-display text-[16px] font-bold text-txt tracking-tight">
                Comandos disponibles ({comandos.length})
              </h2>
              <span className="font-mono text-xs text-txt-muted">Ejecución concurrente</span>
            </div>

            {comandos.length === 0 ? (
              <div className="bg-elevated border border-border p-4 text-xs text-txt-secondary space-y-1">
                <p className="text-txt font-medium">
                  No se encontraron scripts en <code className="font-mono">package.json</code>.
                </p>
                <p>Usa el formulario inferior para registrar un comando personalizado.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {comandos.map((cmd) => {
                  const estadoCmd: EstadoEjecucion =
                    estadosComandos[cmd.id]?.estado ?? 'detenido'
                  const pidCmd = estadosComandos[cmd.id]?.pid ?? null
                  const ultimoErrorCmd = estadosComandos[cmd.id]?.ultimoError ?? null
                  const info = obtenerEtiquetaEstado(estadoCmd)
                  const estaCorriendo = estadoCmd === 'listo' || estadoCmd === 'iniciando'
                  const seleccionado = comandoSeleccionadoId === cmd.id
                  const operando = operandoComandoId === cmd.id
                  const confirmandoBorrar = confirmandoEliminarCmdId === cmd.id

                  return (
                    <div
                      key={cmd.id}
                      onClick={() => setComandoSeleccionadoId(cmd.id)}
                      className={`bg-elevated border ${
                        seleccionado ? 'border-accent' : 'border-border hover:border-txt-muted'
                      } p-3 space-y-2.5 transition-colors duration-150 cursor-pointer`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              aria-hidden="true"
                              className={`inline-block w-2 h-2 shrink-0 ${info.colorPunto}`}
                            />
                            <span className="font-mono text-sm font-bold text-txt">
                              {cmd.etiqueta}
                            </span>

                            {cmd.esPrincipal ? (
                              <span className="font-mono text-[11px] bg-accent/15 border border-accent text-txt px-1.5 py-0.5">
                                Principal
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  establecerComandoPrincipal(proyecto.id, servicio.id, cmd.id)
                                }}
                                className="font-mono text-[11px] text-txt-muted hover:text-txt border border-transparent hover:border-border px-1.5 py-0.5 transition-colors duration-150 cursor-pointer"
                              >
                                Hacer principal
                              </button>
                            )}

                            <span className="font-mono text-[11px] text-txt-muted">
                              {cmd.origen === 'detectado' ? 'package.json' : 'personalizado'}
                            </span>
                          </div>

                          <p className="font-mono text-xs text-txt-secondary truncate">
                            {cmd.comando}
                          </p>
                        </div>

                        <div className="font-mono text-[11px] text-right shrink-0">
                          <span className={info.colorTexto}>{info.texto}</span>
                          {pidCmd && <div className="text-txt-muted">PID {pidCmd}</div>}
                        </div>
                      </div>

                      {estadoCmd === 'error' && ultimoErrorCmd && (
                        <div className="bg-surface border border-red/40 border-l-2 border-l-red px-2.5 py-1.5 text-[11px] font-mono text-red break-words">
                          {ultimoErrorCmd}
                        </div>
                      )}

                      <div
                        className="flex items-center justify-between gap-2 pt-2 border-t border-border/70"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1.5">
                          {!estaCorriendo ? (
                            <button
                              type="button"
                              disabled={operando}
                              onClick={() => manejarAccionComando(cmd, 'ejecutar')}
                              className="bg-surface border border-accent text-txt hover:bg-accent/15 disabled:opacity-40 px-2.5 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer"
                            >
                              Ejecutar
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                disabled={operando}
                                onClick={() => manejarAccionComando(cmd, 'reiniciar')}
                                className="bg-surface border border-border hover:border-txt-secondary text-txt-secondary hover:text-txt disabled:opacity-40 px-2.5 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer"
                              >
                                Reiniciar
                              </button>
                              <button
                                type="button"
                                disabled={operando}
                                onClick={() => manejarAccionComando(cmd, 'detener')}
                                className="bg-surface border border-red/50 text-red hover:bg-red/15 disabled:opacity-40 px-2.5 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer"
                              >
                                Detener
                              </button>
                            </>
                          )}
                        </div>

                        {confirmandoBorrar ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => manejarEliminarComando(cmd.id)}
                              className="text-xs font-medium text-red hover:bg-red/15 px-2 py-0.5 transition-colors duration-150 cursor-pointer"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmandoEliminarCmdId(null)}
                              className="text-xs text-txt-secondary hover:text-txt px-1.5 py-0.5 transition-colors duration-150 cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmandoEliminarCmdId(cmd.id)}
                            className="text-xs text-txt-muted hover:text-red px-2 py-0.5 transition-colors duration-150 cursor-pointer"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Formulario para comando personalizado */}
          <form
            onSubmit={manejarAgregarComando}
            className="bg-surface border border-border border-t-2 border-t-accent p-4 space-y-3.5"
          >
            <div className="border-b border-border pb-2">
              <h3 className="font-display text-sm font-bold text-txt">
                Agregar comando personalizado
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="input-etiqueta-cmd" className="block text-xs font-medium text-txt">
                  Etiqueta
                </label>
                <input
                  id="input-etiqueta-cmd"
                  type="text"
                  value={etiquetaNueva}
                  onChange={(e) => setEtiquetaNueva(e.target.value)}
                  placeholder="Ej. prisma:studio"
                  className="w-full bg-elevated border border-border focus:border-accent focus:outline-none px-2.5 py-1.5 text-xs font-mono text-txt placeholder:text-txt-muted"
                  required
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="input-comando-str" className="block text-xs font-medium text-txt">
                  Comando a ejecutar
                </label>
                <input
                  id="input-comando-str"
                  type="text"
                  value={comandoNuevo}
                  onChange={(e) => setComandoNuevo(e.target.value)}
                  placeholder="Ej. npx prisma studio"
                  className="w-full bg-elevated border border-border focus:border-accent focus:outline-none px-2.5 py-1.5 text-xs font-mono text-txt placeholder:text-txt-muted"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-txt-secondary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={marcarComoPrincipal}
                  onChange={(e) => setMarcarComoPrincipal(e.target.checked)}
                  className="accent-accent cursor-pointer"
                />
                <span>Marcar como comando principal</span>
              </label>

              <button
                type="submit"
                disabled={guardandoComando || !etiquetaNueva.trim() || !comandoNuevo.trim()}
                className="bg-elevated border border-accent text-txt hover:bg-accent/15 disabled:opacity-40 px-3.5 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer"
              >
                {guardandoComando ? 'Agregando...' : 'Agregar comando'}
              </button>
            </div>
          </form>
        </section>

        {/* Columna derecha: Consola en tiempo real */}
        <section aria-label="Consola de salida en tiempo real" className="lg:col-span-7">
          <div className="bg-surface border border-border flex flex-col">
            <div className="border-b border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display text-sm font-bold text-txt">Consola en vivo</span>
                {comandoEnConsola && (
                  <span className="font-mono text-xs bg-elevated border border-border px-2 py-0.5 text-txt-secondary">
                    {comandoEnConsola.etiqueta} ({comandoEnConsola.comando})
                    {pidEnConsola ? ` · PID ${pidEnConsola}` : ''}
                  </span>
                )}
              </div>

              {comandoEnConsola && (
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span
                    aria-hidden="true"
                    className={`inline-block w-2 h-2 ${obtenerEtiquetaEstado(estadoEnConsola).colorPunto}`}
                  />
                  <span className={obtenerEtiquetaEstado(estadoEnConsola).colorTexto}>
                    {obtenerEtiquetaEstado(estadoEnConsola).texto}
                  </span>
                </div>
              )}
            </div>

            {comandos.length > 1 && (
              <div className="bg-elevated border-b border-border px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto">
                {comandos.map((cmd) => {
                  const est = estadosComandos[cmd.id]?.estado ?? 'detenido'
                  const activo = comandoSeleccionadoId === cmd.id
                  const cantidadLineas = (logsPorComando[cmd.id] ?? []).length
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      onClick={() => setComandoSeleccionadoId(cmd.id)}
                      className={`inline-flex items-center gap-2 px-2.5 py-1 text-xs font-mono border transition-colors duration-150 cursor-pointer shrink-0 ${
                        activo
                          ? 'bg-surface border-accent text-txt'
                          : 'bg-transparent border-transparent text-txt-secondary hover:text-txt'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`inline-block w-1.5 h-1.5 ${obtenerEtiquetaEstado(est).colorPunto}`}
                      />
                      <span>{cmd.etiqueta}</span>
                      {cantidadLineas > 0 && (
                        <span className="text-[10px] text-txt-muted">({cantidadLineas})</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Visor de terminal con posicionamiento absoluto interno y botón clear flotante */}
            <div className="relative h-[480px] bg-[#090b0e]">
              {comandoEnConsola && logsActivos.length > 0 && (
                <button
                  type="button"
                  onClick={() => limpiarLogsDeComando(comandoEnConsola.id)}
                  className="absolute top-2.5 right-3 z-10 bg-elevated border border-border px-2.5 py-1 text-[11px] font-mono text-txt-secondary hover:text-txt opacity-60 hover:opacity-100 transition-opacity duration-150 cursor-pointer"
                >
                  Limpiar consola
                </button>
              )}

              <div
                ref={contenedorConsolaRef}
                className="absolute inset-0 overflow-y-auto p-4 font-mono text-xs space-y-1 select-text"
              >
                {!comandoEnConsola ? (
                  <p className="text-txt-muted">
                    Selecciona o registra un comando para inspeccionar su salida.
                  </p>
                ) : logsActivos.length === 0 ? (
                  <div className="text-txt-muted space-y-1">
                    <p>
                      Sin salida en memoria para <span className="text-txt">{comandoEnConsola.etiqueta}</span>.
                    </p>
                    <p>
                      Haz clic en <span className="text-txt">Ejecutar</span> para iniciar el proceso y
                      capturar <code className="text-green">stdout</code> /{' '}
                      <code className="text-red">stderr</code> en tiempo real.
                    </p>
                  </div>
                ) : (
                  logsActivos.map((linea) => {
                    const claseColor =
                      linea.flujo === 'stderr'
                        ? 'text-red'
                        : linea.flujo === 'sistema'
                          ? 'text-txt-secondary'
                          : 'text-green'

                    return (
                      <div
                        key={linea.id}
                        className="leading-relaxed break-words whitespace-pre-wrap flex gap-2.5"
                      >
                        <span className="text-txt-muted select-none shrink-0">
                          [{linea.marcaTiempo}]
                        </span>
                        <span className={claseColor}>{linea.texto}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
