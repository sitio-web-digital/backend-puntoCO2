-- Generada a mano: `prisma migrate dev` no puede correr en modo no
-- interactivo cuando hay una advertencia de constraint único (aunque sea
-- inofensiva, como acá — la tabla estaba vacía al momento de esta migración).

-- AlterTable
ALTER TABLE "matafuegos" ADD COLUMN "qrToken" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "matafuegos_qrToken_key" ON "matafuegos"("qrToken");
