import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { getOwnProfile, getTenantSlug } from "@/server/usuarios/own-profile";
import { AppShell } from "./_components/AppShell";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) {
    redirect("/login");
  }

  const [profile, tenantSlug] = await Promise.all([
    getOwnProfile(user.tenantId, user.usuarioId),
    getTenantSlug(user.tenantId),
  ]);

  return (
    <AppShell user={profile} tenantSlug={tenantSlug}>
      {children}
    </AppShell>
  );
}
