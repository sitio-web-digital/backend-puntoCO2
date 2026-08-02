import type { AccionPermiso, AlcancePermiso, RecursoPermiso } from "@prisma/client";
import type { TenantTx } from "../db/with-tenant";

export interface PermisoTemplate {
  recurso: RecursoPermiso;
  accion: AccionPermiso;
  alcance: AlcancePermiso;
}

export interface RoleTemplate {
  nombre: string;
  descripcion: string;
  permisos: PermisoTemplate[];
}

function grants(recurso: RecursoPermiso, acciones: AccionPermiso[], alcance: AlcancePermiso): PermisoTemplate[] {
  return acciones.map((accion) => ({ recurso, accion, alcance }));
}

const TODAS_LAS_ACCIONES: AccionPermiso[] = ["VER", "CREAR", "EDITAR", "APROBAR", "EMITIR", "EXPORTAR", "ELIMINAR"];

const TODOS_LOS_RECURSOS_TENANT: RecursoPermiso[] = [
  "CLIENTES",
  "ESTABLECIMIENTOS",
  "MATAFUEGOS",
  "INSPECCIONES",
  "NO_CONFORMIDADES",
  "MANTENIMIENTOS",
  "SERVICIOS_PRECIOS",
  "ORDENES_TRABAJO",
  "RETIROS_ENTREGAS",
  "CERTIFICADOS",
  "NOTIFICACIONES",
  "REPORTES",
  "USUARIOS_ROLES",
];

/**
 * Roles iniciales de RF-27, con la matriz "módulo + acción + alcance" del
 * documento de requisitos. `esSuperAdminSaas` en Usuario cubre al
 * Superadministrador SaaS por fuera de este catálogo: su autoridad es de
 * plataforma (RF-28), no de negocio dentro de un tenant, así que no tiene fila
 * en Rol/RolPermiso.
 *
 * FACTURACION y COBRANZA sólo tienen acceso de lectura sobre los recursos que
 * ya existen (RF-23/RF-24 son segunda etapa); cuando se implementen esos
 * módulos, sumar sus recursos propios y ampliar estos dos roles.
 */
