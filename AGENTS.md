# AGENT.md — Contexto del proyecto DevDesk

## Qué es DevDesk

DevDesk es una aplicación de escritorio que centraliza el inicio, detención y monitoreo de servicios de desarrollo local (frontend, backend, bases de datos, etc.) desde una sola interfaz, evitando que el usuario tenga que abrir varias terminales manualmente.

El usuario define proyectos y, dentro de cada proyecto, define servicios manualmente (nombre + carpeta). DevDesk detecta automáticamente los comandos disponibles en esa carpeta (leyendo `package.json`) y permite iniciar/detener/reiniciar servicios individualmente o como grupo, respetando un orden de arranque y verificando disponibilidad real antes de considerarlos "listos".

## Qué NO es DevDesk (fuera de alcance en esta versión)

- No detecta automáticamente si un servicio es "frontend" o "backend" — eso lo define el usuario manualmente.
- No tiene soporte para Docker.
- No tiene integración con Git/GitHub.
- No tiene perfiles de ejecución múltiples.
- No persiste logs en disco (solo en memoria mientras la app está abierta).
- No incluye pruebas unitarias/integración en esta fase.

Estas quedan explícitamente para versiones futuras. No implementar nada de esta lista salvo que se indique lo contrario.

## Conceptos de dominio

- **Proyecto**: carpeta raíz que agrupa uno o más Servicios.
- **Servicio**: definido manualmente por el usuario. Tiene: nombre (libre), carpeta (path), orden de arranque dentro de su grupo, tipo de health check (`http` | `tcp` | `none`), objetivo del health check (puerto o URL).
- **Comando**: pertenece a un Servicio. Tiene: etiqueta (nombre visible, ej. "dev", "build", "test", o uno escrito por el usuario), comando (string real a ejecutar), origen (`detectado` desde package.json | `personalizado` agregado por el usuario), esPrincipal (booleano — indica cuál comando se usa cuando se inicia el servicio individualmente o como parte del arranque de un grupo).
- **Grupo**: el conjunto de servicios de un proyecto que se inician juntos, en el orden definido, esperando el health check de cada uno antes de continuar con el siguiente.
- **Ejecución**: instancia en tiempo real de un servicio corriendo. Tiene: PID, estado (`detenido` | `iniciando` | `listo` | `error`), logs en memoria (stdout/stderr).

## Stack técnico

- Electron + React + TypeScript
- Bundler/scaffold: electron-vite (template `react-ts`)
- Estado en el renderer: Zustand
- Persistencia: Prisma ORM + SQLite
- Estilos: Tailwind CSS v4 (theme via `@theme` en `index.css`, sin `tailwind.config.*`)
- Navegación: React Router (HashRouter para compatibilidad con Electron)

## Sistema visual: Cyberpunk Oscuro

Tema visual oscuro minimalista, sin sobrecarga de colores. Inspiración cyberpunk sutil — bordes limpios, acentos de neón, nada de gradients ni sombras pesadas.

### Paleta de colores (tokens CSS en `index.css`)

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-base` | `#0a0a0f` | Fondo de página |
| `--color-surface` | `#111118` | Cards, paneles |
| `--color-elevated` | `#1a1a24` | Inputs, filas de comando |
| `--color-hover` | `#22222e` | Hover states |
| `--color-border` | `#2a2a35` | Bordes sutiles |
| `--color-border-focus` | `#00e5ff` | Focus ring, acento primario |
| `--color-txt` | `#e8e8ec` | Texto principal |
| `--color-txt-secondary` | `#6b6b78` | Texto muted |
| `--color-txt-muted` | `#4a4a55` | Placeholder, textos apagados |
| `--color-cyan` | `#00e5ff` | Acento primario |
| `--color-red` | `#ff3366` | Danger, error |
| `--color-green` | `#00ff88` | Success, stdout |
| `--color-yellow` | `#ffcc00` | Warning |

### Tipografías

- **UI general**: Inter (via `--font-sans`)
- **Terminal/código/breadcrumbs**: JetBrains Mono (via `--font-mono`)
- **Font base global**: JetBrains Mono (aplicada en `body` de `index.css`)

### Convenciones de estilos

