-- Simplifica precios: se saca el versionado por lista de precios
-- (ListaPrecio/PrecioServicio), que en la práctica ninguna pantalla llegó a
-- usar (todo ítem de orden de trabajo ya resolvía por el fallback
-- servicio.precioBase). Servicio.precioBase pasa a ser el único precio.
ALTER TABLE "clientes" DROP COLUMN "listaPrecioId";
DROP TABLE "precios_servicio";
DROP TABLE "listas_precio";
DROP TYPE "EstadoListaPrecio";
