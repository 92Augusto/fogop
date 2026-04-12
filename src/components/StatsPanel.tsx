import type { Obra } from "@/data/obras";

interface Props {
  results: Obra[];
}

export function StatsPanel({ results }: Props) {
  const total = results.length;
  const ejecutadas = results.filter((o) =>
    ["Ejecutado", "Ejecutado FOGOP", "Ejecutado Infra", "Liquidado"].includes(o.estado)
  ).length;
  const enProceso = results.filter((o) =>
    ["Proceso de aprobación", "Pendiente de realización"].includes(o.estado)
  ).length;
  const tiposUnicos = new Set(results.map((o) => o.tipoObra)).size;
  const totalPuntos = results.reduce((s, o) => s + (o.puntos || 0), 0);

  // Group by tipo
  const byTipo = Object.entries(
    results.reduce<Record<string, { count: number; puntos: number }>>((acc, o) => {
      if (!acc[o.tipoObra]) acc[o.tipoObra] = { count: 0, puntos: 0 };
      acc[o.tipoObra].count++;
      acc[o.tipoObra].puntos += o.puntos || 0;
      return acc;
    }, {})
  ).sort((a, b) => b[1].count - a[1].count);

  // Group by estado
  const byEstado = Object.entries(
    results.reduce<Record<string, { count: number; puntos: number }>>((acc, o) => {
      if (!acc[o.estado]) acc[o.estado] = { count: 0, puntos: 0 };
      acc[o.estado].count++;
      acc[o.estado].puntos += o.puntos || 0;
      return acc;
    }, {})
  ).sort((a, b) => b[1].count - a[1].count);

  const maxTipo = Math.max(...byTipo.map(([, v]) => v.count), 1);
  const maxEstado = Math.max(...byEstado.map(([, v]) => v.count), 1);

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KPICard label="Total de Obras" value={total} />
        <KPICard label="Ejecutadas / Liquidadas" value={ejecutadas} />
        <KPICard label="En Proceso / Pendiente" value={enProceso} />
        <KPICard label="Tipos de Obra" value={tiposUnicos} />
        <KPICard label="Puntos Lumínicos / Cámaras" value={totalPuntos.toLocaleString("es-AR")} />
      </div>

      {/* Detail bars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Por Tipo de Obra</h3>
          {byTipo.map(([name, val]) => (
            <BarRow key={name} label={name} count={val.count} puntos={val.puntos} max={maxTipo} />
          ))}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Por Estado</h3>
          {byEstado.map(([name, val]) => (
            <BarRow key={name} label={name} count={val.count} puntos={val.puntos} max={maxEstado} />
          ))}
        </div>
      </div>
    </section>
  );
}

function KPICard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center shadow-sm">
      <div className="text-2xl font-bold text-primary">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function BarRow({ label, count, puntos, max }: { label: string; count: number; puntos: number; max: number }) {
  const pct = (count / max) * 100;
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-xs">
        <span className="truncate text-foreground">{label}</span>
        <span className="ml-2 shrink-0 text-muted-foreground">
          {count} obras{puntos > 0 ? ` · ${puntos} pts` : ""}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-stat-bar transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