- Sin border-radius redondeado — estética mecánica e industrial
- Cards: `bg-surface border-t-2 border-border hover:border-cyan`
- Inputs: `bg-elevated border-border focus:border-cyan text-sm font-mono`
- Botones primarios: `bg-elevated border border-cyan text-cyan hover:bg-cyan/10`
- Botones secundarios: `bg-elevated border border-border hover:border-txt-muted hover:text-txt text-txt-secondary`
- Links de acción: `text-cyan/60 hover:text-cyan hover:bg-cyan/10`
- Danger: `text-red hover:bg-red/10 hover:border-red/20`
- Status dots: colores con `shadow-[0_0_6px_rgba(...,0.5)]` para glow
- Eliminación: ghost style (sin bg sólido, solo texto + hover bg)
- Layout: `max-w-full px-4`, grid responsivo `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Navbar: `bg-surface border-b border-border` fija arriba con "DEVDESK" en cyan mono
- Breadcrumbs estilo terminal: `~/proyectos / servicios / detalle`
- Consola: `bg-[#050505]` con `absolute inset-0` para scroll interno
- Botón "clear" flotante: `absolute top-2 right-2 opacity-50 hover:opacity-100`
- Todos los elementos interactivos: `transition-all duration-200` + `cursor-pointer`

## Arquitectura: capas pragmáticas (no Clean/Hexagonal)

Tres capas dentro del proceso principal (`src/main`):

1. **Controladores** (`src/main/ipc/`): reciben eventos IPC del renderer, validan lo mínimo, delegan a servicios. Sin lógica de negocio aquí.
2. **Servicios** (`src/main/servicios/`): lógica de negocio real. Incluye:
   - `gestorProcesos.servicio.ts`: crea/controla procesos del SO vía `child_process`, captura stdout/stderr, trackea PID, detecta fin/fallo. Las ejecuciones (PID, estado, logs) se trackean por Comando, no por Servicio — un servicio puede tener varios comandos corriendo en paralelo (ej. "dev" y "test:watch" al mismo tiempo).
   - `detectorComandos.servicio.ts`: lee TODO el objeto `scripts` de `package.json` de la carpeta de un servicio y crea un Comando por cada entrada encontrada (origen: `detectado`), no solo sugerencias para dos roles fijos.
   - `proyectos.servicio.ts`, `servicios.servicio.ts`: orquestación de casos de uso (crear proyecto, iniciar grupo, etc.).
3. **Repositorios** (`src/main/repositorios/`): único punto de acceso a datos vía Prisma. Nada fuera de esta capa debe importar el cliente de Prisma directamente.

## Estructura de carpetas (ya inicializada)

```
devdesk/
├─ prisma/
│  └─ schema.prisma
├─ src/
│  ├─ main/
│  │  ├─ index.ts
│  │  ├─ ipc/
│  │  ├─ servicios/
│  │  ├─ repositorios/
│  │  └─ tipos/
│  ├─ preload/
│  │  └─ preload.ts
│  ├─ renderer/
│  │  └─ src/
│  │     ├─ App.tsx          (Layout + routing + nav bar)
│  │     ├─ index.css        (theme cyberpunk + fonts + globals)
│  │     ├─ paginas/
│  │     ├─ componentes/
│  │     ├─ store/
│  │     └─ hooks/
│  └─ compartido/
│     └─ tipos.ts
```

Nota: `main/`, `preload/`, `renderer/` se mantienen en inglés por ser convención estructural de Electron. Todo lo demás (archivos, funciones, variables, comentarios de lógica de negocio) va en español.

## Convención de comunicación IPC

- Canales nombrados `entidad:accion` — ej. `proyecto:crear`, `proyecto:listar`, `servicio:iniciar`, `servicio:detener`, `servicio:log` (evento).
- Canales para comandos: `comando:ejecutar`, `comando:detener`, `comando:reiniciar`, `comando:log` (evento) — para ejecutar cualquier comando de la lista de forma independiente.
- Los canales `servicio:iniciar` / `servicio:detener` / `servicio:reiniciar` se mantienen, pero ahora operan específicamente sobre el Comando marcado como esPrincipal de ese servicio.
- `preload.ts` expone un único objeto `window.api` vía `contextBridge`, con métodos que envuelven `ipcRenderer.invoke` (request/response) o `ipcRenderer.on` (eventos, como logs en tiempo real).
- Sin sistema de contratos tipados genérico por canal. Solo una interfaz simple en `src/compartido/tipos.ts` que describe la forma de `window.api`.
- La interfaz de React (renderer) NUNCA ejecuta comandos directamente ni accede al sistema de archivos — todo pasa por IPC hacia el proceso principal.

## Restricciones técnicas importantes

- **Terminación de procesos en Windows**: un `process.kill()` estándar no mata los procesos hijos en Windows (a diferencia de Linux/macOS con grupos de procesos). Usar `taskkill /pid <pid> /t /f` para matar el árbol completo cuando el usuario detiene un servicio.
- **Detección de comandos**: se limita a leer `package.json` → campo `scripts` y ofrecerlos como opciones. No hay heurística de "esto es un backend/frontend" — eso lo decide el usuario.
- **Health checks**: `http` = polling a una URL/puerto esperando respuesta; `tcp` = intento de conexión al puerto (para casos como bases de datos que no exponen HTTP). No hay verificación de protocolo más profunda que eso en esta versión.
- **Logs**: se mantienen solo en memoria por ejecución (mostrados en la UI en tiempo real vía el canal `servicio:log`). Se pierden al cerrar la app o detener el servicio. No implementar persistencia de logs.

## Convenciones de estilo de código

- Componentes React: funcionales con hooks, sin componentes de clase. Archivos en PascalCase (ej. `TarjetaServicio.tsx`).
- Clases con estado/comportamiento (ej. `GestorDeProcesos`): PascalCase.
- Funciones y variables: camelCase.
- Nombres de funciones, variables, carpetas (fuera de `main/preload/renderer`) y comentarios: en español.
- `async/await` en vez de `.then()` encadenado.
- Tipado explícito en funciones públicas de servicios y repositorios. Evitar `any`.
- ESLint + Prettier con configuración básica (a definir al iniciar el código).

## Testing y logging (decisiones explícitas)

- **Sin pruebas unitarias/integración** en esta fase del proyecto. No generar archivos de test salvo que se pida explícitamente.
- **Sin persistencia de logs en disco** en esta fase. Los logs viven solo en memoria durante la ejecución de la app.

## Cómo trabajar en este proyecto

- Antes de implementar una feature nueva, revisar `TODO.md` para ver en qué fase está el proyecto y qué tareas están pendientes/completadas.
- Respetar la separación de capas: un controlador IPC nunca debe hablar directo con Prisma, y un servicio nunca debe manejar el canal IPC directamente.
- No agregar librerías nuevas sin que se pida explícitamente — el stack ya está definido (Electron, React, TypeScript, Zustand, Prisma, SQLite).
- No implementar nada de la sección "Qué NO es DevDesk" sin instrucción explícita.
