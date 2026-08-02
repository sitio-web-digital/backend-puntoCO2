import { z } from "zod";

// Validación laxa de formato (dígitos y guiones opcionales), no dígito verificador:
// eso puede sumarse más adelante si se necesita validar contra AFIP/ARCA de verdad.
const cuitRegex = /^\d{2}-?\d{8}-?\d{1}$/;

const baseClienteSchema = z.object({
  tipoCliente: z.enum(["PERSONA_HUMANA", "PERSONA_JURIDICA"]),
  nombre: z.string().trim().min(1).max(150).optional(),
  apellido: z.string().trim().min(1).max(150).optional(),
  razonSocial: z.string().trim().min(1).max(200).optional(),
  nombreFantasia: z.string().trim().max(200).optional(),
  cuit: z.string().trim().regex(cuitRegex, "CUIT inválido (formato esperado: 20-12345678-9)").optional(),
  condicionIva: z.enum(["RESPONSABLE_INSCRIPTO", "MONOTRIBUTISTA", "EXENTO", "CONSUMIDOR_FINAL", "NO_RESPONSABLE"]),
  tipoConsumidor: z.enum(["CONSUMIDOR_FINAL", "EMPRESA", "ORGANISMO_PUBLICO"]),
  email: z.string().trim().email().optional(),
  whatsapp: z.string().trim().max(30).optional(),
  telefonoAlternativo: z.string().trim().max(30).optional(),
  domicilioFiscal: z.string().trim().max(300).optional(),
  provincia: z.string().trim().max(100).optional(),
  localidad: z.string().trim().max(100).optional(),
  codigoPostal: z.string().trim().max(20).optional(),
  canalPreferido: z.enum(["EMAIL", "WHATSAPP", "TELEFONO"]).default("EMAIL"),
  condicionPago: z.string().trim().max(100).optional(),
  observaciones: z.string().trim().max(2000).optional(),
});

function requierePersonaOJuridica<T extends z.infer<typeof baseClienteSchema>>(data: T, ctx: z.RefinementCtx) {
  if (data.tipoCliente === "PERSONA_HUMANA" && (!data.nombre || !data.apellido)) {
    ctx.addIssue({ code: "custom", message: "Nombre y apellido son obligatorios para persona humana", path: ["nombre"] });
  }
  if (data.tipoCliente === "PERSONA_JURIDICA" && !data.razonSocial) {
    ctx.addIssue({ code: "custom", message: "La razón social es obligatoria para persona jurídica", path: ["razonSocial"] });
  }
}

export const createClienteSchema = baseClienteSchema.superRefine(requierePersonaOJuridica);

export const updateClienteSchema = baseClienteSchema.partial().extend({
  tipoCliente: baseClienteSchema.shape.tipoCliente.optional(),
});

// z.input (no z.infer/z.output): "canalPreferido" tiene default, así que quien
// llama a createCliente puede omitirlo. z.output lo exigiría siempre presente,
// que es la forma del objeto ya parseado, no la del input que se recibe.
export type CreateClienteInput = z.input<typeof createClienteSchema>;
export type UpdateClienteInput = z.input<typeof updateClienteSchema>;
