"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { OwnProfile } from "@/server/usuarios/own-profile";

interface NavLink {
  href: string;
  label: string;
}

interface NavGroup {
  label: string;
  links: NavLink[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operación",
    links: [
      { href: "/clientes", label: "Clientes" },
      { href: "/matafuegos", label: "Matafuegos" },
      { href: "/no-conformidades", label: "Observaciones" },
      { href: "/mantenimientos", label: "Mantenimientos" },
    ],
  },
  {
    label: "Trabajo",
    links: [
      { href: "/ordenes-trabajo", label: "Órdenes de trabajo" },
      { href: "/retiros-entregas", label: "Retiros y entregas" },
      { href: "/servicios", label: "Servicios y precios" },
    ],
  },
  {
    label: "Documentación",
    links: [
      { href: "/certificados", label: "Certificados" },
      { href: "/notificaciones", label: "Notificaciones" },
      { href: "/reportes", label: "Reportes" },
    ],
  },
  {
    label: "Administración",
    links: [{ href: "/usuarios", label: "Usuarios" }],
  },
];

const THEME_ORDER = ["Automático", "Claro", "Oscuro"] as const;
type Theme = (typeof THEME_ORDER)[number];

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "Claro") root.setAttribute("data-theme", "light");
  else if (theme === "Oscuro") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
}

function initials(nombre: string, apellido: string) {
  return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "Claro") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v2.5M12 19.5V22M4.22 4.22l1.77 1.77M18.01 18.01l1.77 1.77M2 12h2.5M19.5 12H22M4.22 19.78l1.77-1.77M18.01 5.99l1.77-1.77" />
      </svg>
    );
  }
  if (theme === "Oscuro") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M21.5 14.5A9.5 9.5 0 1 1 9.5 2.5a7.5 7.5 0 0 0 12 12Z" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "Automático";
  const stored = window.localStorage.getItem("theme");
  if (stored === "Claro" || stored === "Oscuro" || stored === "Automático") return stored;
  return "Automático";
}

export function AppShell({ user, tenantSlug, children }: { user: OwnProfile | null; tenantSlug: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  // Cierra el drawer mobile al cambiar de ruta, ajustando el estado durante
  // el render (patrón recomendado por React) en vez de en un efecto, para
  // no encadenar un render extra por cada navegación.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setNavOpen(false);
  }

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  const activeGroup = NAV_GROUPS.find((group) => group.links.some((link) => pathname.startsWith(link.href)));
  const activeLink = activeGroup?.links.find((link) => pathname.startsWith(link.href));
  const pageTitle = activeLink?.label ?? "Matafuego SaaS";

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">M</div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">Matafuego SaaS</span>
            <span className="sidebar-brand-slug">{tenantSlug}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group) => (
            <div className="sidebar-nav-group" key={group.label}>
              <div className="sidebar-group-label">{group.label}</div>
              {group.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`sidebar-link${pathname.startsWith(link.href) ? " active" : ""}`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {user ? (
            <div className="sidebar-user">
              <div className="sidebar-avatar">{initials(user.nombre, user.apellido)}</div>
              <div className="sidebar-user-text">
                <span className="sidebar-user-name">
                  {user.nombre} {user.apellido}
                </span>
                <span className="sidebar-user-role">{user.roles[0] ?? "Sin rol asignado"}</span>
              </div>
            </div>
          ) : null}
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
          <span className="app-header-title">{pageTitle}</span>
          <div style={{ flex: 1 }} />
          <Link href="/escanear" className="theme-toggle" title="Escanear QR" aria-label="Escanear QR de un matafuego">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V4.5A1.5 1.5 0 0 1 4.5 3H7M17 3h2.5A1.5 1.5 0 0 1 21 4.5V7M21 17v2.5a1.5 1.5 0 0 1-1.5 1.5H17M7 21H4.5A1.5 1.5 0 0 1 3 19.5V17M3 12h18" />
            </svg>
          </Link>
          <button
            type="button"
            className="theme-toggle"
            title={`Tema: ${theme}`}
            aria-label={`Cambiar tema (actual: ${theme})`}
            onClick={() => {
              const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length] ?? "Automático";
              setTheme(next);
            }}
          >
            <ThemeIcon theme={theme} />
          </button>
        </header>

        <main className="page">{children}</main>
      </div>
    </div>
  );
}
