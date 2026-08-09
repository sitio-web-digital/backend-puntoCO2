"use client";

import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";

export interface AccordionHandle {
  close: () => void;
}

/**
 * Panel colapsable "+ Nuevo X" usado en la mayoría de los listados. Usa
 * <details>/<summary> nativo (igual que el diseño de referencia) en vez de
 * estado de React, así que los formularios que envuelve sólo necesitan un
 * ref para cerrarlo tras un submit exitoso.
 */
export const Accordion = forwardRef<AccordionHandle, { summary: string; children: ReactNode }>(function Accordion(
  { summary, children },
  ref,
) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useImperativeHandle(ref, () => ({
    close: () => {
      if (detailsRef.current) detailsRef.current.open = false;
    },
  }));

  return (
    <details className="accordion-card" ref={detailsRef}>
      <summary className="accordion-summary">
        <span className="accordion-icon">+</span>
        {summary}
      </summary>
      <div className="accordion-body">{children}</div>
    </details>
  );
});
