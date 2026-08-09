"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Red de seguridad para toda la app protegida: sin esto, cualquier excepción
 * sin capturar durante el render de una página (por ejemplo un ForbiddenError
 * de un usuario navegando a una sección para la que no tiene permiso) tira un
 * 500 crudo de Next.js en vez de un mensaje entendible.
 */
export default function ProtectedError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const esPermiso = error.name === "ForbiddenError" || /Permiso denegado/i.test(error.message);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card stack" style={{ gap: 12, maxWidth: 480, margin: "40px auto" }}>
      <h1 style={{ fontSize: 20 }}>{esPermiso ? "No tenés permiso para ver esta sección" : "Ocurrió un error inesperado"}</h1>
      <p className="muted" style={{ margin: 0 }}>
        {esPermiso
          ? "Tu usuario no tiene el rol necesario para acceder acá. Si creés que deberías tenerlo, pedile a un administrador de tu empresa que revise tus roles."
          : "Algo falló al cargar esta página. Podés reintentar o volver al inicio."}
      </p>
      <div className="row" style={{ gap: 10 }}>
        {esPermiso ? null : (
          <button type="button" className="btn-secondary" onClick={() => reset()}>
            Reintentar
          </button>
        )}
        <Link href="/clientes" className="btn-primary" style={{ display: "inline-flex", alignItems: "center" }}>
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
