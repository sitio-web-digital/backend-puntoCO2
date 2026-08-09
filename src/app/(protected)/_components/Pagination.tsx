import Link from "next/link";

/**
 * Controles de paginación server-driven: cada página es un `<Link>` a
 * `?page=N` (preservando el resto de los query params), sin JS en el cliente.
 * `basePath` es la ruta de la página actual (ej. "/clientes").
 *
 * `pageParam` permite usar un nombre de query param distinto de "page" cuando
 * una misma página tiene más de un listado paginado en simultáneo (ej.
 * "/servicios" con catálogo + listas de precio): cada `<Pagination>` usa su
 * propio param (`serviciosPage`, `listasPage`, ...) preservando el del otro.
 */
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  basePath,
  pageParam = "page",
  searchParams,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  basePath: string;
  pageParam?: string;
  searchParams?: Record<string, string | undefined>;
}) {
  if (total === 0) return null;

  function hrefFor(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ?? {})) {
      if (value !== undefined && key !== pageParam) params.set(key, value);
    }
    params.set(pageParam, String(target));
    return `${basePath}?${params.toString()}`;
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pageNumbers = pagesToShow(page, totalPages);

  return (
    <div className="pagination">
      <span className="pagination-info">
        {from}–{to} de {total}
      </span>
      <div className="pagination-controls">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className="pagination-btn">
            ‹
          </Link>
        ) : (
          <span className="pagination-btn" aria-disabled="true" style={{ opacity: 0.4, cursor: "not-allowed" }}>
            ‹
          </span>
        )}
        {pageNumbers.map((n, i) =>
          n === "…" ? (
            <span key={`ellipsis-${i}`} className="pagination-info" style={{ padding: "0 4px" }}>
              …
            </span>
          ) : (
            <Link key={n} href={hrefFor(n)} className={`pagination-btn${n === page ? " active" : ""}`}>
              {n}
            </Link>
          ),
        )}
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} className="pagination-btn">
            ›
          </Link>
        ) : (
          <span className="pagination-btn" aria-disabled="true" style={{ opacity: 0.4, cursor: "not-allowed" }}>
            ›
          </span>
        )}
      </div>
    </div>
  );
}

function pagesToShow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result: (number | "…")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("…");
    result.push(p);
    prev = p;
  }
  return result;
}
