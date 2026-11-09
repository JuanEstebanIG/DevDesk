import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../store/appStore'
import type {
  ComandoDetectadoPrevioDTO,
  EstadoEjecucion,
  ServicioDTO,
  TipoHealthCheck
} from '../../../compartido/tipos'

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

const OPCION_COMANDO_MANUAL = '__manual__'

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
    actualizarProyecto,
    abrirVsCode,
    abrirUrlExterna,
    limpiarError
  } = useAppStore()

  // Estado para formulario de creación de servicio
  const [nombreServicio, setNombreServicio] = useState('')
  const [rutaServicio, setRutaServicio] = useState('')
  const [comandosDetectadosPrevios, setComandosDetectadosPrevios] = useState<
    ComandoDetectadoPrevioDTO[]
  >([])
  const [seleccionComandoNuevo, setSeleccionComandoNuevo] = useState<string>('')
  const [etiquetaManualNueva, setEtiquetaManualNueva] = useState('dev')
  const [comandoManualNuevo, setComandoManualNuevo] = useState('')
  const [tipoHealthNuevo, setTipoHealthNuevo] = useState<TipoHealthCheck>('none')
  const [objetivoHealthNuevo, setObjetivoHealthNuevo] = useState('')
  const [ordenNuevo, setOrdenNuevo] = useState<number>(1)
  const [guardando, setGuardando] = useState(false)

  // Selección granular de servicios para el arranque de grupo
  const [serviciosSeleccionadosIds, setServiciosSeleccionadosIds] = useState<number[]>([])

  const [confirmandoEliminarId, setConfirmandoEliminarId] = useState<number | null>(null)
  const [operandoServicioId, setOperandoServicioId] = useState<number | null>(null)

  // Estado para edición completa de un servicio existente
  const [editandoServicioId, setEditandoServicioId] = useState<number | null>(null)
  const [nombreEdicion, setNombreEdicion] = useState('')
  const [rutaEdicion, setRutaEdicion] = useState('')
  const [ordenEdicion, setOrdenEdicion] = useState<number>(1)
  const [tipoHealthEdicion, setTipoHealthEdicion] = useState<TipoHealthCheck>('none')
  const [objetivoHealthEdicion, setObjetivoHealthEdicion] = useState<string>('')
  const [seleccionComandoEdicion, setSeleccionComandoEdicion] = useState<string>('')
  const [etiquetaManualEdicion, setEtiquetaManualEdicion] = useState('custom')
  const [comandoManualEdicion, setComandoManualEdicion] = useState('')
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)

  // Drag & Drop
  const [arrastrandoId, setArrastrandoId] = useState<number | null>(null)
  const [sobreDestinoId, setSobreDestinoId] = useState<number | null>(null)

  // Automatizaciones post-arranque del proyecto
  const [urlAutoInput, setUrlAutoInput] = useState('')
  const [guardandoAuto, setGuardandoAuto] = useState(false)

  useEffect(() => {
    cargarProyectos()
  }, [cargarProyectos])

  const proyecto = proyectos.find((p) => p.id === idNumerico)
  const servicios = proyecto?.servicios ?? []
  const totalOpcionesNuevoOrden = servicios.length + 1

  useEffect(() => {
    if (proyecto) {
      setUrlAutoInput(proyecto.urlAperturaAuto ?? '')
    }
  }, [proyecto?.id, proyecto?.urlAperturaAuto])

  useEffect(() => {
    setOrdenNuevo(servicios.length + 1)
  }, [servicios.length])

  // Sincronizar selección granular al cambiar los servicios del proyecto
  useEffect(() => {
    const idsActuales = servicios.map((s) => s.id)
    setServiciosSeleccionadosIds((prev) => {
      if (prev.length === 0 && idsActuales.length > 0) {
        return idsActuales
      }
      const conservados = prev.filter((id) => idsActuales.includes(id))
      const nuevos = idsActuales.filter((id) => !prev.includes(id))
      return [...conservados, ...nuevos]
    })
  }, [proyecto?.id, servicios.length])

  // Detectar comandos de package.json en vivo al cambiar rutaServicio
  useEffect(() => {
    let cancelado = false
    const rutaLimpia = rutaServicio.trim()

    if (!rutaLimpia) {
      setComandosDetectadosPrevios([])
      setSeleccionComandoNuevo('')
      return
    }

    window.api.servicios
      .detectarComandosEnCarpeta(rutaLimpia)
      .then((detectados) => {
        if (cancelado) return
        setComandosDetectadosPrevios(detectados)
        if (detectados.length > 0) {
          const sugerido =
            detectados.find((d) => d.esPrincipalSugerido) ?? detectados[0]
          setSeleccionComandoNuevo(sugerido.etiqueta)
        } else {
          setSeleccionComandoNuevo(OPCION_COMANDO_MANUAL)
        }
      })
      .catch(() => {
        if (!cancelado) {
          setComandosDetectadosPrevios([])
          setSeleccionComandoNuevo(OPCION_COMANDO_MANUAL)
        }
      })

    return () => {
      cancelado = true
    }
  }, [rutaServicio])

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

  const manejarSeleccionarCarpetaEdicion = async (): Promise<void> => {
    if (!proyecto) return
    const carpetaSeleccionada = await window.api.dialogos.abrirCarpeta(
      rutaEdicion.trim() || proyecto.path
    )
    if (carpetaSeleccionada) {
      setRutaEdicion(carpetaSeleccionada)
    }
  }

  const manejarCrearServicio = async (evento: React.FormEvent): Promise<void> => {
    evento.preventDefault()
    if (!proyecto || !nombreServicio.trim() || !rutaServicio.trim()) return

    const usaManual = seleccionComandoNuevo === OPCION_COMANDO_MANUAL

    setGuardando(true)
    try {
      const creado = await crearServicio({
        proyectoId: proyecto.id,
        nombre: nombreServicio.trim(),
        path: rutaServicio.trim(),
        tipoHealthCheck: tipoHealthNuevo,
        objetivoHealthCheck: tipoHealthNuevo === 'none' ? null : objetivoHealthNuevo.trim(),
        ordenArranque: ordenNuevo,
        etiquetaPrincipalSeleccionada:
          !usaManual && seleccionComandoNuevo ? seleccionComandoNuevo : null,
        comandoManualPrincipal:
          usaManual && comandoManualNuevo.trim()
            ? {
                etiqueta: etiquetaManualNueva.trim() || 'principal',
                comando: comandoManualNuevo.trim()
              }
            : null
      })
      setNombreServicio('')
      setRutaServicio('')
      setComandosDetectadosPrevios([])
      setSeleccionComandoNuevo('')
      setEtiquetaManualNueva('dev')
      setComandoManualNuevo('')
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
    setNombreEdicion(servicio.nombre)
    setRutaEdicion(servicio.path)
    setOrdenEdicion(servicio.ordenArranque)
    setTipoHealthEdicion(
      servicio.tipoHealthCheck === 'http' || servicio.tipoHealthCheck === 'tcp'
        ? servicio.tipoHealthCheck
        : 'none'
    )
    setObjetivoHealthEdicion(servicio.objetivoHealthCheck ?? '')

    const comandosSrv = servicio.comandos ?? []
    const cmdPrincipal = comandosSrv.find((c) => c.esPrincipal) ?? comandosSrv[0]
    if (cmdPrincipal) {
      setSeleccionComandoEdicion(String(cmdPrincipal.id))
    } else {
      setSeleccionComandoEdicion(OPCION_COMANDO_MANUAL)
    }
    setEtiquetaManualEdicion('custom')
    setComandoManualEdicion('')
  }

  const manejarGuardarEdicion = async (
    evento: React.FormEvent,
    servicioId: number
  ): Promise<void> => {
    evento.preventDefault()
    if (!proyecto) return

    const usaManual = seleccionComandoEdicion === OPCION_COMANDO_MANUAL

    setGuardandoEdicion(true)
    try {
      await actualizarServicio(proyecto.id, servicioId, {
        nombre: nombreEdicion.trim(),
        path: rutaEdicion.trim(),
        ordenArranque: ordenEdicion,
        tipoHealthCheck: tipoHealthEdicion,
        objetivoHealthCheck:
          tipoHealthEdicion === 'none' ? null : objetivoHealthEdicion.trim(),
        comandoPrincipalId:
          !usaManual && seleccionComandoEdicion ? Number(seleccionComandoEdicion) : undefined,
        comandoManualPrincipal:
          usaManual && comandoManualEdicion.trim()
            ? {
                etiqueta: etiquetaManualEdicion.trim() || 'principal',
                comando: comandoManualEdicion.trim()
              }
            : null
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

  const alternarSeleccionServicio = (servicioId: number): void => {
    setServiciosSeleccionadosIds((prev) =>
      prev.includes(servicioId)
        ? prev.filter((id) => id !== servicioId)
        : [...prev, servicioId]
    )
  }

  const alternarSeleccionTodos = (): void => {
    if (serviciosSeleccionadosIds.length === servicios.length) {
      setServiciosSeleccionadosIds([])
    } else {
      setServiciosSeleccionadosIds(servicios.map((s) => s.id))
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

  const todosSeleccionados =
    servicios.length > 0 && serviciosSeleccionadosIds.length === servicios.length

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
            Haz clic en cualquier servicio para abrir sus comandos y consola, o arrastra desde{' '}
            <span className="font-mono text-txt">⠿</span> para reordenar el arranque.
          </p>
        </div>

        {servicios.length > 0 && (
          <div className="bg-surface border border-border p-3 flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
            <button
              type="button"
              onClick={alternarSeleccionTodos}
              className="bg-elevated border border-border hover:border-txt-secondary text-txt-secondary hover:text-txt px-2.5 py-1.5 text-xs font-mono transition-colors duration-150 cursor-pointer"
            >
              {todosSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'} (
              {serviciosSeleccionadosIds.length}/{servicios.length})
            </button>

            <div className="font-mono text-xs px-1">
              <span className="text-txt-secondary">Listos: </span>
              <span className="text-txt font-medium">
                {serviciosListosCount}/{servicios.length}
              </span>
            </div>

            <button
              type="button"
              disabled={grupoEnCurso || serviciosSeleccionadosIds.length === 0}
              onClick={() => iniciarGrupoProyecto(proyecto.id, serviciosSeleccionadosIds)}
              className="bg-elevated border border-accent text-txt hover:bg-accent/15 disabled:opacity-40 px-3.5 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer"
            >
              {grupoEnCurso
                ? 'Iniciando secuencia...'
                : serviciosSeleccionadosIds.length === servicios.length
                  ? 'Iniciar grupo en orden'
                  : `Iniciar seleccionados (${serviciosSeleccionadosIds.length})`}
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
              <span className="font-medium text-red">Atención: </span>
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
                const infoEjecucionPrincipal = comandoPrincipal
                  ? estadosComandos[comandoPrincipal.id]
                  : undefined
                const estadoPrincipal: EstadoEjecucion =
                  infoEjecucionPrincipal?.estado ?? 'detenido'
                const pidPrincipal = infoEjecucionPrincipal?.pid ?? null
                const errorUltimoServicio =
                  infoEjecucionPrincipal?.ultimoError ??
                  comandos
                    .map((c) => estadosComandos[c.id]?.ultimoError)
                    .find((msg) => Boolean(msg)) ??
                  null

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
                const seleccionadoParaGrupo = serviciosSeleccionadosIds.includes(servicio.id)

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
                        ? 'border-accent border-l-accent bg-elevated/60 border-t-2 border-t-accent'
                        : estadoPrincipal === 'listo'
                          ? 'border-border border-l-green hover:border-txt-muted'
                          : estadoPrincipal === 'iniciando'
                            ? 'border-border border-l-yellow hover:border-txt-muted'
                            : estadoPrincipal === 'error'
                              ? 'border-border border-l-red hover:border-txt-muted'
                              : 'border-border border-l-border hover:border-l-accent hover:border-txt-muted'
                    } ${esArrastrado ? 'opacity-45' : ''} p-4 transition-colors duration-150 space-y-3 cursor-pointer`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Checkbox selección granular de grupo */}
                          <label
                            title="Incluir este servicio al iniciar el grupo"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center px-1.5 py-1 bg-elevated border border-border hover:border-accent cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={seleccionadoParaGrupo}
                              onChange={() => alternarSeleccionServicio(servicio.id)}
                              className="accent-accent cursor-pointer"
                            />
                          </label>

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

                    {/* Alerta de error visible en la tarjeta del servicio */}
                    {estadoPrincipal === 'error' && errorUltimoServicio && (
                      <div className="bg-elevated border border-red/40 border-l-2 border-l-red px-3 py-2 text-xs font-mono text-red flex items-center justify-between gap-3">
                        <span className="truncate" title={errorUltimoServicio}>
                          Fallo al iniciar: {errorUltimoServicio}
                        </span>
                        <span className="text-txt-secondary shrink-0 underline">
                          Ver consola →
                        </span>
                      </div>
                    )}

                    {/* Formulario de edición completa del servicio */}
                    {editandoEste && (
                      <form
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={(e) => manejarGuardarEdicion(e, servicio.id)}
                        className="bg-elevated border border-border p-4 space-y-3.5 cursor-default"
                      >
                        <div className="flex items-center justify-between border-b border-border pb-2">
                          <span className="text-xs font-bold text-txt font-display">
                            Editar configuración de {servicio.nombre}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-mono text-txt-secondary">
                              Nombre del servicio
                            </label>
                            <input
                              type="text"
                              value={nombreEdicion}
                              onChange={(e) => setNombreEdicion(e.target.value)}
                              className="w-full bg-surface border border-border focus:border-accent focus:outline-none px-2.5 py-1.5 text-xs text-txt"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[11px] font-mono text-txt-secondary">
                              Carpeta del servicio
                            </label>
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                value={rutaEdicion}
                                onChange={(e) => setRutaEdicion(e.target.value)}
                                className="flex-1 min-w-0 bg-surface border border-border focus:border-accent focus:outline-none px-2.5 py-1.5 text-xs font-mono text-txt"
                                required
                              />
                              <button
                                type="button"
                                onClick={manejarSeleccionarCarpetaEdicion}
                                className="bg-surface border border-border hover:border-txt-secondary text-txt-secondary hover:text-txt px-2.5 py-1.5 text-xs transition-colors duration-150 cursor-pointer shrink-0"
                              >
                                Elegir...
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[11px] font-mono text-txt-secondary">
                              Comando principal al iniciar
                            </label>
                            <select
                              value={seleccionComandoEdicion}
                              onChange={(e) => setSeleccionComandoEdicion(e.target.value)}
                              className="w-full bg-surface border border-border focus:border-accent focus:outline-none px-2.5 py-1.5 text-xs font-mono text-txt cursor-pointer"
                            >
                              {comandos.map((cmd) => (
                                <option key={cmd.id} value={String(cmd.id)}>
                                  {cmd.etiqueta} ({cmd.comando})
                                </option>
                              ))}
                              <option value={OPCION_COMANDO_MANUAL}>
                                + Escribir comando manual...
                              </option>
                            </select>
                          </div>

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
                        </div>

                        {seleccionComandoEdicion === OPCION_COMANDO_MANUAL && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface border border-border p-3">
                            <div className="space-y-1">
                              <label className="block text-[11px] font-mono text-txt-secondary">
                                Etiqueta del comando
                              </label>
                              <input
                                type="text"
                                value={etiquetaManualEdicion}
                                onChange={(e) => setEtiquetaManualEdicion(e.target.value)}
                                placeholder="Ej. start:local"
                                className="w-full bg-elevated border border-border focus:border-accent focus:outline-none px-2.5 py-1.5 text-xs font-mono text-txt"
                                required
                              />
                            </div>
                            <div className="sm:col-span-2 space-y-1">
                              <label className="block text-[11px] font-mono text-txt-secondary">
                                Comando manual a ejecutar
                              </label>
                              <input
                                type="text"
                                value={comandoManualEdicion}
                                onChange={(e) => setComandoManualEdicion(e.target.value)}
                                placeholder="Ej. npm run dev -- --port 4000"
                                className="w-full bg-elevated border border-border focus:border-accent focus:outline-none px-2.5 py-1.5 text-xs font-mono text-txt"
                                required
                              />
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditandoServicioId(null)}
                            className="bg-surface border border-border text-txt-secondary hover:text-txt px-3 py-1.5 text-xs transition-colors duration-150 cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={guardandoEdicion}
                            className="bg-surface border border-accent text-txt hover:bg-accent/15 px-3.5 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer"
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
                            Sin comandos detectados — haz clic para configurar uno
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
                          {editandoEste ? 'Cerrar edición' : 'Editar servicio'}
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

        {/* Panel acoplado: Registrar nuevo servicio + Automatizaciones */}
        <aside className="lg:col-span-4 lg:sticky lg:top-16 space-y-5">
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

              {/* Selector de comando principal (scripts detectados o manual) */}
              {rutaServicio.trim() && (
                <div className="space-y-3 bg-elevated/60 border border-border p-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="select-script-detectado"
                      className="block text-xs font-medium text-txt"
                    >
                      Comando principal ({comandosDetectadosPrevios.length} detectados en
                      package.json)
                    </label>
                    <select
                      id="select-script-detectado"
                      value={seleccionComandoNuevo}
                      onChange={(e) => setSeleccionComandoNuevo(e.target.value)}
                      className="w-full bg-surface border border-border focus:border-accent focus:outline-none px-2.5 py-2 text-xs font-mono text-txt cursor-pointer"
                    >
                      {comandosDetectadosPrevios.map((cmd) => (
                        <option key={cmd.etiqueta} value={cmd.etiqueta}>
                          {cmd.etiqueta} → {cmd.comando}
                        </option>
                      ))}
                      <option value={OPCION_COMANDO_MANUAL}>
                        Escribir comando manual...
                      </option>
                    </select>
                  </div>

                  {seleccionComandoNuevo === OPCION_COMANDO_MANUAL && (
                    <div className="space-y-2.5 pt-1 border-t border-border">
                      <div className="space-y-1">
                        <label
                          htmlFor="input-etiqueta-manual-nuevo"
                          className="block text-[11px] font-mono text-txt-secondary"
                        >
                          Etiqueta del comando
                        </label>
                        <input
                          id="input-etiqueta-manual-nuevo"
                          type="text"
                          value={etiquetaManualNueva}
                          onChange={(e) => setEtiquetaManualNueva(e.target.value)}
                          placeholder="Ej. dev o start"
                          className="w-full bg-surface border border-border focus:border-accent focus:outline-none px-2.5 py-1.5 text-xs font-mono text-txt"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label
                          htmlFor="input-cmd-manual-nuevo"
                          className="block text-[11px] font-mono text-txt-secondary"
                        >
                          Comando manual a ejecutar
                        </label>
                        <input
                          id="input-cmd-manual-nuevo"
                          type="text"
                          value={comandoManualNuevo}
                          onChange={(e) => setComandoManualNuevo(e.target.value)}
                          placeholder="Ej. npm run dev o python app.py"
                          className="w-full bg-surface border border-border focus:border-accent focus:outline-none px-2.5 py-1.5 text-xs font-mono text-txt"
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                    setComandosDetectadosPrevios([])
                    setSeleccionComandoNuevo('')
                    setComandoManualNuevo('')
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
                {guardando ? 'Guardando servicio...' : 'Guardar servicio'}
              </button>
            </div>
          </form>

          {/* Configuración de apertura automática al finalizar el arranque del grupo */}
          <div className="bg-surface border border-border p-5 space-y-4">
            <div className="border-b border-border pb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-sm font-bold text-txt tracking-tight">
                  Al completar el arranque del grupo
                </h2>
                <p className="text-xs text-txt-secondary">
                  Se ejecuta cuando todos los servicios seleccionados pasan a estado listo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => abrirVsCode(proyecto.path)}
                className="bg-elevated border border-border hover:border-accent text-txt px-2.5 py-1 text-[11px] font-mono transition-colors duration-150 cursor-pointer shrink-0"
              >
                Abrir VS Code
              </button>
            </div>

            <div className="space-y-3">
              <label className="flex items-center justify-between gap-3 text-xs text-txt cursor-pointer select-none">
                <span>Abrir proyecto en VS Code (<code className="font-mono">code .</code>)</span>
                <input
                  type="checkbox"
                  checked={Boolean(proyecto.abrirVsCodeAlIniciar)}
                  onChange={(e) =>
                    actualizarProyecto(proyecto.id, {
                      abrirVsCodeAlIniciar: e.target.checked
                    })
                  }
                  className="accent-accent cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-3 text-xs text-txt cursor-pointer select-none">
                <span>Abrir navegador automáticamente</span>
                <input
                  type="checkbox"
                  checked={Boolean(proyecto.abrirNavegadorAlIniciar)}
                  onChange={(e) =>
                    actualizarProyecto(proyecto.id, {
                      abrirNavegadorAlIniciar: e.target.checked
                    })
                  }
                  className="accent-accent cursor-pointer"
                />
              </label>

              {proyecto.abrirNavegadorAlIniciar && (
                <div className="space-y-2 pt-1 border-t border-border">
                  <label
                    htmlFor="input-url-apertura-auto"
                    className="block text-[11px] font-mono text-txt-secondary"
                  >
                    URL a abrir (opcional; si se deja vacío usa el primer health check HTTP)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="input-url-apertura-auto"
                      type="text"
                      value={urlAutoInput}
                      onChange={(e) => setUrlAutoInput(e.target.value)}
                      placeholder="Ej. http://localhost:5173"
                      className="flex-1 min-w-0 bg-elevated border border-border focus:border-accent focus:outline-none px-2.5 py-1.5 text-xs font-mono text-txt placeholder:text-txt-muted"
                    />
                    <button
                      type="button"
                      disabled={guardandoAuto}
                      onClick={async () => {
                        setGuardandoAuto(true)
                        try {
                          await actualizarProyecto(proyecto.id, {
                            urlAperturaAuto: urlAutoInput.trim() || null
                          })
                        } finally {
                          setGuardandoAuto(false)
                        }
                      }}
                      className="bg-elevated border border-accent text-txt hover:bg-accent/15 px-3 py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer shrink-0"
                    >
                      {guardandoAuto ? '...' : 'Guardar URL'}
                    </button>
                  </div>
                  {proyecto.urlAperturaAuto && (
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          proyecto.urlAperturaAuto && abrirUrlExterna(proyecto.urlAperturaAuto)
                        }
                        className="text-[11px] font-mono text-accent hover:underline cursor-pointer"
                      >
                        Probar URL en navegador ({proyecto.urlAperturaAuto}) →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
