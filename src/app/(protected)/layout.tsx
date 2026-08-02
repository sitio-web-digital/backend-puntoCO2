import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { LogoutButton } from "./LogoutButton";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) {
    redirect("/login");
  }

  return (
    <div>
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="row" style={{ gap: 24 }}>
            <strong>Matafuego SaaS</strong>
            <div className="nav-links">
              <Link href="/clientes">Clientes</Link>
              <Link href="/matafuegos">Matafuegos</Link>
            </div>
          </div>
          <LogoutButton />
        </div>
      </nav>
      <div className="page">{children}</div>
    </div>
  );
}
