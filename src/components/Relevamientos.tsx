import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, orderBy, query, serverTimestamp, Timestamp, writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import { exportRelevamientosToPdf } from "@/lib/pdf-export";
import { PasswordPromptDialog } from "@/components/PasswordPromptDialog";

export interface Relevamiento {
  id?: string;
  calle: string;
  altura: string;
  obra: string;
  observaciones: string;
  cargadoPor: string;
  creadoEn: Timestamp | null;
}

const emptyForm = {
  calle: "",
  altura: "",
  obra: "",
  observaciones: "",
};

// ─── Obras canónicas ───────────────────────────────────────────────────────────
const OBRAS_OPCIONES = ["Vereda", "Led", "Videovigilancia", "Pavimento"] as const;

/** Normaliza cualquier variante de nombre de obra al valor canónico */
function normalizarObra(obra: string): string {
  const lower = obra.trim().toLowerCase();
  if (lower === "vereda" || lower === "veredas") return "Vereda";
  if (lower === "led") return "Led";
  if (lower === "videovigilancia" || lower === "video vigilancia") return "Videovigilancia";
  if (lower === "pavimento" || lower === "pavimentacion" || lower === "pavimentación") return "Pavimento";
  // Devuelve el valor original si no matchea ninguna canónica
  return obra.trim();
}

function formatFecha(ts: Timestamp | null): string {
  if (!ts) return "—";
  return ts.toDate().toLocaleDateString("es-AR") + " " + ts.toDate().toLocaleTimeString("es-AR", { hour: '2-digit', minute: '2-digit' });
}

// ─── Parsear Excel ────────────────────────────────────────────────────────────
function parsearExcelRelevamientos(
  buffer: ArrayBuffer
): Omit<Relevamiento, "id" | "cargadoPor" | "creadoEn">[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  return rows
    .map((r) => {
      const get = (keys: string[]): string => {
        for (const k of Object.keys(r)) {
          if (keys.some((kk) => k.trim().toUpperCase().includes(kk.toUpperCase()))) {
            const v = r[k];
            return v !== undefined && v !== null ? String(v).trim() : "";
          }
        }
        return "";
      };

      const calle = get(["CALLE"]);
      const obra  = get(["OBRA"]);
      if (!calle && !obra) return null;

      return {
        calle,
        altura:        get(["ALTURA"]),
        obra,
        observaciones: get(["OBSERV"]),
      };
    })
    .filter(Boolean) as Omit<Relevamiento, "id" | "cargadoPor" | "creadoEn">[];
}