export const DEFAULT_ROLE_TEMPLATES: RoleTemplate[] = [
  {
    nombre: "Administrador de empresa",
    descripcion: "Control total sobre los datos y usuarios del tenant. No administra el plan/suscripción de la plataforma.",
    permisos: TODOS_LOS_RECURSOS_TENANT.flatMap((recurso) => grants(recurso, TODAS_LAS_ACCIONES, "TODAS")),
  },
  {
    nombre: "Responsable técnico",
    descripcion: "Supervisión técnica de toda la operación: inspecciones, mantenimientos, certificados.",
    permisos: [
      ...grants("CLIENTES", ["VER"], "TODAS"),
      ...grants("ESTABLECIMIENTOS", ["VER", "EDITAR"], "TODAS"),
      ...grants("MATAFUEGOS", ["VER", "CREAR", "EDITAR"], "TODAS"),
      ...grants("INSPECCIONES", ["VER", "CREAR", "EDITAR", "APROBAR"], "TODAS"),
      ...grants("NO_CONFORMIDADES", ["VER", "CREAR", "EDITAR", "APROBAR"], "TODAS"),
      ...grants("MANTENIMIENTOS", ["VER", "CREAR", "EDITAR"], "TODAS"),
      ...grants("SERVICIOS_PRECIOS", ["VER"], "TODAS"),
      ...grants("ORDENES_TRABAJO", ["VER", "CREAR", "EDITAR", "APROBAR"], "TODAS"),
      ...grants("RETIROS_ENTREGAS", ["VER", "CREAR", "EDITAR"], "TODAS"),
      ...grants("CERTIFICADOS", ["VER", "CREAR", "EMITIR"], "TODAS"),
      ...grants("NOTIFICACIONES", ["VER"], "TODAS"),
      ...grants("REPORTES", ["VER"], "TODAS"),
    ],
  },
  {
    nombre: "Técnico de campo",
    descripcion: "Ejecuta inspecciones, mantenimientos y órdenes asignadas en terreno.",
    permisos: [
      ...grants("CLIENTES", ["VER"], "ESTABLECIMIENTO_ASIGNADO"),
      ...grants("ESTABLECIMIENTOS", ["VER"], "ESTABLECIMIENTO_ASIGNADO"),
      ...grants("MATAFUEGOS", ["VER"], "ESTABLECIMIENTO_ASIGNADO"),
      ...grants("MATAFUEGOS", ["EDITAR"], "PROPIO"),
      ...grants("INSPECCIONES", ["VER", "CREAR", "EDITAR"], "PROPIO"),
      // EDITAR:PROPIO además de VER/CREAR — sin esto, un técnico podría
      // reportar una no conformidad (RF-07) pero nunca avanzar su propio
      // estado (iniciar tratamiento, resolver), aunque sea suya o esté
      // asignado a él. Asignar/verificar/cerrar siguen reservados a alcance
      // TODAS en el servicio, independientemente de este permiso genérico.
      ...grants("NO_CONFORMIDADES", ["VER", "CREAR", "EDITAR"], "PROPIO"),
      ...grants("MANTENIMIENTOS", ["VER"], "PROPIO"),
      // VER:TODAS sobre el catálogo de servicios (no PROPIO: no hay noción de
      // "servicio propio") — sin esto, un técnico no podría ver qué
      // servicio/precio corresponde al ítem que agrega a su propia orden
      // asignada (RF-11), aunque tenga EDITAR:PROPIO sobre ORDENES_TRABAJO.
      ...grants("SERVICIOS_PRECIOS", ["VER"], "TODAS"),
      ...grants("ORDENES_TRABAJO", ["VER", "EDITAR"], "PROPIO"),
      ...grants("RETIROS_ENTREGAS", ["VER", "CREAR", "EDITAR"], "PROPIO"),
      ...grants("CERTIFICADOS", ["VER"], "PROPIO"),
      ...grants("NOTIFICACIONES", ["VER"], "PROPIO"),
    ],
  },
  {
    nombre: "Operador de taller",
    descripcion: "Gestiona el ciclo de las unidades ingresadas al taller.",
    permisos: [
      ...grants("MATAFUEGOS", ["VER", "EDITAR"], "PROPIO"),
      ...grants("SERVICIOS_PRECIOS", ["VER"], "TODAS"),
      ...grants("ORDENES_TRABAJO", ["VER", "EDITAR"], "PROPIO"),
      ...grants("MANTENIMIENTOS", ["VER", "EDITAR"], "PROPIO"),
      // Sin CREAR: el operador de taller no retira unidades del cliente, las
      // recibe (RF-12) — recibir un ingreso a taller no exige ser ya el
      // responsable de custodia (ver ingresarATaller en
      // retiros-entregas/service.ts), así que EDITAR:PROPIO alcanza.
      ...grants("RETIROS_ENTREGAS", ["VER", "EDITAR"], "PROPIO"),
      ...grants("CERTIFICADOS", ["VER"], "PROPIO"),
    ],
  },
  {
    nombre: "Comercial",
    descripcion: "Gestión comercial de clientes, presupuestos y órdenes.",
    permisos: [
      ...grants("CLIENTES", ["VER", "CREAR", "EDITAR"], "TODAS"),
      ...grants("ESTABLECIMIENTOS", ["VER", "CREAR", "EDITAR"], "TODAS"),
      ...grants("SERVICIOS_PRECIOS", ["VER"], "TODAS"),
      ...grants("ORDENES_TRABAJO", ["VER", "CREAR"], "TODAS"),
      ...grants("CERTIFICADOS", ["VER"], "TODAS"),
      ...grants("REPORTES", ["VER"], "TODAS"),
    ],
  },
  {
    nombre: "Facturación",
    descripcion: "Visibilidad de datos comerciales y de precios para emitir comprobantes.",
    permisos: [
      ...grants("CLIENTES", ["VER"], "TODAS"),
      ...grants("ORDENES_TRABAJO", ["VER"], "TODAS"),
      ...grants("CERTIFICADOS", ["VER"], "TODAS"),
      ...grants("SERVICIOS_PRECIOS", ["VER", "EDITAR"], "TODAS"),
      ...grants("REPORTES", ["VER"], "TODAS"),
    ],
  },
  {
    nombre: "Cobranza",
    descripcion: "Seguimiento de cuentas corrientes y cobranza de clientes.",
    permisos: [
      ...grants("CLIENTES", ["VER"], "TODAS"),
      ...grants("ORDENES_TRABAJO", ["VER"], "TODAS"),
      ...grants("REPORTES", ["VER"], "TODAS"),
    ],
  },
  {
    nombre: "Auditor",
    descripcion: "Sólo lectura sobre toda la operación del tenant, para control y cumplimiento.",
    permisos: [
      ...TODOS_LOS_RECURSOS_TENANT.flatMap((recurso) => grants(recurso, ["VER"], "TODAS")),
      ...grants("REPORTES", ["EXPORTAR"], "TODAS"),
    ],
  },
  {
    nombre: "Cliente externo",
    descripcion: "Acceso de autoservicio del cliente a su propia información (portal, RF-22).",
    permisos: [
      ...grants("ESTABLECIMIENTOS", ["VER"], "PROPIO"),
      ...grants("MATAFUEGOS", ["VER"], "PROPIO"),
      ...grants("INSPECCIONES", ["VER"], "PROPIO"),
      ...grants("ORDENES_TRABAJO", ["VER", "APROBAR"], "PROPIO"),
      ...grants("RETIROS_ENTREGAS", ["VER"], "PROPIO"),
      ...grants("CERTIFICADOS", ["VER"], "PROPIO"),
    ],
  },
];

export async function seedDefaultRolesForTenant(tx: TenantTx, tenantId: string): Promise<Map<string, string>> {
  const rolIdByNombre = new Map<string, string>();
  for (const template of DEFAULT_ROLE_TEMPLATES) {
    const rol = await tx.rol.create({
      data: {
        tenantId,
        nombre: template.nombre,
        descripcion: template.descripcion,
        esRolSistema: true,
        permisos: { createMany: { data: template.permisos } },
      },
    });
    rolIdByNombre.set(template.nombre, rol.id);
  }
  return rolIdByNombre;
}
