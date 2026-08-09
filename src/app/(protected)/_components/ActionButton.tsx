"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ActionButtonProps {
  label: string;
  url: string;
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  /** Si se define, se pide un texto libre antes de confirmar (ej. motivo de cancelación) y se manda como `{ [pedirMotivoComo]: texto }`. */
  pedirMotivoComo?: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "md" | "sm";
  confirmar?: string;
  onDone?: (data: unknown) => void;
  /** Texto corto a mostrar en el botón cuando `label` es muy largo para el tamaño compacto; `label` completo queda como tooltip (`title`). */
  displayLabel?: string;
}

export function ActionButton({
  label,
  url,
  method = "POST",
  body,
  pedirMotivoComo,
  variant = "secondary",
  size = "md",
  confirmar,
  onDone,
  displayLabel,
}: ActionButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);

    let payload = body;
    if (pedirMotivoComo) {
      const motivo = window.prompt(`Motivo (${label}):`);
      if (motivo === null) return;
      payload = { ...(body ?? {}), [pedirMotivoComo]: motivo };
    }
    if (confirmar && !window.confirm(confirmar)) return;

    setLoading(true);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message ?? "No se pudo completar la acción.");
        return;
      }
      onDone?.(data);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  const variantClass = variant === "primary" ? "btn-primary" : variant === "danger" ? "btn-danger" : "btn-secondary";
  const className = size === "sm" ? `${variantClass} btn-sm` : variantClass;

  return (
    <span className="stack" style={{ gap: 4, display: "inline-flex", flexDirection: "column" }}>
      <button type="button" className={className} onClick={handleClick} disabled={loading} title={displayLabel ? label : undefined}>
        {loading ? "..." : (displayLabel ?? label)}
      </button>
      {error ? <span className="error">{error}</span> : null}
    </span>
  );
}