// ─── Componente ───────────────────────────────────────────────────────────────
export function Relevamientos() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [relevamientos, setRelevamientos] = useState<Relevamiento[]>([]);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Edición (solo admin)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  // Upload Excel
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const excelRef = useRef<HTMLInputElement>(null);

  // Filtros
  const [filtroCalle, setFiltroCalle] = useState("");
  const [filtroObra, setFiltroObra] = useState("");
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [fechasSeleccionadas, setFechasSeleccionadas] = useState<Set<string>>(new Set());
  const [showFechasDropdown, setShowFechasDropdown] = useState(false);

  // Agrupar fechas únicas y contar registros
  const fechasDisponiblesConContador = useMemo(() => {
    const counts: Record<string, number> = {};
    relevamientos.forEach((r) => {
      if (r.creadoEn) {
        const d = r.creadoEn.toDate().toLocaleDateString("es-AR");
        counts[d] = (counts[d] || 0) + 1;
      }
    });
    const uniqueDates = Object.keys(counts).sort((a, b) => {
      const [da, ma, ya] = a.split("/").map(Number);
      const [db, mb, yb] = b.split("/").map(Number);
      return new Date(yb, mb - 1, db).getTime() - new Date(ya, ma - 1, da).getTime();
    });
    return uniqueDates.map((fecha) => ({
      fecha,
      count: counts[fecha],
    }));
  }, [relevamientos]);

  const toggleFecha = (fecha: string) => {
    setFechasSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(fecha)) {
        next.delete(fecha);
      } else {
        next.add(fecha);
      }
      return next;
    });
  };

  const seleccionarTodasLasFechas = () => {
    const all = new Set(fechasDisponiblesConContador.map((f) => f.fecha));
    setFechasSeleccionadas(all);
  };

  const deseleccionarTodasLasFechas = () => {
    setFechasSeleccionadas(new Set());
  };

  const fetchRelevamientos = async () => {
    try {
      const q = query(collection(db, "relevamientos"), orderBy("creadoEn", "desc"));
      const snap = await getDocs(q);
      // Normalizar el campo obra al cargar para agrupar variantes (vereda/Veredas → Vereda)
      setRelevamientos(
        snap.docs.map((d) => {
          const data = d.data() as Relevamiento;
          return { ...data, id: d.id, obra: normalizarObra(data.obra || "") };
        })
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRelevamientos(); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setEditForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    setError("");
    if (!form.calle.trim() || !form.obra.trim()) {
      setError("Calle y Obra son obligatorios.");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "relevamientos"), {
        ...form,
        cargadoPor: user?.username ?? "desconocido",
        creadoEn: serverTimestamp(),
      });
      setForm(emptyForm);
      setShowForm(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      fetchRelevamientos();
    } catch {
      setError("Error al guardar. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editForm.calle.trim() || !editForm.obra.trim()) return;
    try {
      await updateDoc(doc(db, "relevamientos", id), { ...editForm });
      setEditingId(null);
      fetchRelevamientos();
    } catch {
      alert("Error al guardar.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminás este relevamiento?")) return;
    try {
      await deleteDoc(doc(db, "relevamientos", id));
      fetchRelevamientos();
    } catch {
      alert("Error al eliminar.");
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg("");
    try {
      const buffer = await file.arrayBuffer();
      const nuevos = parsearExcelRelevamientos(buffer);

      if (nuevos.length === 0) {
        setUploadMsg(
          "No se encontraron filas válidas. El Excel debe tener columnas: Calle, Altura, Obra, Observaciones."
        );
        setUploading(false);
        return;
      }

      const CHUNK = 490;
      let totalImportados = 0;
      for (let i = 0; i < nuevos.length; i += CHUNK) {
        const batch = writeBatch(db);
        nuevos.slice(i, i + CHUNK).forEach((item) => {
          const ref = doc(collection(db, "relevamientos"));
          batch.set(ref, {
            ...item,
            cargadoPor: user?.username ?? "excel",
            creadoEn: serverTimestamp(),
          });
        });
        await batch.commit();
        totalImportados += Math.min(CHUNK, nuevos.length - i);
      }

      await fetchRelevamientos();
      setUploadMsg(
        `✓ ${totalImportados} relevamiento${totalImportados !== 1 ? "s" : ""} importado${totalImportados !== 1 ? "s" : ""} correctamente.`
      );
      setTimeout(() => setUploadMsg(""), 5000);
    } catch (err) {
      console.error(err);
      setUploadMsg("Error al procesar el archivo. Verificá el formato.");
    } finally {
      setUploading(false);
      if (excelRef.current) excelRef.current.value = "";
    }
  };

  const [paginaRel, setPaginaRel] = useState(1);
  useEffect(() => { setPaginaRel(1); }, [filtroCalle, filtroObra, fechasSeleccionadas]);

  const resultados = useMemo(() => {
    return relevamientos.filter((r) => {
      if (filtroCalle && !r.calle.toLowerCase().includes(filtroCalle.toLowerCase().trim())) return false;
      if (filtroObra && !r.obra.toLowerCase().includes(filtroObra.toLowerCase().trim())) return false;
      if (fechasSeleccionadas.size > 0) {
        const fechaStr = r.creadoEn ? r.creadoEn.toDate().toLocaleDateString("es-AR") : "";
        if (!fechasSeleccionadas.has(fechaStr)) return false;
      }
      return true;
    });
  }, [relevamientos, filtroCalle, filtroObra, fechasSeleccionadas]);

  const POR_PAGINA_REL = 50;
  const resultadosPaginados = useMemo(() => {
    const inicio = (paginaRel - 1) * POR_PAGINA_REL;
    return resultados.slice(inicio, inicio + POR_PAGINA_REL);
  }, [resultados, paginaRel]);

  return (
    <div className="space-y-4">
      {/* Encabezado Responsivo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-slate-800 tracking-tight">Relevamientos</h2>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <button
                onClick={() => excelRef.current?.click()}
                disabled={uploading}
                className="flex-1 sm:flex-initial rounded-lg border border-blue-600 px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
              >
                {uploading ? "Importando..." : "↑ Importar Excel"}
              </button>
              <input
                ref={excelRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                className="hidden"
              />
            </>
          )}
          {isAdmin && (
            <>
              <button
                onClick={() => setIsPasswordModalOpen(true)}
                disabled={resultados.length === 0}
                className="flex-1 sm:flex-initial rounded-lg border bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-all"
              >
                Exportar PDF
              </button>
              <PasswordPromptDialog
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
                onConfirm={() => exportRelevamientosToPdf(resultados, isAdmin)}
              />
            </>
          )}
          <button
            onClick={() => setShowForm((v) => !v)}
            className="w-full sm:w-auto rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm transition-colors"
          >
            {showForm ? "Cancelar" : "+ Nuevo relevamiento"}
          </button>
        </div>
      </div>

      {/* Mensaje upload */}
      {uploadMsg && (
        <div className={`rounded-lg border px-4 py-3 text-xs font-medium premium-shadow ${
          uploadMsg.startsWith("✓")
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          {uploadMsg}
        </div>
      )}

      {/* Filtros: Acordeón colapsable en móviles y visible en desktop */}
      <div className="rounded-xl border bg-glass p-4 premium-shadow">
        <div className="flex items-center justify-between md:hidden">
          <button
            onClick={() => setShowFiltersMobile(!showFiltersMobile)}
            className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-800"
          >
            🔍 {showFiltersMobile ? "Ocultar filtros" : "Mostrar filtros de búsqueda"}
          </button>
          <span className="text-xs text-slate-500 font-semibold">
            {resultados.length} registros
          </span>
        </div>

        <div className={`mt-3 md:mt-0 ${showFiltersMobile ? "block" : "hidden"} md:flex md:flex-wrap md:items-end md:gap-4`}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto md:flex md:gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Calle</label>
              <input
                value={filtroCalle}
                onChange={(e) => setFiltroCalle(e.target.value)}
                placeholder="Ej: San Martín"
                className="rounded-lg border bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full md:w-44"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Obra</label>
              <select
                value={filtroObra}
                onChange={(e) => setFiltroObra(e.target.value)}
                className="rounded-lg border bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full md:w-44"
              >
                <option value="">Todas</option>
                {OBRAS_OPCIONES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 relative">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fecha</label>
              <button
                type="button"
                onClick={() => setShowFechasDropdown(!showFechasDropdown)}
                className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full md:w-48 text-left h-[34px]"
              >
                <span className="truncate">
                  {fechasSeleccionadas.size === 0
                    ? "Todas las fechas"
                    : fechasSeleccionadas.size === 1
                    ? `${Array.from(fechasSeleccionadas)[0]}`
                    : `${fechasSeleccionadas.size} fechas`}
                </span>
                <span className="ml-2 text-slate-400">▼</span>
              </button>

              {showFechasDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowFechasDropdown(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 w-full md:w-56 rounded-lg border bg-white p-2 shadow-lg z-20 animate-fade-in">
                    <div className="flex justify-between border-b pb-2 mb-2">
                      <button
                        type="button"
                        onClick={seleccionarTodasLasFechas}
                        className="text-[10px] font-bold text-blue-600 hover:underline"
                      >
                        Todas
                      </button>
                      <button
                        type="button"
                        onClick={deseleccionarTodasLasFechas}
                        className="text-[10px] font-bold text-slate-500 hover:underline"
                      >
                        Ninguna
                      </button>
                    </div>
                    {fechasDisponiblesConContador.length === 0 ? (
                      <div className="p-2 text-center text-slate-400 text-[11px]">
                        No hay fechas
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                        {fechasDisponiblesConContador.map(({ fecha, count }) => (
                          <label
                            key={fecha}
                            className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-slate-50 cursor-pointer text-[11px] text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={fechasSeleccionadas.has(fecha)}
                              onChange={() => toggleFecha(fecha)}
                              className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                            />
                            <span className="font-medium">{fecha}</span>
                            <span className="ml-auto text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                              {count}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="mt-4 md:mt-0 flex gap-2 w-full md:w-auto">
            {(filtroCalle || filtroObra || fechasSeleccionadas.size > 0) && (
              <button
                onClick={() => {
                  setFiltroCalle("");
                  setFiltroObra("");
                  setFechasSeleccionadas(new Set());
                }}
                className="flex-1 md:flex-none rounded-lg border bg-slate-100 hover:bg-slate-200 px-4 py-2 text-xs text-slate-600 font-semibold transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
          <span className="hidden md:inline ml-auto text-xs text-slate-500 font-semibold">
            {resultados.length} de {relevamientos.length} registros
          </span>
        </div>
      </div>

      {/* Formulario nuevo */}
      {showForm && (
        <div className="rounded-xl border bg-white p-4 shadow-md animate-fade-in space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Nuevo relevamiento</h3>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500">Calle *</label>
              <input
                name="calle"
                value={form.calle}
                onChange={handleChange}
                className="rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Ej: San Martín"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500">Altura (opcional)</label>
              <input
                name="altura"
                value={form.altura}
                onChange={handleChange}
                className="rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Ej: 456"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500">Obra *</label>
              <select
                name="obra"
                value={form.obra}
                onChange={handleChange}
                className="rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">— Seleccioná una obra —</option>
                {OBRAS_OPCIONES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500">Observaciones (opcional)</label>
              <input
                name="observaciones"
                value={form.observaciones}
                onChange={handleChange}
                className="rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Observaciones adicionales..."
              />
            </div>
          </div>
          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-2.5 text-xs font-semibold text-emerald-800">
          ✓ Relevamiento cargado correctamente.
        </div>
      )}

      {/* Grid de contenido responsivo */}
      {loading ? (
        <p className="text-xs text-slate-500 font-semibold animate-pulse">Cargando relevamientos...</p>
      ) : resultados.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-dashed text-slate-400 font-semibold text-sm">
          No hay relevamientos cargados que coincidan con la búsqueda.
        </div>
      ) : (
        <>
          {/* VISTA DESKTOP (Tabla) */}
          <div className="hidden md:block overflow-hidden rounded-xl border bg-white premium-shadow">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider">Calle</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider">Altura</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider">Obra</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider">Observaciones</th>
                  {isAdmin && <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider">Cargado por</th>}
                  {isAdmin && <th className="px-4 py-3 font-semibold text-slate-500 uppercase tracking-wider text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resultadosPaginados.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    {editingId === r.id ? (
                      <>
                        <td className="px-4 py-3 text-slate-400">{formatFecha(r.creadoEn)}</td>
                        <td className="px-2 py-2">
                          <input name="calle" value={editForm.calle} onChange={handleEditChange} className="w-full rounded-lg border bg-white px-2 py-1.5 text-xs text-slate-800" />
                        </td>
                        <td className="px-2 py-2">
                          <input name="altura" value={editForm.altura} onChange={handleEditChange} className="w-24 rounded-lg border bg-white px-2 py-1.5 text-xs text-slate-800" />
                        </td>
                        <td className="px-2 py-2">
                          <select name="obra" value={editForm.obra} onChange={handleEditChange} className="w-full rounded-lg border bg-white px-2 py-1.5 text-xs text-slate-800">
                            {OBRAS_OPCIONES.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input name="observaciones" value={editForm.observaciones} onChange={handleEditChange} className="w-full rounded-lg border bg-white px-2 py-1.5 text-xs text-slate-800" />
                        </td>
                        {isAdmin && <td className="px-4 py-3 text-slate-400">{r.cargadoPor}</td>}
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => handleSaveEdit(r.id!)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700">Aceptar</button>
                            <button onClick={() => setEditingId(null)} className="rounded-lg border bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-500 hover:bg-slate-50">Cancelar</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatFecha(r.creadoEn)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{r.calle}</td>
                        <td className="px-4 py-3 text-slate-600">{r.altura || "—"}</td>
                        <td className="px-4 py-3 text-slate-800 font-medium">
                          <span className="bg-blue-50 text-blue-800 px-2.5 py-1 rounded-full font-semibold">{r.obra}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 max-w-xs truncate" title={r.observaciones}>{r.observaciones || "—"}</td>
                        {isAdmin && <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{r.cargadoPor}</td>}
                        {isAdmin && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex gap-3 justify-end font-semibold">
                              <button
                                onClick={() => {
                                  setEditingId(r.id!);
                                  setEditForm({
                                    calle: r.calle,
                                    altura: r.altura,
                                    obra: r.obra,
                                    observaciones: r.observaciones,
                                  });
                                }}
                                className="text-blue-600 hover:underline"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDelete(r.id!)}
                                className="text-red-500 hover:underline"
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* VISTA MÓVIL (Lista de tarjetas Glassmorphic) */}
          <div className="md:hidden grid grid-cols-1 gap-3">
            {resultadosPaginados.map((r) => (
              <div key={r.id} className="rounded-xl border bg-glass p-4 premium-shadow relative transition-all duration-200">
                {editingId === r.id ? (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400">Calle</label>
                      <input name="calle" value={editForm.calle} onChange={handleEditChange} className="w-full rounded-lg border bg-white px-2 py-1.5 text-xs" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400">Altura</label>
                      <input name="altura" value={editForm.altura} onChange={handleEditChange} className="w-full rounded-lg border bg-white px-2 py-1.5 text-xs" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400">Obra</label>
                      <select name="obra" value={editForm.obra} onChange={handleEditChange} className="w-full rounded-lg border bg-white px-2 py-1.5 text-xs">
                        {OBRAS_OPCIONES.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400">Observaciones</label>
                      <textarea name="observaciones" value={editForm.observaciones} onChange={handleEditChange} className="w-full rounded-lg border bg-white px-2 py-1.5 text-xs" rows={2} />
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <button onClick={() => handleSaveEdit(r.id!)} className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white">Guardar</button>
                      <button onClick={() => setEditingId(null)} className="rounded-lg border bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-500">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-semibold text-slate-400">{formatFecha(r.creadoEn)}</span>
                      {isAdmin && (
                        <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                          👤 {r.cargadoPor}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm">📍 {r.calle} {r.altura || ""}</h4>
                    <div className="mt-2 space-y-1 text-xs">
                      <p><span className="text-slate-400 font-semibold">Obra:</span> <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-0.5">{r.obra}</span></p>
                      {r.observaciones && <p className="text-slate-600 mt-1.5 italic">"{r.observaciones}"</p>}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-4 mt-3 pt-2.5 border-t border-slate-100 justify-end font-bold">
                        <button
                          onClick={() => {
                            setEditingId(r.id!);
                            setEditForm({
                              calle: r.calle,
                              altura: r.altura,
                              obra: r.obra,
                              observaciones: r.observaciones,
                            });
                          }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(r.id!)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Eliminar
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <PaginadorRel total={resultados.length} pagina={paginaRel} setPagina={setPaginaRel} porPagina={POR_PAGINA_REL} />
        </>
      )}
    </div>
  );
}

// ─── Paginador responsivo ──────────────────────────────────────────────────────────────
function PaginadorRel({
  total, pagina, setPagina, porPagina,
}: { total: number; pagina: number; setPagina: (p: number) => void; porPagina: number }) {
  const totalPaginas = Math.ceil(total / porPagina);
  if (totalPaginas <= 1) return null;
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500 font-semibold">
      <span className="text-center sm:text-left">{desde}–{hasta} de {total} registros</span>
      <div className="flex justify-center gap-1 overflow-x-auto py-1 custom-scrollbar">
        <button onClick={() => setPagina(1)} disabled={pagina === 1} className="rounded-lg border bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-30">«</button>
        <button onClick={() => setPagina(pagina - 1)} disabled={pagina === 1} className="rounded-lg border bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-30">‹</button>
        {Array.from({ length: totalPaginas }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPaginas || Math.abs(p - pagina) <= 1)
          .reduce<(number | "...")[]>((acc, p, i, arr) => {
            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
            acc.push(p); return acc;
          }, [])
          .map((p, i) => p === "..." ? (
            <span key={`e${i}`} className="px-2 py-1">…</span>
          ) : (
            <button key={p} onClick={() => setPagina(p as number)}
              className={`rounded-lg border px-3 py-1 font-bold transition-all ${pagina === p ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-700 hover:bg-slate-50"}`}
            >{p}</button>
          ))}
        <button onClick={() => setPagina(pagina + 1)} disabled={pagina === totalPaginas} className="rounded-lg border bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-30">›</button>
        <button onClick={() => setPagina(totalPaginas)} disabled={pagina === totalPaginas} className="rounded-lg border bg-white px-2 py-1 hover:bg-slate-50 disabled:opacity-30">»</button>
      </div>
    </div>
  );
}
