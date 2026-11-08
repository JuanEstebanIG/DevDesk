import React, { useEffect } from 'react'
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { ProyectosPagina } from './paginas/ProyectosPagina'
import { ProyectoDetallePagina } from './paginas/ProyectoDetallePagina'
import { ServicioDetallePagina } from './paginas/ServicioDetallePagina'
import { useAppStore } from './store/appStore'

function BarraNavegacion(): React.JSX.Element {
  const ubicacion = useLocation()
  const { proyectos, estadosComandos } = useAppStore()

  const totalProyectos = proyectos.length
  const totalServicios = proyectos.reduce(
    (acumulado, proyecto) => acumulado + (proyecto.servicios?.length ?? 0),
    0
  )
  const totalProcesosActivos = Object.values(estadosComandos).filter(
    (est) => est.estado === 'listo' || est.estado === 'iniciando'
  ).length

  const coincidenciaProyecto = ubicacion.pathname.match(/^\/proyectos\/(\d+)/)
  const coincidenciaServicio = ubicacion.pathname.match(/^\/proyectos\/(\d+)\/servicios\/(\d+)/)

  const proyectoActual = coincidenciaProyecto
    ? proyectos.find((p) => p.id === Number(coincidenciaProyecto[1]))
    : undefined

  const servicioActual =
    proyectoActual && coincidenciaServicio
      ? proyectoActual.servicios?.find((s) => s.id === Number(coincidenciaServicio[2]))
      : undefined

  return (
    <header className="bg-surface border-b border-border px-5 py-3 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-2.5 min-w-0">
        <Link
          to="/"
          className="group flex items-center gap-2.5 text-txt transition-colors duration-150 cursor-pointer shrink-0"
        >
          <span aria-hidden="true" className="inline-block w-2.5 h-3.5 bg-accent" />
          <span className="font-display text-[16px] font-bold tracking-tight text-txt group-hover:text-accent transition-colors duration-150">
            DevDesk
          </span>
        </Link>

        <span className="text-border select-none">/</span>

        <nav aria-label="Ruta de navegación" className="flex items-center gap-2 font-mono text-xs min-w-0 truncate">
          <Link
            to="/"
            className="text-txt-secondary hover:text-txt transition-colors duration-150 cursor-pointer shrink-0"
          >
            ~/proyectos
          </Link>

          {proyectoActual && (
            <>
              <span className="text-border select-none">/</span>
              <Link
                to={`/proyectos/${proyectoActual.id}`}
                className={`truncate transition-colors duration-150 cursor-pointer ${
                  servicioActual
                    ? 'text-txt-secondary hover:text-txt'
                    : 'text-txt font-medium'
                }`}
              >
                {proyectoActual.nombre}
              </Link>
            </>
          )}

          {servicioActual && (
            <>
              <span className="text-border select-none">/</span>
              <span className="text-txt font-medium truncate">{servicioActual.nombre}</span>
            </>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-3 text-xs text-txt-secondary font-mono shrink-0">
        <div className="flex items-center gap-2 bg-elevated border border-border px-2.5 py-1">
          <span
            aria-hidden="true"
            className={`inline-block w-1.5 h-1.5 ${
              totalProcesosActivos > 0
                ? 'bg-green shadow-[0_0_6px_rgba(42,216,130,0.5)]'
                : totalProyectos > 0
                  ? 'bg-accent'
                  : 'bg-txt-muted'
            }`}
          />
          <span>
            {totalProyectos === 0
              ? 'Sin proyectos vinculados'
              : `${totalProyectos} ${totalProyectos === 1 ? 'proyecto' : 'proyectos'} · ${totalServicios} ${totalServicios === 1 ? 'servicio' : 'servicios'}${
                  totalProcesosActivos > 0
                    ? ` · ${totalProcesosActivos} ${totalProcesosActivos === 1 ? 'activo' : 'activos'}`
                    : ''
                }`}
          </span>
        </div>
      </div>
    </header>
  )
}

export function App(): React.JSX.Element {
  const {
    sincronizarEstadosComandos,
    registrarEntradaLog,
    actualizarEstadoComando,
    actualizarEstadoGrupo
  } = useAppStore()

  useEffect(() => {
    sincronizarEstadosComandos()
    const desuscribirLog = window.api.comandos.onLog((entrada) => {
      registrarEntradaLog(entrada)
    })
    const desuscribirEstado = window.api.comandos.onEstado((estado) => {
      actualizarEstadoComando(estado)
    })
    const desuscribirGrupo = window.api.proyectos.onEstadoGrupo((estadoGrupo) => {
      actualizarEstadoGrupo(estadoGrupo)
    })

    return () => {
      desuscribirLog()
      desuscribirEstado()
      desuscribirGrupo()
    }
  }, [
    sincronizarEstadosComandos,
    registrarEntradaLog,
    actualizarEstadoComando,
    actualizarEstadoGrupo
  ])

  return (
    <HashRouter>
      <div className="min-h-screen bg-base text-txt font-sans flex flex-col selection:bg-accent/25 selection:text-txt">
        <BarraNavegacion />

        <main className="max-w-[1400px] w-full mx-auto px-5 py-7 flex-1">
          <Routes>
            <Route path="/" element={<ProyectosPagina />} />
            <Route path="/proyectos/:proyectoId" element={<ProyectoDetallePagina />} />
            <Route
              path="/proyectos/:proyectoId/servicios/:servicioId"
              element={<ServicioDetallePagina />}
            />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

export default App
