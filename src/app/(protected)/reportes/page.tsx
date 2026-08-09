import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current-user";
import { ReportesExplorer } from "./ReportesExplorer";

export default async function ReportesPage() {
  const user = await getCurrentUser();
  if (!user || !user.tenantId) redirect("/login");

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 6 }}>
        <h1>Reportes e indicadores</h1>
        <p className="muted" style={{ maxWidth: "80ch" }}>
          Exportación disponible en JSON (vista) y CSV para los reportes tabulares. La exportación a PDF queda pendiente: requiere sumar
          una librería de renderizado que todavía no está definida.
        </p>
      </div>
      <ReportesExplorer />
    </div>
  );
}
