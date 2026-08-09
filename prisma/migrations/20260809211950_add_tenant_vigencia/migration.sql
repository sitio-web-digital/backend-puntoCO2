-- Ciclo de vida automático de suscripción (TRIAL -> VENCIDO -> SUSPENDIDO):
-- vigenciaHasta marca fin de prueba o del ciclo pagado; vencidoDesde marca
-- cuándo entró a VENCIDO, para el plazo de gracia antes de SUSPENDIDO.
ALTER TABLE "tenants" ADD COLUMN "vigenciaHasta" TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN "vencidoDesde" TIMESTAMP(3);
