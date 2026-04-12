import { TIPOS_OBRA, ESTADOS_OBRA, ANIOS } from "@/data/obras";
import type { TipoObra, EstadoObra } from "@/data/obras";
import heroBg from "@/assets/hero-bg.jpg";

export interface Filters {
  tipoObra: TipoObra | "";
  estado: EstadoObra | "";
  expteMadre: string;
  expteHijo: string;
  direccion: string;
  anio: number | "";
}

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  onSearch: () => void;
  onClear: () => void;
}

export function SearchPanel({ filters, onChange, onSearch, onClear }: Props) {
  const set = (key: keyof Filters, value: string | number) =>
    onChange({ ...filters, [key]: value });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onSearch();
  };

  return (
    <section
      className="relative bg-cover bg-center"
      style={{ backgroundImage: `url(${heroBg})` }}
    >
      <div className="absolute inset-0 bg-primary-foreground/80" />
      <div className="relative mx-auto max-w-7xl px-4 py-8">
        <h2 className="mb-4 text-center text-xl font-semibold text-foreground">
          Buscador de Obras
        </h2>
        <div className="rounded-lg border bg-card p-4 shadow-sm" onKeyDown={handleKeyDown}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo de Obra</label>
              <select
                value={filters.tipoObra}
                onChange={(e) => set("tipoObra", e.target.value)}
                className="w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value="">Todos</option>
                {TIPOS_OBRA.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Estado</label>
              <select
                value={filters.estado}
                onChange={(e) => set("estado", e.target.value)}
                className="w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value="">Todos</option>
                {ESTADOS_OBRA.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nº Expte. Madre</label>
              <input
                type="text"
                placeholder="Ej: 226-V-2025"
                value={filters.expteMadre}
                onChange={(e) => set("expteMadre", e.target.value)}
                className="w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Nº Expte. Hijo</label>
              <input
                type="text"
                placeholder="Ej: 7944-S-2025"
                value={filters.expteHijo}
                onChange={(e) => set("expteHijo", e.target.value)}
                className="w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Dirección / Barrio</label>
              <input
                type="text"
                placeholder="Ej: Barrio Centro"
                value={filters.direccion}
                onChange={(e) => set("direccion", e.target.value)}
                className="w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Año</label>
              <select
                value={filters.anio}
                onChange={(e) => set("anio", e.target.value ? Number(e.target.value) : "")}
                className="w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value="">Todos</option>
                {ANIOS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={onSearch}
              className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent"
            >
              Buscar
            </button>
            <button
              onClick={onClear}
              className="rounded-md border bg-card px-6 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
