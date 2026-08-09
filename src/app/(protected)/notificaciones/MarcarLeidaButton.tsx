"use client";

import { ActionButton } from "../_components/ActionButton";

export function MarcarLeidaButton({ id }: { id: string }) {
  return <ActionButton label="Marcar leída" displayLabel="Leída" url={`/api/notificaciones/${id}/leida`} size="sm" />;
}
