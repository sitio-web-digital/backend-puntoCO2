import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { listServiciosPaginado, listListasPrecioPaginado, calcularMargen } from "@/server/servicios/service";
import type { TenantActor } from "@/server/clientes/service";
import { EstadoBadge, formatMoneda } from "../_lib/estado-badge";
import { ActionButton } from "../_components/ActionButton";
import { NuevoServicioForm } from "./NuevoServicioForm";
import { NuevaListaPrecioForm } from "./NuevaListaPrecioForm";
import { EditarServicioForm } from "./EditarServicioForm";
import { EditarListaPrecioForm } from "./EditarListaPrecioForm";
import { Pagination } from "../_components/Pagination";

export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ serviciosPage?: string; listasPage?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };

  const { serviciosPage, listasPage } = await searchParams;
  const [serviciosPagina, listasPagina] = await Promise.all([
    listServiciosPaginado(actor, { page: serviciosPage ? Number(serviciosPage) : 1 }),
    listListasPrecioPaginado(actor, { page: listasPage ? Number(listasPage) : 1 }),
  ]);
  const {
    items: servicios,
    total: totalServicios,
    page: paginaServicios,
    totalPages: totalPagesServicios,
    pageSize: pageSizeServicios,
  } = serviciosPagina;
  const { items: listas, total: totalListas, page: paginaListas, totalPages: totalPagesListas, pageSize: pageSizeListas } = listasPagina;

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 5 }}>
        <h1>Servicios y precios</h1>
        <p className="muted">
          {totalServicios} servicio{totalServicios === 1 ? "" : "s"} en el catálogo · {totalListas} lista
          {totalListas === 1 ? "" : "s"} de precios
        </p>
      </div>

      <div className="stack" style={{ gap: 16 }}>
        <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
          <h2>Catálogo de servicios</h2>
          <NuevoServicioForm />
        </div>

        <div className="card" style={{ padding: 0 }}>
          {servicios.length === 0 ? (
            <p className="muted" style={{ padding: 16 }}>
              Todavía no hay servicios cargados.
            </p>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Nombre</th>
                      <th>Categoría</th>
                      <th>Precio base</th>
                      <th>Margen</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicios.map((s) => {
                      const margen = calcularMargen(s);
                      return (
                        <tr key={s.id}>
                          <td className="mono">{s.codigo}</td>
                          <td>{s.nombre}</td>
                          <td>{s.categoria}</td>
                          <td className="mono">{formatMoneda(s.precioBase)}</td>
                          <td className="mono">{margen.margenPorcentaje !== null ? `${margen.margenPorcentaje.toFixed(0)}%` : "—"}</td>
                          <td>
                            <EstadoBadge estado={s.estado} />
                          </td>
                          <td>
                            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              <EditarServicioForm
                                servicio={{
                                  id: s.id,
                                  codigo: s.codigo,
                                  nombre: s.nombre,
                                  categoria: s.categoria,
                                  descripcion: s.descripcion,
                                  precioBase: s.precioBase.toNumber(),
                                  costoEstimado: s.costoEstimado ? s.costoEstimado.toNumber() : null,
                                  iva: s.iva.toNumber(),
                                  moneda: s.moneda,
                                  duracionEstimadaMinutos: s.duracionEstimadaMinutos,
                                  agentesCompatibles: s.agentesCompatibles,
                                  capacidadesCompatibles: s.capacidadesCompatibles,
                                  requiereRetiro: s.requiereRetiro,
                                  requiereEnsayo: s.requiereEnsayo,
                                  requiereRepuestos: s.requiereRepuestos,
                                  requiereCertificado: s.requiereCertificado,
                                  vigenteDesde: s.vigenteDesde,
                                  vigenteHasta: s.vigenteHasta,
                                }}
                              />
                              {s.estado === "ACTIVO" ? (
                                <ActionButton label="Desactivar" url={`/api/servicios/${s.id}/desactivar`} size="sm" />
                              ) : (
                                <ActionButton label="Reactivar" url={`/api/servicios/${s.id}/reactivar`} variant="primary" size="sm" />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={paginaServicios}
                totalPages={totalPagesServicios}
                total={totalServicios}
                pageSize={pageSizeServicios}
                basePath="/servicios"
                pageParam="serviciosPage"
                searchParams={{ listasPage }}
              />
            </>
          )}
        </div>
      </div>

      <div className="stack" style={{ gap: 16 }}>
        <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
          <h2>Listas de precios</h2>
          <NuevaListaPrecioForm />
        </div>

        <div className="card" style={{ padding: 0 }}>
          {listas.length === 0 ? (
            <p className="muted" style={{ padding: 16 }}>
              Todavía no hay listas de precios cargadas.
            </p>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Predeterminada</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {listas.map((l) => (
                      <tr key={l.id}>
                        <td>{l.nombre}</td>
                        <td>{l.esPredeterminada ? "Sí" : "No"}</td>
                        <td>
                          <EstadoBadge estado={l.estado} />
                        </td>
                        <td>
                          <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <EditarListaPrecioForm
                              lista={{ id: l.id, nombre: l.nombre, descripcion: l.descripcion, esPredeterminada: l.esPredeterminada }}
                            />
                            {l.estado === "ACTIVA" ? (
                              <ActionButton label="Desactivar" url={`/api/listas-precio/${l.id}/desactivar`} size="sm" />
                            ) : (
                              <ActionButton label="Reactivar" url={`/api/listas-precio/${l.id}/reactivar`} variant="primary" size="sm" />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={paginaListas}
                totalPages={totalPagesListas}
                total={totalListas}
                pageSize={pageSizeListas}
                basePath="/servicios"
                pageParam="listasPage"
                searchParams={{ serviciosPage }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
