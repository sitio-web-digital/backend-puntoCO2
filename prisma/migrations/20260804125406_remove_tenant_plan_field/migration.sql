-- El campo "plan" nunca se seteaba fuera del default "trial" ni se leía en
-- ninguna lógica de negocio: quedaba desincronizado del ciclo de vida real
-- de la empresa (EstadoTenant), mostrando "trial" para siempre aunque la
-- empresa ya estuviera ACTIVO/SUSPENDIDO/etc. Se elimina para que "estado"
-- sea la única fuente de verdad sobre la situación de una empresa.
ALTER TABLE "tenants" DROP COLUMN "plan";
