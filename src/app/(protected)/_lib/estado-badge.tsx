const ESTADOS_SUCCESS = new Set([
  "ACTIVO",
  "ACTIVA",
  "APTO",
  "ENVIADA",
  "ENTREGADA",
  "ENTREGADO",
  "LEIDA",
  "REALIZADO",
  "RESUELTA",
  "VERIFICADA",
  "CERRADA",
  "FINALIZADA",
  "EMITIDO",
  "VIGENTE",
  "RESUELTO",
]);

const ESTADOS_WARNING = new Set([
  "SUSPENDIDO",
  "PENDIENTE",
  "PENDIENTE_DE_APROBACION",
  "PENDIENTE_DE_CONTROL",
  "OBSERVADO",
  "PROGRAMADO",
  "PROGRAMADA",
  "REPROGRAMADO",
  "EN_PROCESO",
  "EN_TRASLADO",
  "EN_TALLER",
  "EN_CAMINO",
  "ASIGNADA",
  "ASIGNADO",
  "PAUSADA",
  "REINTENTO",
  "RETIRADO",
  "ABIERTA",
  "EN_TRATAMIENTO",
  "ABIERTO",
  "EN_PROGRESO",
]);

const ESTADOS_DANGER = new Set([
  "VENCIDO",
  "RECHAZADO",
  "FALLIDA",
  "ANULADO",
  "CANCELADO",
  "CANCELADA",
  "FUERA_DE_SERVICIO",
  "EXTRAVIADO",
  "DADO_DE_BAJA",
]);

const ESTADOS_NEUTRAL = new Set(["BORRADOR", "REEMPLAZADO", "DESCARTADA", "INACTIVO", "INACTIVA", "CERRADO"]);

export function estadoBadgeClass(estado: string): string {
  if (ESTADOS_SUCCESS.has(estado)) return "badge badge-success";
  if (ESTADOS_WARNING.has(estado)) return "badge badge-warning";
  if (ESTADOS_DANGER.has(estado)) return "badge badge-danger";
  if (ESTADOS_NEUTRAL.has(estado)) return "badge badge-neutral";
  return "badge badge-info";
}

export function EstadoBadge({ estado }: { estado: string }) {
  return <span className={estadoBadgeClass(estado)}>{estado.replaceAll("_", " ")}</span>;
}

export function formatFecha(fecha: Date | string | null | undefined): string {
  if (!fecha) return "—";
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatFechaHora(fecha: Date | string | null | undefined): string {
  if (!fecha) return "—";
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function formatMoneda(valor: number | { toNumber(): number } | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  const num = typeof valor === "number" ? valor : valor.toNumber();
  return num.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}
