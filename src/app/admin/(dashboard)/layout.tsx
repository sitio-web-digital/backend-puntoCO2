import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { withTenant } from "@/server/db/with-tenant";
import { SuperAdminShell } from "./_components/SuperAdminShell";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !user.esSuperAdminSaas) {
    redirect("/admin/login");
  }

  const perfil = await withTenant({ tenantId: null, bypassRls: true }, (tx) =>
    tx.usuario.findUnique({ where: { id: user.usuarioId }, select: { nombre: true, apellido: true } }),
  );

  return (
    <SuperAdminShell nombre={perfil?.nombre ?? "Super"} apellido={perfil?.apellido ?? "Admin"}>
      {children}
    </SuperAdminShell>
  );
}
