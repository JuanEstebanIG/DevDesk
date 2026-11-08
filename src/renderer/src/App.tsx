import React from 'react'
import { HashRouter, Routes, Route, Link } from 'react-router-dom'
import { ProyectosPagina } from './paginas/ProyectosPagina'
import { useAppStore } from './store/appStore'

export function App(): React.JSX.Element {
  const proyectos = useAppStore((estado) => estado.proyectos)
  const totalProyectos = proyectos.length
  const totalServicios = proyectos.reduce(
    (acumulado, proyecto) => acumulado + (proyecto.servicios?.length ?? 0),
    0
  )

  return (
    <HashRouter>
      <div className="min-h-screen bg-base text-txt font-sans flex flex-col selection:bg-accent/25 selection:text-txt">
        <header className="bg-surface border-b border-border px-5 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="group flex items-center gap-2.5 text-txt transition-colors duration-150 cursor-pointer"
            >
              <span
                aria-hidden="true"
                className="inline-block w-2.5 h-3.5 bg-accent"
              />
              <span className="font-display text-[16px] font-bold tracking-tight text-txt group-hover:text-accent transition-colors duration-150">
                DevDesk
              </span>
            </Link>
            <span className="text-border select-none">/</span>
            <span className="font-mono text-xs text-txt-secondary">~/proyectos</span>
          </div>

          <div className="flex items-center gap-4 text-xs text-txt-secondary font-mono">
            <div className="flex items-center gap-2 bg-elevated border border-border px-2.5 py-1">
              <span
                aria-hidden="true"
                className={`inline-block w-1.5 h-1.5 ${
                  totalProyectos > 0 ? 'bg-green' : 'bg-txt-muted'
                }`}
              />
              <span>
                {totalProyectos === 0
                  ? 'Sin proyectos vinculados'
                  : `${totalProyectos} ${totalProyectos === 1 ? 'proyecto' : 'proyectos'} · ${totalServicios} ${totalServicios === 1 ? 'servicio' : 'servicios'}`}
              </span>
            </div>
          </div>
        </header>

        <main className="max-w-[1400px] w-full mx-auto px-5 py-7 flex-1">
          <Routes>
            <Route path="/" element={<ProyectosPagina />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

export default App
