"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

const NAV_LINKS = [
  { href: "/admin", label: "Resumen", exact: true },
  { href: "/admin/empresas", label: "Empresas" },
  { href: "/admin/soporte", label: "Soporte" },
];

export function SuperAdminShell({ nombre, apellido, children }: { nombre: string; apellido: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setNavOpen(false);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">M</div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">Matafuego SaaS</span>
            <span className="sidebar-brand-slug">plataforma</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-nav-group">
            <div className="sidebar-group-label">Plataforma</div>
            {NAV_LINKS.map((link) => {
              const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
              return (
                <Link key={link.href} href={link.href} className={`sidebar-link${active ? " active" : ""}`}>
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{`${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase()}</div>
            <div className="sidebar-user-text">
              <span className="sidebar-user-name">
                {nombre} {apellido}
              </span>
              <span className="sidebar-user-role">Superadministrador</span>
            </div>
          </div>
          <button type="button" className="sidebar-logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {navOpen ? <div className="nav-overlay" onClick={() => setNavOpen(false)} /> : null}

      <div className="app-main">
        <header className="app-header">
          <button type="button" className="burger" aria-label="Abrir menú" onClick={() => setNavOpen(true)}>
            <span />
            <span />
            <span />
          </button>
          <span className="app-header-title">Panel de la plataforma</span>
        </header>

        <main className="page">{children}</main>
      </div>
    </div>
  );
}
