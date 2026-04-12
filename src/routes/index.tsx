import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Header } from "@/components/Header";
import { SearchPanel, type Filters } from "@/components/SearchPanel";
import { StatsPanel } from "@/components/StatsPanel";
import { ResultsTable } from "@/components/ResultsTable";
import { obrasData } from "@/data/obras";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Buscador de Obras Públicas — FOGOP Corrientes" },
      { name: "description", content: "Sistema de consulta y estadísticas de obras públicas municipales gestionadas por el FOGOP de la Municipalidad de Corrientes." },
      { property: "og:title", content: "Buscador de Obras Públicas — FOGOP Corrientes" },
      { property: "og:description", content: "Consulta el estado de las obras públicas municipales de Corrientes." },
    ],
  }),
  component: HomePage,
});

const emptyFilters: Filters = {
  tipoObra: "",
  estado: "",
  expteMadre: "",
  expteHijo: "",
  direccion: "",
  anio: "",
};

function HomePage() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);

  const results = useMemo(() => {
    const f = appliedFilters;
    return obrasData.filter((o) => {
      if (f.tipoObra && o.tipoObra !== f.tipoObra) return false;
      if (f.estado && o.estado !== f.estado) return false;
      if (f.anio && o.anio !== f.anio) return false;
      if (f.expteMadre && !o.expteMadre.toLowerCase().includes(f.expteMadre.toLowerCase())) return false;
      if (f.expteHijo && !o.expteHijo.toLowerCase().includes(f.expteHijo.toLowerCase())) return false;
      if (f.direccion && !o.direccion.toLowerCase().includes(f.direccion.toLowerCase())) return false;
      return true;
    });
  }, [appliedFilters]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <SearchPanel
        filters={filters}
        onChange={setFilters}
        onSearch={() => setAppliedFilters(filters)}
        onClear={() => {
          setFilters(emptyFilters);
          setAppliedFilters(emptyFilters);
        }}
      />
      <StatsPanel results={results} />
      <ResultsTable results={results} />
    </div>
  );
}
