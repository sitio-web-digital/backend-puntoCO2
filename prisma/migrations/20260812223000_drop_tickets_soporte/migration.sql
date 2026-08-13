-- Elimina el módulo de soporte in-app (tickets entre empresa y plataforma):
-- se simplifica el alcance de la SaaS para un cliente final no técnico.
-- RLS y los GRANT a app_user se caen solos con el DROP TABLE. Ninguna otra
-- tabla tiene FK hacia estas dos, así que el drop es seguro.
DROP TABLE "mensajes_ticket";
DROP TABLE "tickets_soporte";
DROP TYPE "PrioridadTicketSoporte";
DROP TYPE "EstadoTicketSoporte";
