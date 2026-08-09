import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { listMatafuegos } from "@/server/matafuegos/service";
import { getEstablecimiento } from "@/server/establecimientos/service";
import { renderQrSvg } from "@/server/qr/render";
import { getBaseUrl } from "@/server/http/base-url";
import type { TenantActor } from "@/server/clientes/service";
import { ImprimirButton } from "./ImprimirButton";

export default async function ImprimirQrPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; establecimientoId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");
  const actor: TenantActor = { tenantId: user.tenantId, usuarioId: user.usuarioId };

  const { ids: idsParam, establecimientoId } = await searchParams;
  const ids = idsParam ? idsParam.split(",").filter(Boolean) : undefined;

  const [matafuegos, establecimiento, baseUrl] = await Promise.all([
    listMatafuegos(actor, { ...(ids ? { ids } : {}), ...(establecimientoId ? { establecimientoId } : {}) }),
    establecimientoId ? getEstablecimiento(actor, establecimientoId).catch(() => null) : Promise.resolve(null),
    getBaseUrl(),
  ]);

  const etiquetas = await Promise.all(
    matafuegos.map(async (m) => ({
      id: m.id,
      codigoInterno: m.codigoInterno,
      numeroSerie: m.numeroSerie,
      tipo: m.tipo,
      svg: await renderQrSvg(`${baseUrl}/qr/${m.qrToken}`),
    })),
  );

  return (
    <div className="stack">
      <div className="row-between no-print" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="stack" style={{ gap: 5 }}>
          <Link href={establecimientoId ? `/establecimientos/${establecimientoId}` : "/matafuegos"} className="back-link">
            ← Volver
          </Link>
          <h1>Etiquetas QR{establecimiento ? ` — ${establecimiento.nombre}` : ""}</h1>
          <p className="muted">
            {etiquetas.length} etiqueta{etiquetas.length === 1 ? "" : "s"}. Cada una apunta a la ficha pública de esa unidad.
          </p>
        </div>
        <ImprimirButton />
      </div>

      {etiquetas.length === 0 ? (
        <p className="muted">No hay matafuegos para imprimir con este filtro.</p>
      ) : (
        <div className="qr-print-grid">
          {etiquetas.map((e) => (
            <div key={e.id} className="qr-label">
              <div className="qr-label-svg" dangerouslySetInnerHTML={{ __html: e.svg }} />
              <div className="qr-label-codigo">{e.codigoInterno}</div>
              <div className="qr-label-serie">N° {e.numeroSerie}</div>
              <div className="qr-label-tipo">{e.tipo.replace(/_/g, " ")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
