import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { getOrdenTrabajo, calcularTotalOrden } from "@/server/ordenes-trabajo/service";
import { getCliente, type TenantActor } from "@/server/clientes/service";
import { listServicios } from "@/server/servicios/service";
import { listUsuarios } from "@/server/usuarios/service";
import { listEstablecimientosDeCliente } from "@/server/establecimientos/service";
import { EstadoBadge, formatFecha, formatFechaHora, formatMoneda } from "../../_lib/estado-badge";
import { ActionButton } from "../../_components/ActionButton";
import { AgregarItemForm } from "./AgregarItemForm";
import { AsignarTecnicoForm } from "./AsignarTecnicoForm";
import { FinalizarForm } from "./FinalizarForm";
import { RegistrarAvanceForm } from "./RegistrarAvanceForm";
import { QuitarItemButton } from "./QuitarItemButton";
import { EditarOrdenForm } from "./EditarOrdenForm";

const ESTADOS_EDITABLES = ["BORRADOR", "PENDIENTE_DE_APROBACION", "PROGRAMADA", "ASIGNADA", "EN_CAMINO", "EN_PROCESO", "PAUSADA"];

export default async function OrdenDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };

  const { id } = await params;
  const orden = await getOrdenTrabajo(actor, id).catch(() => null);
  if (!orden) notFound();

  const [cliente, servicios, usuarios, establecimientos] = await Promise.all([
    getCliente(actor, orden.clienteId).catch(() => null),
    listServicios(actor).catch(() => []),
    listUsuarios(actor).catch(() => []),
    listEstablecimientosDeCliente(actor, orden.clienteId).catch(() => []),
  ]);

  const nombreCliente = cliente
    ? cliente.tipoCliente === "PERSONA_JURIDICA"
      ? (cliente.razonSocial ?? "—")
      : [cliente.nombre, cliente.apellido].filter(Boolean).join(" ")
    : "—";

  const puedeEditar = ESTADOS_EDITABLES.includes(orden.estado);
  const total = calcularTotalOrden(orden.items);
  const tecnicos = usuarios.map((u) => ({ id: u.id, nombre: `${u.nombre} ${u.apellido}` }));
  const sinMasAcciones = ["CANCELADA", "FACTURADA"].includes(orden.estado);

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 10 }}>
        <Link href="/ordenes-trabajo" className="back-link">
          ← Órdenes de trabajo
        </Link>
        <div className="row-between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
            <h1>Orden #{orden.numero}</h1>
            <EstadoBadge estado={orden.estado} />
          </div>
          {puedeEditar ? (
            <EditarOrdenForm
              orden={orden}
              establecimientos={establecimientos.map((e) => ({ id: e.id, nombre: e.nombre }))}
            />
          ) : null}
        </div>
      </div>

      <div className="card stack" style={{ gap: 16 }}>
        <div className="detail-grid">
          <div>
            <label>Cliente</label>
            <div style={{ fontSize: 14.5 }}>{cliente ? <Link href={`/clientes/${cliente.id}`}>{nombreCliente}</Link> : "—"}</div>
          </div>
          <div>
            <label>Prioridad</label>
            <div>
              <EstadoBadge estado={orden.prioridad} />
            </div>
          </div>
          <div>
            <label>Origen</label>
            <div style={{ fontSize: 14.5 }}>{orden.origen}</div>
          </div>
          <div>
            <label>Fecha de apertura</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {formatFecha(orden.fechaApertura)}
            </div>
          </div>
          <div>
            <label>Fecha programada</label>
            <div className="mono" style={{ fontSize: 14.5 }}>
              {formatFecha(orden.fechaProgramada)}
            </div>
          </div>
          <div>
            <label>Técnico asignado</label>
            <div style={{ fontSize: 14.5 }}>{tecnicos.find((t) => t.id === orden.tecnicoAsignadoId)?.nombre ?? "Sin asignar"}</div>
          </div>
        </div>

        {orden.observaciones || orden.resultadoTecnico ? (
          <div className="grid2" style={{ borderTop: "1px solid var(--border)", paddingTop: 18 }}>
            {orden.observaciones ? (
              <div>
                <label>Observaciones</label>
                <div style={{ fontSize: 14.5, lineHeight: 1.55 }}>{orden.observaciones}</div>
              </div>
            ) : null}
            {orden.resultadoTecnico ? (
              <div>
                <label>Resultado técnico</label>
                <div style={{ fontSize: 14.5, lineHeight: 1.55 }}>{orden.resultadoTecnico}</div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
          <h2>Acciones</h2>
        </div>
        {sinMasAcciones ? (
          <p className="muted" style={{ padding: "12px 16px" }}>
            No admite más acciones: la orden quedó {orden.estado.toLowerCase()}.
          </p>
        ) : (
          <div className="actions-bar" style={{ padding: "12px 16px" }}>
            {orden.estado === "BORRADOR" ? (
              <ActionButton label="Enviar a aprobación" url={`/api/ordenes-trabajo/${orden.id}/enviar-a-aprobacion`} />
            ) : null}
            {["BORRADOR", "PENDIENTE_DE_APROBACION"].includes(orden.estado) ? (
              <ActionButton label="Aprobar / programar" url={`/api/ordenes-trabajo/${orden.id}/aprobar`} variant="primary" />
            ) : null}
            {["PROGRAMADA", "ASIGNADA"].includes(orden.estado) ? <AsignarTecnicoForm ordenId={orden.id} tecnicos={tecnicos} /> : null}
            {orden.estado === "ASIGNADA" ? <ActionButton label="Marcar en camino" url={`/api/ordenes-trabajo/${orden.id}/en-camino`} /> : null}
            {["ASIGNADA", "EN_CAMINO"].includes(orden.estado) ? (
              <ActionButton label="Iniciar trabajo" url={`/api/ordenes-trabajo/${orden.id}/iniciar`} variant="primary" />
            ) : null}
            {orden.estado === "EN_PROCESO" ? (
              <ActionButton label="Pausar" url={`/api/ordenes-trabajo/${orden.id}/pausar`} pedirMotivoComo="motivo" />
            ) : null}
            {orden.estado === "PAUSADA" ? (
              <ActionButton label="Reanudar" url={`/api/ordenes-trabajo/${orden.id}/reanudar`} variant="primary" />
            ) : null}
            {orden.estado === "EN_PROCESO" ? <FinalizarForm ordenId={orden.id} /> : null}
            {orden.estado === "FINALIZADA" ? <ActionButton label="Entregar" url={`/api/ordenes-trabajo/${orden.id}/entregar`} variant="primary" /> : null}
            {orden.estado === "ENTREGADA" ? <ActionButton label="Facturar" url={`/api/ordenes-trabajo/${orden.id}/facturar`} variant="primary" /> : null}
            {puedeEditar ? (
              <ActionButton label="Cancelar orden" url={`/api/ordenes-trabajo/${orden.id}/cancelar`} pedirMotivoComo="motivo" variant="danger" />
            ) : null}
          </div>
        )}
      </div>

      {["ASIGNADA", "EN_CAMINO", "EN_PROCESO", "PAUSADA"].includes(orden.estado) ? (
        <div className="card">
          <h2 style={{ marginBottom: 16 }}>Registrar avance</h2>
          <RegistrarAvanceForm ordenId={orden.id} />
        </div>
      ) : null}

      <div className="card">
        <div className="row-between" style={{ marginBottom: 16 }}>
          <h2>Ítems de servicio</h2>
          <strong>
            Total: <span className="mono">{formatMoneda(total)}</span>
          </strong>
        </div>
        {puedeEditar ? <AgregarItemForm ordenId={orden.id} servicios={servicios.map((s) => ({ id: s.id, nombre: s.nombre }))} /> : null}

        {orden.items.length === 0 ? (
          <p className="muted" style={{ marginTop: 16 }}>
            Todavía no se agregaron ítems.
          </p>
        ) : (
          <table style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Cantidad</th>
                <th>Precio unitario</th>
                <th>Subtotal</th>
                {puedeEditar ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {orden.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.descripcion}</td>
                  <td className="mono">{item.cantidad}</td>
                  <td className="mono">{formatMoneda(item.precioUnitario)}</td>
                  <td className="mono">{formatMoneda(item.subtotal)}</td>
                  {puedeEditar ? (
                    <td>
                      <QuitarItemButton ordenId={orden.id} itemId={item.id} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 12 }}>Unidades incluidas</h2>
        {orden.unidades.length === 0 ? (
          <p className="muted">No tiene unidades vinculadas.</p>
        ) : (
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            {orden.unidades.map((u) => (
              <Link key={u.id} href={`/matafuegos/${u.matafuegoId}`} className="badge badge-info">
                Ver unidad ↗
              </Link>
            ))}
          </div>
        )}
      </div>

      {orden.fechaFinalizacion ? (
        <p className="muted">
          Finalizada el <span className="mono">{formatFechaHora(orden.fechaFinalizacion)}</span>.
        </p>
      ) : null}
    </div>
  );
}
