"use client";

import { ActionButton } from "../_components/ActionButton";

export function CambiarEstadoUsuario({ usuarioId, estadoActual, esPropio }: { usuarioId: string; estadoActual: string; esPropio: boolean }) {
  if (esPropio) return null;

  if (estadoActual === "ACTIVO") {
    return (
      <ActionButton
        label="Suspender"
        url={`/api/usuarios/${usuarioId}`}
        method="PATCH"
        body={{ estado: "SUSPENDIDO" }}
        confirmar="¿Suspender a este usuario? No va a poder iniciar sesión."
        size="sm"
      />
    );
  }

  return (
    <ActionButton label="Reactivar" url={`/api/usuarios/${usuarioId}`} method="PATCH" body={{ estado: "ACTIVO" }} variant="primary" size="sm" />
  );
}
