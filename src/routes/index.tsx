import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { LoginPage } from "@/components/LoginPage";
import { Header } from "@/components/Header";
import { SearchPanel, type Filters } from "@/components/SearchPanel";
import { StatsPanel } from "@/components/StatsPanel";
import { ResultsTable } from "@/components/ResultsTable";
import { AdminPanel } from "@/components/AdminPanel";
import { Veredas } from "@/components/Veredas";
import { Relevamientos } from "@/components/Relevamientos";
import { obrasData } from "@/data/obras-data";
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
type MainTab = "obras" | "veredas" | "relevamientos";
function HomePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<MainTab>("obras");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
  const [showAdmin, setShowAdmin] = useState(false);
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
  if (!user) return <LoginPage />;
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased">
      <Header onOpenAdmin={() => setShowAdmin(true)} />
      {/* Navegación de tabs responsiva y sticky */}
      <div className="sticky top-0 z-40 border-b bg-glass/95 backdrop-blur-md premium-shadow">
        <div className="mx-auto max-w-[1600px] px-4 md:px-8">
          <div className="flex gap-2 overflow-x-auto custom-scrollbar whitespace-nowrap py-1 scroll-smooth">
            {(["obras", "veredas", "relevamientos"] as MainTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-5 py-3.5 text-sm font-semibold capitalize transition-all duration-200 border-b-2 relative shrink-0 ${
                  activeTab === t
                    ? "border-blue-600 text-blue-600 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {t === "obras" ? "Obras" : t === "veredas" ? "Veredas" : "Relevamientos"}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Contenido según tab activo */}
      <main className="mx-auto max-w-[1600px] px-4 md:px-8 py-6">
        {activeTab === "obras" && (
          <div className="space-y-6">
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
        )}
        {activeTab === "veredas" && (
          <div className="animate-fade-in">
            <Veredas />
          </div>
        )}
        {activeTab === "relevamientos" && (
          <div className="animate-fade-in">
            <Relevamientos />
          </div>
        )}
      </main>
      {showAdmin && user.role === "admin" && (
        <AdminPanel onClose={() => setShowAdmin(false)} />
      )}
    </div>
  );
}
