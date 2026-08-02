import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Matafuego SaaS",
  description: "Gestión integral de matafuegos: inspección, mantenimiento, certificación y facturación.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
