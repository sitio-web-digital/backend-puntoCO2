"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Panel lateral que entra desde la derecha, usado para las altas ("+ Nuevo X")
 * en vez de un formulario inline: no empuja el contenido de la página y deja
 * la tabla de fondo visible/atenuada detrás del overlay.
 */
export function Drawer({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <>
      {open ? <div className="drawer-overlay" onClick={onClose} /> : null}
      <aside className={`drawer${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="drawer-header">
          <h2>{title}</h2>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Cerrar">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
}
