# TODO.md — Plan de desarrollo DevDesk (~14 días)

Cada fase depende de que la anterior esté funcional. No saltar de fase sin completar los checks de la anterior. Ver `AGENTS.md` para contexto de arquitectura y convenciones antes de implementar cualquier tarea.

## Fase 0 — Inicialización (completada)

- [x] Scaffold del proyecto con electron-vite (template react-ts)
- [x] Instalación de Zustand, Prisma, @prisma/client
- [x] Inicialización de Prisma con SQLite
- [x] Estructura de carpetas base (`ipc/`, `servicios/`, `repositorios/`, `tipos/`, `paginas/`, `componentes/`, `store/`, `hooks/`, `compartido/`)

## Fase 1 — Modelo de datos y CRUD de Proyecto (días 1-3) (completada)

- [x] Definir `schema.prisma`: modelos `Proyecto`, `Servicio` y `Comando`. Servicio tiene: nombre, path, tipoHealthCheck, objetivoHealthCheck, ordenArranque, proyectoId. Comando tiene: servicioId, etiqueta, comando, origen, esPrincipal
- [x] Ejecutar migración inicial de Prisma (`npx prisma migrate dev`)
- [x] Repositorio `proyectos.repositorio.ts`: crear, listar, obtener por id, eliminar
- [x] Servicio `proyectos.servicio.ts`: casos de uso sobre proyectos (validaciones básicas, ej. que el path exista)
- [x] Controlador IPC `proyectos.controlador.ts`: canales `proyecto:crear`, `proyecto:listar`, `proyecto:eliminar`
- [x] Controlador IPC `dialogos.controlador.ts`: canal `dialog:abrirCarpeta` para selector de carpetas nativo
- [x] `preload.ts`: exponer los métodos correspondientes en `window.api`
- [x] Renderer: página `ProyectosPagina.tsx` con listado y formulario para agregar un proyecto (selector de carpeta nativo de Electron vía `dialog.showOpenDialog`)
- [x] Store de Zustand (`appStore.ts`) con estado de proyectos y acciones para cargarlos/crearlos

**Check de fin de fase**: el usuario puede agregar un proyecto seleccionando una carpeta real, verlo en la lista, y eliminarlo. Los datos persisten entre reinicios de la app.

## Fase 2 — Gestión de un solo servicio (días 4-6) (completada)

- [x] Repositorio `servicios.repositorio.ts`: crear, listar por proyecto, actualizar, eliminar
- [x] Servicio `detectorComandos.servicio.ts`: dado un path, leer TODO el objeto `scripts` de `package.json` (si existe) y crear un Comando por cada entrada encontrada (origen: `detectado`), no solo ofrecer dos sugerencias fijas
- [x] UI para crear un servicio dentro de un proyecto: nombre libre + selector de carpeta. Al guardar, los comandos detectados se crean automáticamente; después, el usuario marca cuál es el principal (esPrincipal) y puede agregar comandos personalizados
- [x] Servicio `gestorProcesos.servicio.ts`:
  - [x] Iniciar un proceso con `child_process.spawn` (usar `shell: true` en Windows) — recibe id de Comando, no de Servicio
  - [x] Capturar `stdout`/`stderr` y emitirlos por IPC (`comando:log`) al renderer en tiempo real
  - [x] Guardar PID de cada ejecución en memoria (trackear por Comando)
  - [x] Detener un proceso: usar `taskkill /pid <pid> /t /f` en Windows para matar el árbol completo
  - [x] Detectar cuándo un proceso termina o falla (evento `exit`/`error` de Node) y actualizar el estado
  - [x] Soporte para múltiples ejecuciones concurrentes por servicio (una por cada comando corriendo)
- [x] Controlador IPC: canales `servicio:iniciar`, `servicio:detener`, `servicio:reiniciar` (operan sobre el Comando esPrincipal)
- [x] Nuevo controlador IPC para canales `comando:ejecutar`, `comando:detener`, `comando:reiniciar`
- [x] Renderer: vista de detalle de servicio con lista completa de comandos disponibles, posibilidad de ejecutar cualquiera de ellos individualmente, estado actual, y consola de logs en tiempo real (solo en memoria, sin persistencia)
- [x] **Refactor visual**: Estética Dark Cyberpunk Minimalista en toda la UI (cards, botones, consola, navbar, breadcrumbs)
- [x] **Refactor de código**: Singleton PrismaClient, repositorio de comandos, fix pid=0, fix race condition reiniciarProceso, eliminación de código muerto
- [x] **File dialog defaultPath**: El diálogo de carpetas al crear servicio se abre en la carpeta del proyecto
- [x] **Fix detección de comandos**: `detectorComandos` almacena `npm run <script>` en vez del script raw para que funcione el PATH de node_modules en Windows

