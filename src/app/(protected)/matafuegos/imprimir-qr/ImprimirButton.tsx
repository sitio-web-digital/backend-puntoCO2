"use client";

export function ImprimirButton() {
  return (
    <button type="button" className="btn-primary no-print" onClick={() => window.print()}>
      Imprimir / Guardar como PDF
    </button>
  );
}
