import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Matafuego SaaS",
  description: "Gestión integral de matafuegos: inspección, mantenimiento, certificación y facturación.",
};

// Aplica el tema guardado antes del primer paint para evitar el flash de
// tema por defecto cuando el usuario eligió explícitamente Claro/Oscuro
// (Automático no necesita esto: lo resuelve @media prefers-color-scheme).
const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='Claro'){document.documentElement.setAttribute('data-theme','light');}else if(t==='Oscuro'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
