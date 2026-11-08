-- CreateTable
CREATE TABLE "Proyecto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "fechaCreacion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Servicio" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "tipoHealthCheck" TEXT NOT NULL DEFAULT 'none',
    "objetivoHealthCheck" TEXT,
    "ordenArranque" INTEGER NOT NULL DEFAULT 0,
    "proyectoId" INTEGER NOT NULL,
    CONSTRAINT "Servicio_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comando" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "servicioId" INTEGER NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "comando" TEXT NOT NULL,
    "origen" TEXT NOT NULL DEFAULT 'detectado',
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Comando_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Proyecto_path_key" ON "Proyecto"("path");
