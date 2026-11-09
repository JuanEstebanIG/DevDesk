# DevDesk — Tablero de Instrumentación y Orquestador Local de Servicios

**DevDesk** es una aplicación de escritorio construida con Electron, React, TypeScript y SQLite (Prisma ORM) que centraliza el inicio, detención, monitoreo y secuencias de arranque de servicios de desarrollo local (frontend, backend, bases de datos y herramientas auxiliares) desde una única interfaz técnica, evitando abrir y administrar múltiples terminales manualmente.

---

## Características Principales

- **Registro de proyectos y servicios locales**: Vincula carpetas raíz de proyectos y registra cada uno de sus servicios seleccionando su directorio correspondiente.
- **Detección automática de scripts (`package.json`)**: Escanea automáticamente el objeto `scripts` de cada servicio y genera comandos listos para ejecutar (`npm run <script>`), permitiendo además registrar comandos personalizados para cualquier stack (`python`, `go`, `npx`, etc.).
- **Ejecución concurrente por comando**: Cada servicio puede mantener múltiples comandos corriendo en paralelo (por ejemplo, `dev` y `test:watch`) con seguimiento independiente de `PID`, estado (`detenido` | `iniciando` | `listo` | `error`) y consola en memoria.
- **Terminación limpia de árboles de procesos en Windows**: Utiliza `taskkill /pid <pid> /t /f` para finalizar el árbol completo de subprocesos al detener un comando o cerrar la aplicación, evitando puertos bloqueados o procesos huérfanos.
- **Orquestación de arranque en grupo y Health Checks (`http` / `tcp`)**:
  - Orden de arranque único y reordenable mediante **Drag & Drop (`⠿`)** o selector directo de posición.
  - Selección granular de qué servicios incluir en el arranque del grupo.
  - Verificación real de disponibilidad (`http` o `tcp` con timeout de `60s`) antes de avanzar al siguiente servicio de la secuencia. Si un servicio falla, detiene la secuencia manteniendo activos los servicios previos.
- **Automatizaciones post-arranque**: Al completarse el arranque del grupo con todos los servicios en estado `listo`, DevDesk puede abrir automáticamente el proyecto en **VS Code** (`code <path>`) y/o lanzar la URL configurada en el navegador predeterminado.

---

## Stack Técnico

- **Runtime y Desktop**: Electron + `electron-vite`
- **Interfaz (Renderer)**: React 18 + TypeScript + React Router (`HashRouter`) + Tailwind CSS v4
- **Estado en cliente**: Zustand
- **Persistencia local**: Prisma ORM + SQLite (`prisma/dev.db`)
- **Arquitectura en proceso principal (`src/main`)**:
  - `ipc/`: Controladores de canales IPC (`proyecto:*`, `servicio:*`, `comando:*`, `dialog:*`).
  - `servicios/`: Lógica de negocio (`gestorProcesos`, `verificadorSalud`, `detectorComandos`, `proyectos`, `servicios`).
  - `repositorios/`: Acceso exclusivo a datos mediante singleton de Prisma Client.

---

## Requisitos y Ejecución en Desarrollo

### Requisitos previos
- **Node.js** 18+ y **npm**
- Sistema operativo Windows (o Linux/macOS)

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno y base de datos SQLite
Asegúrate de contar con un archivo `.env` en la raíz con la ruta de SQLite:
```env
DATABASE_URL="file:./dev.db"
```
Ejecuta las migraciones de Prisma para inicializar o actualizar el esquema local:
```bash
npx prisma migrate dev
```

### 3. Iniciar en modo desarrollo
```bash
npm run dev
```

### 4. Verificación de tipos, linter y compilación de producción
```bash
npm run typecheck
npm run lint
npm run build
```

---

## Roadmap Futuro (Fuera de alcance en v1.0)

Las siguientes capacidades quedaron **explícitamente fuera de alcance en esta versión** por decisión de diseño y enfoque pragmático, y forman parte del roadmap para versiones posteriores:

1. **Integración con Docker / Docker Compose**: Inicio y monitoreo de contenedores junto a procesos nativos.
2. **Integración con Git / GitHub**: Visualización de rama activa, estado del árbol de trabajo y cambios pendientes por servicio.
3. **Perfiles de ejecución múltiples**: Definición de subconjuntos guardados por proyecto (ej. *"Modo Frontend Mock"* vs *"Stack Completo"*).
4. **Persistencia de logs en disco**: Exportación e historial de salidas `stdout`/`stderr` en archivos rotativos (actualmente los logs viven únicamente en memoria durante la sesión activa).
5. **Detección heurística de rol de servicio**: Clasificación automática de servicios en frontend/backend/base de datos sin intervención del usuario.
6. **Suite de pruebas unitarias y de integración**: Cobertura automatizada sobre el orquestador de procesos y simulaciones de health checks.
