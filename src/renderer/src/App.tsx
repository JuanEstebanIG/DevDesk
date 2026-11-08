import React from 'react'
import { HashRouter } from 'react-router-dom'

export function App(): React.JSX.Element {
  return (
    <HashRouter>
      <div className="min-h-screen bg-base text-txt font-mono">
        <header className="bg-surface border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <span className="text-cyan font-bold tracking-wider">DEVDESK</span>
            <span className="text-txt-muted text-xs">~/proyectos</span>
          </div>
        </header>
        <main className="max-w-full px-4 py-6">
          <p className="text-txt-secondary text-sm">Sistema inicializado (Fase 0).</p>
        </main>
      </div>
    </HashRouter>
  )
}

export default App
