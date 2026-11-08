import { contextBridge } from 'electron'
import type { ApiElectron } from '../compartido/tipos'

const api: ApiElectron = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.api = api
}
