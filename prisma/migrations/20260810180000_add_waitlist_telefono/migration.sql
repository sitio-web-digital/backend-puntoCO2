-- Teléfono obligatorio junto al email en la lista de espera de la landing.
-- DEFAULT '' sólo para no romper filas ya existentes al agregar la columna;
-- se retira enseguida así los inserts nuevos dependen de que la app lo mande.
ALTER TABLE "waitlist_leads" ADD COLUMN "telefono" TEXT NOT NULL DEFAULT '';
ALTER TABLE "waitlist_leads" ALTER COLUMN "telefono" DROP DEFAULT;
