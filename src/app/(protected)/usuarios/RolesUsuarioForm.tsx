"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface RolOption {
  id: string;
  nombre: string;
}

export function RolesUsuarioForm({ usuarioId, roles, rolesActuales }: { usuarioId: string; roles: RolOption[]; rolesActuales: string[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [rolIds, setRolIds] = useState<string[]>(rolesActuales);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleRol(id: string) {
    setRolIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  async function guardar() {
    setError(null);
    if (rolIds.length === 0) {
      setError("Debe quedar al menos un rol asignado.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/usuarios/${usuarioId}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rolIds }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "No se pudo actualizar los roles.");
        return;
      }
      setAbierto(false);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (!abierto) {
    return (
      <button type="button" className="btn-secondary btn-sm" onClick={() => setAbierto(true)}>
        Roles
      </button>
    );
  }

  return (
    <div className="card" style={{ padding: 14, minWidth: 220 }}>
      <div className="stack" style={{ gap: 8 }}>
        {roles.map((rol) => (
          <label key={rol.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={rolIds.includes(rol.id)} onChange={() => toggleRol(rol.id)} style={{ width: 15, height: 15, accentColor: "var(--acc)" }} />
            {rol.nombre}
          </label>
        ))}
        {error ? <span className="error">{error}</span> : null}
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn-primary btn-sm" onClick={guardar} disabled={loading}>
            {loading ? "..." : "Guardar"}
          </button>
          <button type="button" className="btn-link" onClick={() => setAbierto(false)}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
