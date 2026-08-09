import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { listMantenimientosPaginado, listReglasMantenimientoPaginado } from "@/server/mantenimientos/service";
import { listMatafuegos } from "@/server/matafuegos/service";
import type { TenantActor } from "@/server/clientes/service";
import { EstadoBadge, formatFecha } from "../_lib/estado-badge";
import { ActionButton } from "../_components/ActionButton";
import { Pagination } from "../_components/Pagination";
import { ReglasHeader } from "./NuevaReglaForm";
import { CalendarioHeader } from "./NuevoMantenimientoForm";

export default async function MantenimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ calendarioPage?: string; reglasPage?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };

  const { calendarioPage: calendarioPageParam, reglasPage: reglasPageParam } = await searchParams;

  const [mantenimientosPagina, reglasPagina, matafuegos] = await Promise.all([
    listMantenimientosPaginado(actor, { page: calendarioPageParam ? Number(calendarioPageParam) : 1 }),
    listReglasMantenimientoPaginado(actor, { page: reglasPageParam ? Number(reglasPageParam) : 1 }),
    listMatafuegos(actor),
  ]);
  const { items: mantenimientos, total: totalMantenimientos, page: paginaMantenimientos, totalPages: totalPaginasMantenimientos, pageSize: pageSizeMantenimientos } = mantenimientosPagina;
  const { items: reglas, total: totalReglas, page: paginaReglas, totalPages: totalPaginasReglas, pageSize: pageSizeReglas } = reglasPagina;

  return (
    <div className="stack">
      <h1>Mantenimientos</h1>

      <div className="card" style={{ padding: 0 }}>
        <CalendarioHeader matafuegos={matafuegos.map((m) => ({ id: m.id, codigoInterno: m.codigoInterno }))} count={totalMantenimientos}>
          {mantenimientos.length === 0 ? (
            <p className="muted" style={{ padding: 16 }}>
              No hay mantenimientos programados.
            </p>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Unidad</th>
                      <th>Tipo de servicio</th>
                      <th>Fecha programada</th>
                      <th>Prioridad</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mantenimientos.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <Link href={`/matafuegos/${m.matafuegoId}`}>Ver unidad</Link>
                        </td>
                        <td>{m.tipoServicio}</td>
                        <td className="mono">{formatFecha(m.fechaProgramada)}</td>
                        <td>
                          <EstadoBadge estado={m.prioridad} />
                        </td>
                        <td>
                          <EstadoBadge estado={m.estado} />
                        </td>
                        <td>
                          {["PROGRAMADO", "REPROGRAMADO"].includes(m.estado) ? (
                            <div className="row" style={{ gap: 6 }}>
                              <ActionButton
                                label="Marcar realizado"
                                url={`/api/mantenimientos/${m.id}/realizado`}
                                variant="primary"
                                size="sm"
                              />
                              <ActionButton
                                label="Cancelar"
                                url={`/api/mantenimientos/${m.id}/cancelar`}
                                pedirMotivoComo="motivo"
                                variant="danger"
                                size="sm"
                              />
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={paginaMantenimientos}
                totalPages={totalPaginasMantenimientos}
                total={totalMantenimientos}
                pageSize={pageSizeMantenimientos}
                basePath="/mantenimientos"
                pageParam="calendarioPage"
                searchParams={{ calendarioPage: calendarioPageParam, reglasPage: reglasPageParam }}
              />
            </>
          )}
        </CalendarioHeader>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <ReglasHeader count={totalReglas}>
          {reglas.length === 0 ? (
            <p className="muted" style={{ padding: 16 }}>
              No hay reglas cargadas.
            </p>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>Tipo de servicio</th>
                      <th>Frecuencia</th>
                      <th>Tipo de unidad</th>
                      <th>Agente</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reglas.map((r) => (
                      <tr key={r.id}>
                        <td>{r.tipoServicio}</td>
                        <td className="mono">{r.frecuenciaMeses} meses</td>
                        <td>{r.tipoMatafuego ?? "Cualquiera"}</td>
                        <td>{r.agenteExtintor ?? "Cualquiera"}</td>
                        <td>
                          <EstadoBadge estado={r.estado} />
                        </td>
                        <td>
                          {r.estado === "ACTIVA" ? (
                            <ActionButton
                              label="Desactivar"
                              url={`/api/reglas-mantenimiento/${r.id}/desactivar`}
                              pedirMotivoComo="motivo"
                              size="sm"
                            />
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={paginaReglas}
                totalPages={totalPaginasReglas}
                total={totalReglas}
                pageSize={pageSizeReglas}
                basePath="/mantenimientos"
                pageParam="reglasPage"
                searchParams={{ calendarioPage: calendarioPageParam, reglasPage: reglasPageParam }}
              />
            </>
          )}
        </ReglasHeader>
      </div>
    </div>
  );
}
