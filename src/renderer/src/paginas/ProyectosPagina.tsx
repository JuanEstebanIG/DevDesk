import React, { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'

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
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [confirmandoEliminarId, setConfirmandoEliminarId] = useState<number | null>(null)

  useEffect(() => {
    cargarProyectos()
  }, [cargarProyectos])

  const manejarSeleccionarCarpeta = async (): Promise<void> => {
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
      await crearProyecto({
        nombre: nombre.trim(),
        path: rutaCarpeta.trim()
      })
      setNombre('')
      setRutaCarpeta('')
      setMostrarFormulario(false)
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
    } catch {
      // El store ya captura y expone errorProyectos
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-lg font-bold tracking-wide text-txt uppercase font-sans">
            Proyectos Locales
          </h1>
          <p className="text-xs text-txt-secondary mt-1">
            Centraliza y administra los entornos de desarrollo de tus proyectos
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            limpiarError()
            setMostrarFormulario((prev) => !prev)
          }}
          className="bg-elevated border border-cyan text-cyan hover:bg-cyan/10 px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer self-start sm:self-auto"
        >
          {mostrarFormulario ? '[ Cancelar ]' : '[ + Nuevo Proyecto ]'}
        </button>
      </div>

      {errorProyectos && (
        <div className="bg-surface border-t-2 border-red p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-red">
            <span className="inline-block w-2 h-2 bg-red shadow-[0_0_6px_rgba(255,51,102,0.5)]" />
            <span>{errorProyectos}</span>
          </div>
          <button
            type="button"
            onClick={limpiarError}
            className="text-xs text-txt-secondary hover:text-txt transition-all duration-200 cursor-pointer"
          >
            [X]
          </button>
        </div>
      )}

      {mostrarFormulario && (
        <form
          onSubmit={manejarCrearProyecto}
          className="bg-surface border-t-2 border-cyan p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-xs uppercase tracking-wider text-cyan font-bold">
              Registrar Nuevo Proyecto
            </h2>
            <span className="text-[11px] text-txt-muted">ORIGEN LOCAL</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs text-txt-secondary uppercase tracking-wider">
                Carpeta raíz del proyecto
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={rutaCarpeta}
                  onChange={(e) => setRutaCarpeta(e.target.value)}
                  placeholder="C:\ruta\al\proyecto"
                  className="flex-1 bg-elevated border border-border focus:border-cyan focus:outline-none px-3 py-2 text-sm font-mono text-txt placeholder:text-txt-muted transition-all duration-200"
                  required
                />
                <button
                  type="button"
                  onClick={manejarSeleccionarCarpeta}
                  className="bg-elevated border border-border hover:border-txt-muted hover:text-txt text-txt-secondary px-3 py-2 text-xs font-mono whitespace-nowrap transition-all duration-200 cursor-pointer"
                >
                  Examinar...
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs text-txt-secondary uppercase tracking-wider">
                Nombre del proyecto
              </label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Mi Plataforma Web"
                className="w-full bg-elevated border border-border focus:border-cyan focus:outline-none px-3 py-2 text-sm font-mono text-txt placeholder:text-txt-muted transition-all duration-200"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setMostrarFormulario(false)
                setNombre('')
                setRutaCarpeta('')
                limpiarError()
              }}
              className="bg-elevated border border-border hover:border-txt-muted hover:text-txt text-txt-secondary px-4 py-2 text-xs font-mono transition-all duration-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || !nombre.trim() || !rutaCarpeta.trim()}
              className="bg-elevated border border-cyan text-cyan hover:bg-cyan/10 disabled:opacity-40 disabled:pointer-events-none px-5 py-2 text-xs font-mono uppercase tracking-wider transition-all duration-200 cursor-pointer"
            >
              {guardando ? 'Guardando...' : 'Guardar Proyecto'}
            </button>
          </div>
        </form>
      )}

      {cargandoProyectos ? (
        <div className="bg-surface border-t-2 border-border p-8 text-center">
          <p className="text-xs text-txt-secondary animate-pulse">
            Cargando proyectos registrados...
          </p>
        </div>
      ) : proyectos.length === 0 ? (
        <div className="bg-surface border-t-2 border-border p-10 text-center space-y-3">
          <p className="text-sm text-txt-secondary">No hay proyectos registrados todavía.</p>
          <p className="text-xs text-txt-muted">
            Haz clic en <span className="text-cyan">[ + Nuevo Proyecto ]</span> para agregar una
            carpeta local.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {proyectos.map((proyecto) => {
            const cantidadServicios = proyecto.servicios?.length ?? 0
            const confirmando = confirmandoEliminarId === proyecto.id

            return (
              <div
                key={proyecto.id}
                className="bg-surface border-t-2 border-border hover:border-cyan p-5 flex flex-col justify-between gap-4 transition-all duration-200"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-block w-2 h-2 bg-cyan shadow-[0_0_6px_rgba(0,229,255,0.5)] shrink-0" />
                      <h3 className="text-base font-bold text-txt truncate font-sans">
                        {proyecto.nombre}
                      </h3>
                    </div>
                    <span className="text-[11px] bg-elevated border border-border px-2 py-0.5 text-txt-secondary shrink-0">
                      {cantidadServicios} {cantidadServicios === 1 ? 'servicio' : 'servicios'}
                    </span>
                  </div>

                  <p
                    title={proyecto.path}
                    className="text-xs text-txt-secondary bg-elevated border border-border px-2.5 py-1.5 truncate"
                  >
                    {proyecto.path}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border text-xs">
                  <span className="text-[11px] text-txt-muted">ID #{proyecto.id}</span>

                  {confirmando ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-red">¿Eliminar?</span>
                      <button
                        type="button"
                        onClick={() => manejarEliminarProyecto(proyecto.id)}
                        className="text-red hover:bg-red/10 border border-transparent hover:border-red/20 px-2 py-1 text-xs transition-all duration-200 cursor-pointer"
                      >
                        Sí
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmandoEliminarId(null)}
                        className="text-txt-secondary hover:text-txt px-2 py-1 text-xs transition-all duration-200 cursor-pointer"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmandoEliminarId(proyecto.id)}
                      className="text-red hover:bg-red/10 border border-transparent hover:border-red/20 px-2.5 py-1 text-xs transition-all duration-200 cursor-pointer"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
