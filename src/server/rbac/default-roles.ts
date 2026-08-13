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
 * Catálogo deliberadamente chico (3 roles, no una matriz de puestos por
 * departamento): el cliente final de esta SaaS es una empresa pequeña, no
 * técnica, y elegir entre 9 roles al dar de alta un empleado era fricción
 * sin beneficio real (nunca hubo pantalla para crear/editar roles custom).
 * Administrador cubre todo lo comercial/administrativo que antes tenían
 * Comercial/Facturación/Cobranza/Auditor por separado. Técnico une a los
 * tres roles de campo/taller anteriores, siempre con alcance PROPIO (nunca
 * TODAS salvo VER de servicios/precios) — las aprobaciones quedan
 * reservadas a Administrador para no auto-aprobar el propio trabajo.
 */
export const DEFAULT_ROLE_TEMPLATES: RoleTemplate[] = [
  {
    nombre: "Administrador de empresa",
    descripcion: "Control total sobre los datos y usuarios del tenant. No administra el plan/suscripción de la plataforma.",
    permisos: TODOS_LOS_RECURSOS_TENANT.flatMap((recurso) => grants(recurso, TODAS_LAS_ACCIONES, "TODAS")),
  },
  {
    nombre: "Técnico",
    descripcion: "Ejecuta inspecciones, mantenimientos, retiros/entregas y emite certificados sobre lo que tiene asignado.",
    permisos: [
      ...grants("CLIENTES", ["VER"], "ESTABLECIMIENTO_ASIGNADO"),
      ...grants("ESTABLECIMIENTOS", ["VER"], "ESTABLECIMIENTO_ASIGNADO"),
      ...grants("MATAFUEGOS", ["VER"], "ESTABLECIMIENTO_ASIGNADO"),
      ...grants("MATAFUEGOS", ["CREAR", "EDITAR"], "PROPIO"),
      ...grants("INSPECCIONES", ["VER", "CREAR", "EDITAR"], "PROPIO"),
      ...grants("NO_CONFORMIDADES", ["VER", "CREAR", "EDITAR"], "PROPIO"),
      ...grants("MANTENIMIENTOS", ["VER", "CREAR", "EDITAR"], "PROPIO"),
      // VER:TODAS sobre el catálogo de servicios (no PROPIO: no hay noción de
      // "servicio propio") — sin esto, un técnico no podría ver qué
      // servicio/precio corresponde al ítem que agrega a su propia orden
      // asignada (RF-11), aunque tenga EDITAR:PROPIO sobre ORDENES_TRABAJO.
      ...grants("SERVICIOS_PRECIOS", ["VER"], "TODAS"),
      ...grants("ORDENES_TRABAJO", ["VER", "CREAR", "EDITAR"], "PROPIO"),
      ...grants("RETIROS_ENTREGAS", ["VER", "CREAR", "EDITAR"], "PROPIO"),
      // CREAR/EMITIR certificados (no sólo VER): un técnico tiene que poder
      // emitir el certificado de su propia inspección sin depender de que
      // el administrador lo haga por él en cada caso.
      ...grants("CERTIFICADOS", ["VER", "CREAR", "EMITIR"], "PROPIO"),
      ...grants("NOTIFICACIONES", ["VER"], "PROPIO"),
      ...grants("REPORTES", ["VER"], "PROPIO"),
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
