-- Lista de espera de la landing pública (/home), previa al lanzamiento
-- comercial. Tabla simple, sin tenantId ni RLS: no es dato de negocio de
-- ningún tenant.
CREATE TABLE "waitlist_leads" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "waitlist_leads_email_key" ON "waitlist_leads"("email");

-- app_user necesita poder insertar acá: la ruta pública POST /api/waitlist
-- corre con RUNTIME_DATABASE_URL, no con el dueño de las tablas.
GRANT SELECT, INSERT, UPDATE, DELETE ON "waitlist_leads" TO app_user;
