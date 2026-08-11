export type Estado = "ok" | "warn" | "bad" | "neutral";

export function estadoDe(valor: string): Estado {
  if (["Activo", "Apto", "Emitido", "Enviada", "Entregada", "Leída"].includes(valor)) return "ok";
  if (["Suspendido", "Observado", "En taller", "Pendiente", "Reintento"].includes(valor)) return "warn";
  if (["Vencido"].includes(valor)) return "bad";
  return "neutral";
}

export const CLIENTES_ROWS = [
  ["Supermercado La Espiga SRL", "30-71234567-8", "Activo", "Responsable inscripto", "3", "64"],
  ["Metalúrgica San Martín SA", "30-70123456-1", "Activo", "Responsable inscripto", "2", "41"],
  ["Farmacia Central — Roberto Díaz", "27-24567891-3", "Activo", "Monotributista", "1", "6"],
  ["Colegio San José", "30-65432198-7", "Suspendido", "Exento", "1", "18"],
  ["Distribuidora Los Álamos SRL", "30-69988776-4", "Dado de baja", "Responsable inscripto", "2", "27"],
];

export const MATAFUEGOS_ROWS = [
  ["MAT-0231", "AR-88342", "Apto", "Portátil", "Polvo químico ABC", "Ver ficha ↗"],
  ["MAT-0198", "AR-77129", "Observado", "Portátil", "CO₂", "Ver ficha ↗"],
  ["MAT-0056", "AR-55012", "Vencido", "Rodante", "Polvo químico ABC", "Ver ficha ↗"],
  ["MAT-0312", "AR-91004", "En taller", "Portátil", "Agua", "Ver ficha ↗"],
  ["MAT-0044", "AR-40221", "Pendiente", "Vehicular", "CO₂", "Ver ficha ↗"],
];

export const REPORTES_ROWS = [
  ["MAT-0198", "AR-77129", "Observado", "15/09/2026", "—", "La Espiga SRL"],
  ["MAT-0312", "AR-91004", "En taller", "—", "10/08/2026", "San Martín SA"],
  ["MAT-0044", "AR-40221", "Pendiente", "02/08/2026", "—", "Colegio San José"],
  ["MAT-0087", "AR-33018", "Apto", "05/08/2026", "—", "Farmacia Central"],
  ["MAT-0119", "AR-60271", "Apto", "—", "12/08/2026", "Los Álamos SRL"],
];

export const NOTIFICACIONES_ROWS = [
  ["Certificado emitido", "EMAIL", "Enviada", "compras@laespiga.com.ar", "20/07/2026 16:02"],
  ["Vencimiento próximo", "WHATSAPP", "Entregada", "+54 9 11 5555-1234", "19/07/2026 09:30"],
  ["Unidad retirada", "WHATSAPP", "Entregada", "+54 9 11 4444-7890", "28/07/2026 10:16"],
  ["Mantenimiento atrasado", "EMAIL", "Reintento", "administracion@sanmartinsa.com.ar", "25/07/2026 08:00"],
  ["Orden programada", "EMAIL", "Leída", "compras@laespiga.com.ar", "20/07/2026 09:10"],
];
