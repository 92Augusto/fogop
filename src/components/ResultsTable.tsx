import { useState } from "react";
import type { Obra, EstadoObra } from "@/data/obras";

const PAGE_SIZE = 20;

const estadoBadgeClass: Record<EstadoObra, string> = {
  "Proceso de aprobación": "bg-badge-proceso-bg text-badge-proceso-fg",
  "Pendiente de realización": "bg-badge-pendiente-bg text-badge-pendiente-fg",
  "Liquidado": "bg-badge-liquidado-bg text-badge-liquidado-fg",
  "Ejecutado FOGOP": "bg-badge-fogop-bg text-badge-fogop-fg",
  "Ejecutado Infra": "bg-badge-infra-bg text-badge-infra-fg",
  "Ejecutado": "bg-badge-ejecutado-bg text-badge-ejecutado-fg",
};

interface Props {
  results: Obra[];
}

export function ResultsTable({ results }: Props) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const slice = results.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  // Reset to page 0 when results change
  if (page >= totalPages && page > 0) setPage(0);

  return (
    <section className="mx-auto max-w-7xl px-4 pb-8">
      <div className="mb-3 text-sm text-muted-foreground">
        {results.length} resultado{results.length !== 1 ? "s" : ""} encontrado{results.length !== 1 ? "s" : ""}
      </div>

      {results.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          No se encontraron obras con los filtros seleccionados.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="whitespace-nowrap px-3 py-2 font-medium text-foreground">Acta</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium text-foreground">Año</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium text-foreground">Fecha</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium text-foreground">Expte. Madre</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium text-foreground">Expte. Hijo</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium text-foreground">Tipo de Obra</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium text-foreground">Dirección</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium text-foreground">Puntos</th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium text-foreground">Estado</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="whitespace-nowrap px-3 py-2 text-foreground">{o.acta || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-foreground">{o.anio}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-foreground">{o.fecha || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-foreground">{o.expteMadre}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-foreground">{o.expteHijo || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-foreground">{o.tipoObra}</td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-foreground" title={o.direccion}>{o.direccion}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-foreground">{o.puntos || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoBadgeClass[o.estado] || ""}`}>
                        {o.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-1">
              <button
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
                className="rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    i === currentPage
                      ? "bg-primary text-primary-foreground"
                      : "border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                disabled={currentPage === totalPages - 1}
                onClick={() => setPage(currentPage + 1)}
                className="rounded-md border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