**Check de fin de fase**: el usuario puede iniciar un servicio real (ej. un `npm run dev` de un proyecto de prueba), ver sus logs en vivo, detenerlo limpiamente (sin procesos huérfanos en Windows), y reiniciarlo.

## Fase 3 — Múltiples servicios y health checks (días 7-9) (completada)

- [x] Extender el modelo de `Servicio` para incluir `ordenArranque` dentro de su proyecto (ya existía desde fase 1; ahora se asigna automáticamente al final al crear y es editable)
- [x] Implementar health check tipo `http`: polling periódico a una URL/puerto hasta obtener respuesta exitosa (status < 500) o timeout (60s)
- [x] Implementar health check tipo `tcp`: intento de conexión al puerto hasta que acepte conexión o timeout (para casos como bases de datos)
- [x] Caso de uso "iniciar grupo": iniciar los servicios de un proyecto en el orden definido, ejecutando para cada servicio el Comando marcado como esPrincipal, esperando el health check de cada uno antes de iniciar el siguiente
- [x] Manejo de fallos: si un servicio no pasa su health check en un tiempo límite (o su proceso muere), se detiene su proceso, se marca como `error` y se **detiene el arranque del grupo** (los servicios ya iniciados quedan corriendo)
- [x] UI: vista de proyecto mostrando todos sus servicios con estado individual (`detenido`/`iniciando`/`listo`/`error`) y botón para iniciar/detener el grupo completo

**Check de fin de fase**: un proyecto con 2-3 servicios reales (ej. frontend + backend + base de datos) se puede iniciar como grupo, respetando el orden, y cada uno reporta correctamente cuándo está realmente listo.

## Fase 4 — Detección de comandos refinada y UI de grupo (días 10-12)

- [ ] Mejorar la UI de creación/edición de servicio: mostrar los scripts detectados como opciones claras (dropdown), con opción de escribir un comando manual si no aplica
- [ ] Permitir editar un servicio ya creado (cambiar comando, orden, tipo de health check)
- [ ] Vista de proyecto: reordenar visualmente el orden de arranque de los servicios (drag and drop nativo fluido con mango ⠿ e indicadores visuales)
- [ ] Selección granular de servicios para el arranque del grupo (checkboxes por servicio, atajo seleccionar/deseleccionar todos, y ejecución filtrada)
- [ ] Manejo de errores visible en la UI: si un comando falla al iniciar (ej. carpeta inválida, comando no encontrado), mostrar el error de forma clara, no solo en consola

**Check de fin de fase**: el flujo completo de crear/editar servicios y reordenar el grupo se siente sólido, sin necesitar reiniciar la app para ver cambios reflejados.

## Fase 5 — Pulido y automatizaciones finales (días 13-14)

- [ ] Al completar el arranque de un grupo (todos los servicios en estado `listo`), permitir abrir automáticamente: VS Code (`code <path>`), el navegador, o una URL específica configurada por servicio/proyecto
- [ ] Persistencia de configuración de apertura automática (campo en el modelo `Proyecto` o `Servicio`)
- [ ] Revisión general de manejo de errores (procesos que no existen, carpetas eliminadas, puertos ocupados)
- [ ] Limpieza de código: revisar convenciones de nombres en español, tipado explícito, eliminar `any` residuales
- [ ] Configuración básica de ESLint + Prettier aplicada a todo el proyecto
- [ ] README del proyecto: qué es DevDesk, cómo correrlo en desarrollo, y una sección explícita de "roadmap futuro" (Docker, Git/GitHub, perfiles de ejecución, persistencia de logs) para dejar claro que quedaron fuera intencionalmente de esta versión

**Check de fin de fase**: DevDesk es usable de principio a fin con al menos un proyecto real (uno de los proyectos académicos existentes, ej. Axis o StudyGo) como caso de prueba.

## Explícitamente fuera de alcance (no implementar sin pedirlo)

- Detección automática de rol de servicio (frontend/backend)
- Soporte para Docker
- Integración con Git/GitHub
- Perfiles de ejecución múltiples
- Persistencia de logs en disco
- Pruebas unitarias/integración
