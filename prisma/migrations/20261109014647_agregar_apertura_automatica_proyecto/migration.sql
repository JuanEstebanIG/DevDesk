-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Proyecto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "fechaCreacion" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abrirVsCodeAlIniciar" BOOLEAN NOT NULL DEFAULT false,
    "abrirNavegadorAlIniciar" BOOLEAN NOT NULL DEFAULT false,
    "urlAperturaAuto" TEXT
);
INSERT INTO "new_Proyecto" ("fechaCreacion", "id", "nombre", "path") SELECT "fechaCreacion", "id", "nombre", "path" FROM "Proyecto";
DROP TABLE "Proyecto";
ALTER TABLE "new_Proyecto" RENAME TO "Proyecto";
CREATE UNIQUE INDEX "Proyecto_path_key" ON "Proyecto"("path");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
