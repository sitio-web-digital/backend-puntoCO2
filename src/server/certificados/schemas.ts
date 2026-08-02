import { z } from "zod";

const TIPO_CERTIFICADO = [
  "CERTIFICADO_MANTENIMIENTO",
  "CERTIFICADO_RECARGA",
  "INFORME_INSPECCION",
  "ACTA_RETIRO",
  "ACTA_ENTREGA",
  "INFORME_PRUEBA_HIDRAULICA",
  "CONSTANCIA_NO_CONFORMIDAD",
  "PLANILLA_DOTACION",
  "HISTORIAL_TECNICO",
  "CERTIFICADO_BAJA",
] as const;

export const emitirCertificadoSchema = z.object({
  ordenTrabajoId: z.string().min(1, "La orden de trabajo es obligatoria"),
  tipo: z.enum(TIPO_CERTIFICADO),
  responsableTecnicoId: z.string().min(1).optional(),
  responsableTecnicoNombre: z.string().trim().max(200).optional(),
  firmaResponsableNombre: z.string().trim().max(200).optional(),
  vigenciaHasta: z.coerce.date().optional(),
  observaciones: z.string().trim().max(2000).optional(),
});
export type EmitirCertificadoInput = z.input<typeof emitirCertificadoSchema>;

export const reemplazarCertificadoSchema = z.object({
  motivo: z.string().trim().min(1, "El motivo del reemplazo es obligatorio").max(1000),
  responsableTecnicoId: z.string().min(1).optional(),
  responsableTecnicoNombre: z.string().trim().max(200).optional(),
  firmaResponsableNombre: z.string().trim().max(200).optional(),
  vigenciaHasta: z.coerce.date().optional(),
  observaciones: z.string().trim().max(2000).optional(),
});
export type ReemplazarCertificadoInput = z.input<typeof reemplazarCertificadoSchema>;
