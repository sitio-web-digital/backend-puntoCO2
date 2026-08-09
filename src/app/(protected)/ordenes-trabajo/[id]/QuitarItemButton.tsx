"use client";

import { ActionButton } from "../../_components/ActionButton";

export function QuitarItemButton({ ordenId, itemId }: { ordenId: string; itemId: string }) {
  return (
    <ActionButton
      label="Quitar"
      url={`/api/ordenes-trabajo/${ordenId}/items/${itemId}`}
      method="DELETE"
      confirmar="¿Quitar este ítem de la orden?"
      variant="danger"
      size="sm"
    />
  );
}
