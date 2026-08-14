"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QrScanner from "qr-scanner";

// Deprecated en la librería, pero sigue siendo la forma de indicarle dónde
// está el worker cuando no hay BarcodeDetector nativo (Safari/iOS) — el
// archivo lo deja en public/ el postinstall (scripts/copy-qr-worker.js).
QrScanner.WORKER_PATH = "/qr-scanner-worker.min.js";

/** La etiqueta impresa codifica la URL pública completa
 * (`${origin}/qr/{token}`, ver src/server/qr/render.ts) — se extrae el
 * token de esa URL. Si en algún momento se escaneara un token suelto (sin
 * URL), también funciona. */
function extraerToken(texto: string): string | null {
  try {
    const url = new URL(texto);
    const match = url.pathname.match(/\/qr\/([^/]+)/);
    if (match?.[1]) return match[1];
  } catch {
    // No era una URL: seguir con el texto tal cual.
  }
  const token = texto.trim();
  return token.length > 0 ? token : null;
}

export default function EscanearPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [resolviendo, setResolviendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let cancelado = false;

    async function manejarResultado(result: { data: string }) {
      if (cancelado) return;
      const token = extraerToken(result.data);
      if (!token) return;

      scannerRef.current?.pause();
      setResolviendo(true);
      setError(null);
      try {
        const response = await fetch(`/api/qr/resolver?token=${encodeURIComponent(token)}`);
        const data = await response.json();
        if (cancelado) return;
        if (!response.ok) {
          setError(data.message ?? "No se pudo identificar esa unidad.");
          setResolviendo(false);
          return;
        }
        router.push(`/matafuegos/${data.matafuegoId}`);
      } catch {
        if (!cancelado) {
          setError("No se pudo conectar con el servidor.");
          setResolviendo(false);
        }
      }
    }

    const scanner = new QrScanner(video, manejarResultado, {
      preferredCamera: "environment",
      highlightScanRegion: true,
      highlightCodeOutline: true,
    });
    scannerRef.current = scanner;

    scanner.start().catch(() => {
      if (!cancelado) setError("No se pudo acceder a la cámara. Revisá los permisos del navegador.");
    });

    return () => {
      cancelado = true;
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [router]);

  function reintentar() {
    setError(null);
    setResolviendo(false);
    scannerRef.current?.start().catch(() => setError("No se pudo acceder a la cámara. Revisá los permisos del navegador."));
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="stack" style={{ gap: 5 }}>
        <h1>Escanear matafuego</h1>
        <p className="muted">Apuntá la cámara al código QR de la etiqueta para ir directo a la ficha de esa unidad.</p>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden", maxWidth: 480 }}>
        <video ref={videoRef} style={{ width: "100%", display: "block", background: "#000" }} muted playsInline />
      </div>

      {resolviendo ? <p className="muted">Buscando la unidad...</p> : null}

      {error ? (
        <div className="stack" style={{ gap: 8 }}>
          <p className="error">{error}</p>
          <button type="button" className="btn-secondary" onClick={reintentar} style={{ width: "fit-content" }}>
            Reintentar
          </button>
        </div>
      ) : null}
    </div>
  );
}
