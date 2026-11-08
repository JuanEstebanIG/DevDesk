import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import type { EstadoEjecucion, ServicioDTO, TipoHealthCheck } from '../../../compartido/tipos'

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
        texto: 'Listo',
        colorPunto: 'bg-green shadow-[0_0_6px_rgba(42,216,130,0.5)]',
        colorTexto: 'text-green'
      }
    case 'iniciando':
      return {
        texto: 'Iniciando (verificando)',
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

export function ProyectoDetallePagina(): React.JSX.Element {
  const { proyectoId } = useParams<{ proyectoId: string }>()
  const navegar = useNavigate()
  const idNumerico = Number(proyectoId)

  const {
    proyectos,
    cargandoProyectos,
    errorProyectos,
    estadosComandos,
    estadosGrupos,
    cargarProyectos,
    crearServicio,
    actualizarServicio,
    reordenarServicios,
    eliminarServicio,
    iniciarServicio,
    detenerServicio,
    reiniciarServicio,
    iniciarGrupoProyecto,
    detenerGrupoProyecto,
    limpiarError
  } = useAppStore()

  const [nombreServicio, setNombreServicio] = useState('')
  const [rutaServicio, setRutaServicio] = useState('')
  const [tipoHealthNuevo, setTipoHealthNuevo] = useState<TipoHealthCheck>('none')
  const [objetivoHealthNuevo, setObjetivoHealthNuevo] = useState('')
  const [ordenNuevo, setOrdenNuevo] = useState<number>(1)
  const [guardando, setGuardando] = useState(false)

  const [confirmandoEliminarId, setConfirmandoEliminarId] = useState<number | null>(null)
  const [operandoServicioId, setOperandoServicioId] = useState<number | null>(null)

  const [editandoServicioId, setEditandoServicioId] = useState<number | null>(null)
  const [ordenEdicion, setOrdenEdicion] = useState<number>(1)
  const [tipoHealthEdicion, setTipoHealthEdicion] = useState<TipoHealthCheck>('none')
  const [objetivoHealthEdicion, setObjetivoHealthEdicion] = useState<string>('')
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  const [arrastrandoId, setArrastrandoId] = useState<number | null>(null)
  const [sobreDestinoId, setSobreDestinoId] = useState<number | null>(null)

  useEffect(() => {
    cargarProyectos()
  }, [cargarProyectos])

  const proyecto = proyectos.find((p) => p.id === idNumerico)
  const servicios = proyecto?.servicios ?? []
  const totalOpcionesNuevoOrden = servicios.length + 1

  useEffect(() => {
    setOrdenNuevo(servicios.length + 1)
  }, [servicios.length])

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
        path: rutaServicio.trim(),
        tipoHealthCheck: tipoHealthNuevo,
        objetivoHealthCheck: tipoHealthNuevo === 'none' ? null : objetivoHealthNuevo.trim(),
        ordenArranque: ordenNuevo
      })
      setNombreServicio('')
      setRutaServicio('')
      setTipoHealthNuevo('none')
      setObjetivoHealthNuevo('')
      navegar(`/proyectos/${proyecto.id}/servicios/${creado.id}`)
    } catch {
      // El store expone el error
    } finally {
      setGuardando(false)
    }
  }

  const manejarCambioOrdenRapido = async (
    servicioId: number,
    nuevoOrden: number
  ): Promise<void> => {
    if (!proyecto) return
    await actualizarServicio(proyecto.id, servicioId, {
      ordenArranque: nuevoOrden
    })
  }

  const manejarSoltarServicio = async (destinoId: number): Promise<void> => {
    if (!proyecto || arrastrandoId === null || arrastrandoId === destinoId) {
      setArrastrandoId(null)
      setSobreDestinoId(null)
      return
    }

    const idsActuales = servicios.map((s) => s.id)
    const indiceOrigen = idsActuales.indexOf(arrastrandoId)
    const indiceDestino = idsActuales.indexOf(destinoId)

    if (indiceOrigen === -1 || indiceDestino === -1) {
      setArrastrandoId(null)
      setSobreDestinoId(null)
      return
    }

    const nuevaSecuencia = [...idsActuales]
    const [movido] = nuevaSecuencia.splice(indiceOrigen, 1)
    nuevaSecuencia.splice(indiceDestino, 0, movido)

    setArrastrandoId(null)
    setSobreDestinoId(null)
    await reordenarServicios(proyecto.id, nuevaSecuencia)
  }

  const abrirEdicionServicio = (servicio: ServicioDTO): void => {
    setEditandoServicioId(servicio.id)
    setOrdenEdicion(servicio.ordenArranque)
    setTipoHealthEdicion(
      servicio.tipoHealthCheck === 'http' || servicio.tipoHealthCheck === 'tcp'
        ? servicio.tipoHealthCheck
        : 'none'
    )
    setObjetivoHealthEdicion(servicio.objetivoHealthCheck ?? '')
  }

  const manejarGuardarEdicion = async (
    evento: React.FormEvent,
    servicioId: number
  ): Promise<void> => {
    evento.preventDefault()
    if (!proyecto) return

    setGuardandoEdicion(true)
    try {
      await actualizarServicio(proyecto.id, servicioId, {
        ordenArranque: ordenEdicion,
        tipoHealthCheck: tipoHealthEdicion,
        objetivoHealthCheck:
          tipoHealthEdicion === 'none' ? null : objetivoHealthEdicion.trim()
      })
      setEditandoServicioId(null)
    } catch {
      // El store expone el error
    } finally {
      setGuardandoEdicion(false)
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

  const estadoGrupo = estadosGrupos[proyecto.id]
  const grupoEnCurso = Boolean(estadoGrupo?.enCurso)
  const serviciosActivosCount = servicios.filter((srv) => {
    const activos = (srv.comandos ?? []).some((cmd) => {
      const est = estadosComandos[cmd.id]?.estado
      return est === 'listo' || est === 'iniciando'
    })
    return activos
  }).length
  const serviciosListosCount = servicios.filter((srv) => {
    const cmdPrincipal =
      (srv.comandos ?? []).find((c) => c.esPrincipal) ?? (srv.comandos ?? [])[0]
    return cmdPrincipal ? estadosComandos[cmdPrincipal.id]?.estado === 'listo' : false
  }).length

  return (
    <div className="space-y-6">
      {/* Cabecera de proyecto y barra de control de grupo */}
      <div className="border-b border-border pb-5 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2 max-w-[68ch]">
          <div className="flex items-center gap-2 text-xs font-mono text-txt-secondary flex-wrap">
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
            Haz clic en cualquier servicio para abrir sus comandos y consola, o arrastra desde el
            mango <span className="font-mono text-txt">⠿</span> / usa el selector de orden para
            ajustar la secuencia de arranque del grupo.
          </p>
        </div>

        {servicios.length > 0 && (
          <div className="bg-surface border border-border p-3 flex flex-wrap items-center gap-3 self-start lg:self-auto">
            <div className="font-mono text-xs px-1">
              <span className="text-txt-secondary">Grupo: </span>
              <span className="text-txt font-medium">
                {serviciosListosCount}/{servicios.length} listos
              </span>
            </div>

            <button
              type="button"
              disabled={grupoEnCurso}
              onClick={() => iniciarGrupoProyecto(proyecto.id)}
              className="bg-elevated border border-accent text-txt hover:bg-accent/15 disabled:opacity-40 px-3.5 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer"
            >
              {grupoEnCurso ? 'Iniciando secuencia...' : 'Iniciar grupo en orden'}
            </button>

            {(serviciosActivosCount > 0 || grupoEnCurso) && (
              <button
                type="button"
                onClick={() => detenerGrupoProyecto(proyecto.id)}
                className="bg-elevated border border-red/50 text-red hover:bg-red/15 px-3.5 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer"
              >
                Detener grupo
              </button>
            )}
          </div>
        )}
      </div>

      {/* Telemetría en vivo del arranque de grupo */}
      {grupoEnCurso && estadoGrupo && (
        <div className="bg-surface border border-border border-l-[3px] border-l-yellow px-4 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm">
            <span
              aria-hidden="true"
              className="inline-block w-2 h-2 bg-yellow shadow-[0_0_6px_rgba(245,176,39,0.5)] shrink-0"
            />
            <div className="font-mono text-xs text-txt">
              <span className="text-yellow font-semibold">
                Secuencia de arranque ({estadoGrupo.pasoActual}/{estadoGrupo.totalPasos}):
              </span>{' '}
              esperando disponibilidad de{' '}
              <span className="font-bold text-txt">{estadoGrupo.servicioActualNombre}</span> antes
              de avanzar al siguiente servicio...
            </div>
          </div>
          <button
            type="button"
            onClick={() => detenerGrupoProyecto(proyecto.id)}
            className="text-xs font-mono text-red hover:bg-red/15 border border-red/40 px-2.5 py-1 transition-colors duration-150 cursor-pointer shrink-0"
          >
            Abortar secuencia
          </button>
        </div>
      )}

      {errorProyectos && (
        <div
          role="alert"
          className="bg-surface border border-border border-l-[3px] border-l-red px-4 py-3.5 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3 text-sm text-txt">
            <span aria-hidden="true" className="inline-block w-2 h-2 bg-red shrink-0" />
            <div>
              <span className="font-medium text-red">Secuencia interrumpida: </span>
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
                  Agrega un servicio desde el panel derecho seleccionando su carpeta. El selector se
                  abrirá directamente en <code className="font-mono text-txt">{proyecto.path}</code>.
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
                const editandoEste = editandoServicioId === servicio.id
                const esArrastrado = arrastrandoId === servicio.id
                const esDestino = sobreDestinoId === servicio.id && arrastrandoId !== servicio.id

                return (
                  <article
                    key={servicio.id}
                    draggable={!editandoEste}
                    onDragStart={(e) => {
                      setArrastrandoId(servicio.id)
                      e.dataTransfer.effectAllowed = 'move'
                      e.dataTransfer.setData('text/plain', String(servicio.id))
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      if (sobreDestinoId !== servicio.id) {
                        setSobreDestinoId(servicio.id)
                      }
                    }}
                    onDragLeave={() => {
                      if (sobreDestinoId === servicio.id) {
                        setSobreDestinoId(null)
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      manejarSoltarServicio(servicio.id)
                    }}
                    onDragEnd={() => {
                      setArrastrandoId(null)
                      setSobreDestinoId(null)
                    }}
                    onClick={() => navegar(`/proyectos/${proyecto.id}/servicios/${servicio.id}`)}
                    className={`bg-surface border border-l-[3px] ${
                      esDestino
                        ? 'border-accent border-l-accent bg-elevated/50'
                        : estadoPrincipal === 'listo'
                          ? 'border-border border-l-green hover:border-txt-muted'
                          : estadoPrincipal === 'iniciando'
                            ? 'border-border border-l-yellow hover:border-txt-muted'
                            : estadoPrincipal === 'error'
                              ? 'border-border border-l-red hover:border-txt-muted'
                              : 'border-border border-l-border hover:border-l-accent hover:border-txt-muted'
                    } ${esArrastrado ? 'opacity-50' : ''} p-4 transition-colors duration-150 space-y-3 cursor-pointer`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Mango de arrastre + Dropdown directo de orden */}
                          <div
                            className="inline-flex items-center bg-elevated border border-border hover:border-accent transition-colors duration-150"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span
                              title="Arrastra para reordenar el arranque"
                              className="px-2 py-0.5 text-txt-muted hover:text-txt cursor-grab active:cursor-grabbing select-none font-mono text-xs border-r border-border"
                            >
                              ⠿
                            </span>
                            <label htmlFor={`orden-srv-${servicio.id}`} className="sr-only">
                              Orden de arranque de {servicio.nombre}
                            </label>
                            <select
                              id={`orden-srv-${servicio.id}`}
                              title="Cambiar posición en la secuencia de arranque"
                              value={servicio.ordenArranque}
                              onChange={(e) =>
                                manejarCambioOrdenRapido(servicio.id, Number(e.target.value))
                              }
                              className="bg-elevated text-accent font-mono text-xs font-semibold px-2 py-0.5 focus:outline-none cursor-pointer"
                            >
                              {servicios.map((_, idx) => {
                                const pos = idx + 1
                                return (
                                  <option key={pos} value={pos} className="bg-surface text-txt">
                                    Orden #{pos}
                                  </option>
                                )
                              })}
                            </select>
                          </div>

                          <span className="font-display text-[16px] font-bold text-txt hover:text-accent tracking-tight transition-colors duration-150 truncate">
                            {servicio.nombre}
                          </span>

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

                          <span className="font-mono text-xs bg-elevated border border-border px-2 py-0.5 text-txt-secondary">
                            {servicio.tipoHealthCheck === 'http' ||
                            servicio.tipoHealthCheck === 'tcp'
                              ? `${servicio.tipoHealthCheck.toUpperCase()} → ${servicio.objetivoHealthCheck}`
                              : 'Health check: ninguno'}
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

                      <div
                        className="flex items-center gap-2 shrink-0 flex-wrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {comandoPrincipal && (
                          <>
                            {!estaActivo ? (
                              <button
                                type="button"
                                disabled={operando || grupoEnCurso}
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

                    {editandoEste && (
                      <form
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={(e) => manejarGuardarEdicion(e, servicio.id)}
                        className="bg-elevated border border-border p-3.5 space-y-3 cursor-default"
                      >
                        <div className="text-xs font-medium text-txt">
                          Configurar orden de arranque y verificación de disponibilidad
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-mono text-txt-secondary">
                              Posición de arranque
                            </label>
                            <select
                              value={ordenEdicion}
                              onChange={(e) => setOrdenEdicion(Number(e.target.value))}
                              className="w-full bg-surface border border-border focus:border-accent focus:outline-none px-2.5 py-1.5 text-xs font-mono text-txt cursor-pointer"
                            >
                              {servicios.map((_, idx) => {
                                const pos = idx + 1
                                return (
                                  <option key={pos} value={pos}>
                                    Posición #{pos}
                                  </option>
                                )
                              })}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[11px] font-mono text-txt-secondary">
                              Tipo de health check
                            </label>
                            <select
                              value={tipoHealthEdicion}
                              onChange={(e) =>
                                setTipoHealthEdicion(e.target.value as TipoHealthCheck)
                              }
                              className="w-full bg-surface border border-border focus:border-accent focus:outline-none px-2.5 py-1.5 text-xs font-mono text-txt cursor-pointer"
                            >
                              <option value="none">Ninguno (solo proceso activo)</option>
                              <option value="http">HTTP (URL o puerto)</option>
                              <option value="tcp">TCP (puerto de base de datos/socket)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[11px] font-mono text-txt-secondary">
                              Objetivo (URL o puerto)
                            </label>
                            <input
                              type="text"
                              disabled={tipoHealthEdicion === 'none'}
                              value={objetivoHealthEdicion}
                              onChange={(e) => setObjetivoHealthEdicion(e.target.value)}
                              placeholder={
                                tipoHealthEdicion === 'http'
                                  ? 'http://localhost:5173 o 5173'
                                  : tipoHealthEdicion === 'tcp'
                                    ? '5432 o localhost:5432'
                                    : 'No requerido'
                              }
                              className="w-full bg-surface border border-border focus:border-accent focus:outline-none disabled:opacity-40 px-2.5 py-1.5 text-xs font-mono text-txt placeholder:text-txt-muted"
                              required={tipoHealthEdicion !== 'none'}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditandoServicioId(null)}
                            className="bg-surface border border-border text-txt-secondary hover:text-txt px-3 py-1 text-xs transition-colors duration-150 cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={guardandoEdicion}
                            className="bg-surface border border-accent text-txt hover:bg-accent/15 px-3 py-1 text-xs font-medium transition-colors duration-150 cursor-pointer"
                          >
                            {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
                          </button>
                        </div>
                      </form>
                    )}

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
                            Sin comandos detectados — haz clic para agregar uno manual
                          </span>
                        )}
                      </div>

                      <div
                        className="flex items-center justify-end gap-2 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            editandoEste
                              ? setEditandoServicioId(null)
                              : abrirEdicionServicio(servicio)
                          }
                          className="text-xs text-txt-secondary hover:text-txt px-2 py-1 transition-colors duration-150 cursor-pointer"
                        >
                          {editandoEste ? 'Cerrar ajustes' : 'Orden y health check'}
                        </button>

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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="select-orden-servicio"
                    className="block text-xs font-medium text-txt"
                  >
                    Posición de arranque
                  </label>
                  <select
                    id="select-orden-servicio"
                    value={ordenNuevo}
                    onChange={(e) => setOrdenNuevo(Number(e.target.value))}
                    className="w-full bg-elevated border border-border focus:border-accent focus:outline-none px-2.5 py-2 text-xs font-mono text-txt cursor-pointer"
                  >
                    {Array.from({ length: totalOpcionesNuevoOrden }, (_, idx) => {
                      const pos = idx + 1
                      return (
                        <option key={pos} value={pos}>
                          {pos === totalOpcionesNuevoOrden
                            ? `Posición #${pos} (al final)`
                            : `Posición #${pos} (desplaza actuales)`}
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="select-health-servicio"
                    className="block text-xs font-medium text-txt"
                  >
                    Health check
                  </label>
                  <select
                    id="select-health-servicio"
                    value={tipoHealthNuevo}
                    onChange={(e) => setTipoHealthNuevo(e.target.value as TipoHealthCheck)}
                    className="w-full bg-elevated border border-border focus:border-accent focus:outline-none px-2.5 py-2 text-xs font-mono text-txt cursor-pointer"
                  >
                    <option value="none">Ninguno</option>
                    <option value="http">HTTP (URL/puerto)</option>
                    <option value="tcp">TCP (puerto)</option>
                  </select>
                </div>
              </div>

              {tipoHealthNuevo !== 'none' && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="input-objetivo-health"
                    className="block text-xs font-medium text-txt"
                  >
                    {tipoHealthNuevo === 'http'
                      ? 'URL o puerto HTTP a verificar'
                      : 'Puerto o host:puerto TCP'}
                  </label>
                  <input
                    id="input-objetivo-health"
                    type="text"
                    value={objetivoHealthNuevo}
                    onChange={(e) => setObjetivoHealthNuevo(e.target.value)}
                    placeholder={
                      tipoHealthNuevo === 'http'
                        ? 'Ej. http://localhost:5173 o 5173'
                        : 'Ej. 5432 o localhost:5432'
                    }
                    className="w-full bg-elevated border border-border focus:border-accent focus:outline-none px-3 py-2 text-xs font-mono text-txt placeholder:text-txt-muted"
                    required
                  />
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              {(nombreServicio.trim() || rutaServicio.trim() || objetivoHealthNuevo.trim()) && (
                <button
                  type="button"
                  onClick={() => {
                    setNombreServicio('')
                    setRutaServicio('')
                    setTipoHealthNuevo('none')
                    setObjetivoHealthNuevo('')
                    setOrdenNuevo(totalOpcionesNuevoOrden)
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
