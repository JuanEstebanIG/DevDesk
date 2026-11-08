import React from 'react'
import { HashRouter, Routes, Route, Link } from 'react-router-dom'
import { ProyectosPagina } from './paginas/ProyectosPagina'

export function App(): React.JSX.Element {
  return (
    <HashRouter>
      <div className="min-h-screen bg-base text-txt font-mono flex flex-col">
        <header className="bg-surface border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3 text-sm">
            <Link
              to="/"
              className="text-cyan font-bold tracking-wider hover:opacity-80 transition-all duration-200 cursor-pointer"
            >
              DEVDESK
            </Link>
            <span className="text-txt-muted">/</span>
            <span className="text-txt-secondary text-xs">~/proyectos</span>
          </div>
          <div className="text-[11px] text-txt-muted hidden sm:block">
            ENTORNO DE CONTROL LOCAL
          </div>
        </header>

        <main className="max-w-full w-full px-4 py-6 flex-1">
          <Routes>
            <Route path="/" element={<ProyectosPagina />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}

export default App
