export interface ApiElectron {
  // Se definirán los métodos IPC a partir de la Fase 1
}

declare global {
  interface Window {
    api: ApiElectron
  }
}
