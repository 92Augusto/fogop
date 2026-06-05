import { useCallback, useEffect, useMemo, useRef, useState, Component, ReactNode } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GeocodingQueue, GeocodingResult } from "@/lib/GeocodingQueue";

interface Intimacion {
  id?: string;
  nroIntimacion: string;
  domicilio: string;
  responsable: string;
  inspector: string;
  motivo: string;
  plazo: string;
  fechaVencimiento: string;
  lat?: number;
  lng?: number;
  aproximado?: boolean;
}

interface Props {
  intimaciones: Intimacion[];
  isAdmin?: boolean;
}

const iconCache: Record<string, L.DivIcon> = {};

function crearIcono(color: "azul" | "naranja" | "verde", vencido: boolean, editando: boolean): L.DivIcon {
  const cacheKey = `${color}-${vencido}-${editando}`;
  if (iconCache[cacheKey]) return iconCache[cacheKey];

  const pinColor = color === "azul" ? "#2563eb" : color === "naranja" ? "#ea7b1a" : "#16a34a";
  const centroColor = vencido ? "#ef4444" : "#ffffff";
  const borde = editando ? "2px solid #facc15" : "none";
  const html = `
    <div style="width:24px;height:36px;position:relative;outline:${borde};border-radius:50% 50% 50% 0;">
      <svg viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.35))">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z" fill="${pinColor}"/>
        <circle cx="12" cy="12" r="5" fill="${centroColor}"/>
      </svg>
    </div>`;
  
  const icon = L.divIcon({ html, className: "", iconSize: [24, 36], iconAnchor: [12, 36], popupAnchor: [0, -36] });
  iconCache[cacheKey] = icon;
  return icon;
}

function estaVencido(fechaVencimiento: string): boolean {
  if (!fechaVencimiento) return false;
  const partes = fechaVencimiento.split("/");
  if (partes.length !== 3) return false;
  const [d, m, a] = partes.map(Number);
  const fv = new Date(a, m - 1, d);
  if (isNaN(fv.getTime())) return false;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return fv < hoy;
}

function MapClickHandler({ pinSeleccionado, onMapClick }: { pinSeleccionado: string | null; onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) { if (pinSeleccionado) onMapClick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

class MapErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div className="p-4 bg-red-100 text-red-800 rounded-md border border-red-300">Hubo un error cargando el mapa: {this.state.error?.message}</div>;
    }
    return this.props.children;
  }
}

type Punto = Intimacion & { lat: number; lng: number; aproximado: boolean };

export default function IntimacionesMapa({ intimaciones, isAdmin }: Props) {
  const isUserAdmin = isAdmin ?? false;
  const [mounted, setMounted] = useState(false);
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [progreso, setProgreso] = useState("");
  const [geocodificando, setGeocodificando] = useState(false);

  // Fallidos: guardamos los objetos completos para poder reintentar
  const [fallidasItems, setFallidasItems] = useState<Intimacion[]>([]);
  const [reintentando, setReintentando] = useState(false);

  // Edición manual
  const [modoEdicion, setModoEdicion] = useState(false);
  const [pinSeleccionado, setPinSeleccionado] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState<string | null>(null);
  const markerRefs = useRef<Record<string, L.Marker>>({});

  // Estadísticas
  const [mostrarStats, setMostrarStats] = useState(false);

  // Instancia de la cola de geocodificación
  const queueRef = useRef<GeocodingQueue | null>(null);

  const safeIntimaciones = Array.isArray(intimaciones) ? intimaciones : [];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Inicializar la cola una vez al montar
  useEffect(() => {
    if (!mounted) return;

    const queue = new GeocodingQueue(1200);
    queueRef.current = queue;

    queue.onProgress = (completados, totales) => {
      setProgreso(`Ubicando ${completados} de ${totales}...`);
    };

    queue.onItemComplete = async (res: GeocodingResult) => {
      if (res.exito) {
        // Solo guardamos en base de datos si el usuario es administrador para evitar errores de permisos
        if (isUserAdmin) {
          try {
            await updateDoc(doc(db, "intimaciones", res.id), { lat: res.lat, lng: res.lng, aproximado: res.aproximado });
          } catch (e) {
            console.error("Error al guardar coordenadas en base de datos:", e);
          }
        }
        const item = safeIntimaciones.find(i => i.id === res.id);
        if (item) {
          setPuntos((prev) => {
            const lat = Number(res.lat);
            const lng = Number(res.lng);
            if (prev.some(p => p.id === res.id)) {
              return prev.map(p => p.id === res.id ? { ...p, lat, lng, aproximado: res.aproximado } : p);
            }
            return [...prev, { ...item, lat, lng, aproximado: res.aproximado }];
          });
        }
      } else {
        const item = safeIntimaciones.find(i => i.id === res.id);
        if (item) {
          setFallidasItems((prev) => {
            if (prev.some(p => p.id === res.id)) return prev;
            return [...prev, item];
          });
        }
      }
    };

    queue.onComplete = () => {
      setGeocodificando(false);
      setReintentando(false);
      setProgreso("");
    };

    return () => {
      queue.pause();
    };
  }, [mounted, intimaciones, isUserAdmin]); // Se actualizan las referencias de las intimaciones actuales en los callbacks

  // Cargar coordenadas y encolar las pendientes
  useEffect(() => {
    if (!mounted || safeIntimaciones.length === 0) return;

    // 1. Mostrar las que ya tienen coordenadas válidas numéricas
    const conCoords = safeIntimaciones
      .filter((i) => {
        const lat = Number(i.lat);
        const lng = Number(i.lng);
        return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0 && !!i.domicilio;
      })
      .map((i) => ({
        ...i,
        lat: Number(i.lat),
        lng: Number(i.lng),
      })) as Punto[];
    setPuntos(conCoords);

    // 2. Encolar las que no tienen coordenadas
    const sinCoords = safeIntimaciones.filter((i) => {
      const lat = Number(i.lat);
      const lng = Number(i.lng);
      return (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) && !!i.domicilio;
    });
    
    if (sinCoords.length > 0 && !geocodificando && !reintentando && queueRef.current) {
      setGeocodificando(true);
      setFallidasItems([]);
      queueRef.current.clear();
      queueRef.current.addJobs(sinCoords.map(i => ({ id: i.id!, direccion: i.domicilio })));
      queueRef.current.start();
    }
  }, [mounted, intimaciones]);

  useEffect(() => {
    if (!modoEdicion) setPinSeleccionado(null);
  }, [modoEdicion]);

  async function reintentarFallidas() {
    if (fallidasItems.length === 0) return;
    setReintentando(true);
    setGeocodificando(true);
    setFallidasItems([]);
    if (queueRef.current) {
      queueRef.current.clear();
      queueRef.current.addJobs(fallidasItems.map(i => ({ id: i.id!, direccion: i.domicilio })));
      queueRef.current.start();
    }
  }

  const guardarCoordenadas = useCallback(async (id: string, lat: number, lng: number) => {
    setGuardando(id);
    try {
      await updateDoc(doc(db, "intimaciones", id), { lat, lng, aproximado: false });
      setPuntos((prev) => prev.map((p) => p.id === id ? { ...p, lat, lng, aproximado: false } : p));
      setGuardadoOk(id);
      setTimeout(() => setGuardadoOk(null), 2500);
    } catch (e) {
      console.error("Error guardando coordenadas:", e);
    }
    setGuardando(null);
  }, []);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (!pinSeleccionado || !isUserAdmin) return;
    await guardarCoordenadas(pinSeleccionado, lat, lng);
    const marker = markerRefs.current[pinSeleccionado];
    if (marker) marker.setLatLng([lat, lng]);
    setPinSeleccionado(null);
  }, [pinSeleccionado, guardarCoordenadas, isUserAdmin]);

  // Estadísticas calculadas
  const stats = useMemo(() => {
    const vencidos = puntos.filter((p) => estaVencido(p.fechaVencimiento)).length;
    const aproximados = puntos.filter((p) => p.aproximado).length;
    const porInspector: Record<string, { total: number; vencidos: number }> = {};
    puntos.forEach((p) => {
      const k = p.inspector || "Sin inspector";
      if (!porInspector[k]) porInspector[k] = { total: 0, vencidos: 0 };
      porInspector[k].total++;
      if (estaVencido(p.fechaVencimiento)) porInspector[k].vencidos++;
    });
    return { vencidos, aproximados, porInspector };
  }, [puntos]);

  if (!mounted) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Cargando mapa...</div>;
  }

  const exactos = puntos.filter((p) => !p.aproximado).length;
  const aprox = puntos.filter((p) => p.aproximado).length;

  return (
    <div className="flex flex-col gap-3">
      {(geocodificando || reintentando) && (
        <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-700">
          ⏳ {progreso}
        </div>
      )}

      {!geocodificando && !reintentando && fallidasItems.length > 0 && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-2 text-sm text-yellow-800">
          <div className="flex items-center justify-between gap-3">
            <span>
              ⚠️ No se pudieron ubicar {fallidasItems.length} domicilio(s):{" "}
              <span className="font-medium">{fallidasItems.map((f) => f.domicilio).join(" · ")}</span>
            </span>
            <button
              onClick={reintentarFallidas}
              className="shrink-0 rounded-md border border-yellow-400 bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-900 hover:bg-yellow-200"
            >
              🔄 Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Barra de controles */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <span>🔵 Exactos: {exactos}</span>
          <span>🟠 Aproximados: {aprox}</span>
          {fallidasItems.length > 0 && <span>❌ Sin ubicar: {fallidasItems.length}</span>}
          <span>🔴 Punto rojo = plazo vencido</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMostrarStats((v) => !v)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              mostrarStats ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            📊 {mostrarStats ? "Ocultar stats" : "Ver stats"}
          </button>
          {isUserAdmin && (
            <button
              onClick={() => setModoEdicion((v) => !v)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                modoEdicion ? "bg-yellow-100 border-yellow-400 text-yellow-800" : "bg-muted text-muted-foreground hover:bg-yellow-50 hover:border-yellow-300"
              }`}
            >
              {modoEdicion ? "✏️ Editando — clic para salir" : "✏️ Editar pines"}
            </button>
          )}
        </div>
      </div>

      {/* Panel de estadísticas */}
      {mostrarStats && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Estadísticas del mapa</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-muted p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{puntos.length}</p>
              <p className="text-xs text-muted-foreground">Ubicados de {safeIntimaciones.length}</p>
            </div>
            <div className="rounded-md bg-red-50 p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{stats.vencidos}</p>
              <p className="text-xs text-red-600">
                Vencidos ({puntos.length > 0 ? Math.round((stats.vencidos / puntos.length) * 100) : 0}%)
              </p>
            </div>
            <div className="rounded-md bg-orange-50 p-3 text-center">
              <p className="text-2xl font-bold text-orange-700">{stats.aproximados}</p>
              <p className="text-xs text-orange-600">Ubicación aproximada</p>
            </div>
          </div>

          {Object.keys(stats.porInspector).length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Por inspector</p>
              <div className="flex flex-col gap-1">
                {Object.entries(stats.porInspector)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([inspector, data]) => (
                    <div key={inspector} className="flex items-center gap-2 text-xs">
                      <span className="w-40 truncate text-foreground">{inspector}</span>
                      <div className="flex-1 rounded-full bg-muted h-2 overflow-hidden">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${(data.total / puntos.length) * 100}%` }}
                        />
                      </div>
                      <span className="w-16 text-right text-muted-foreground">
                        {data.total} ({data.vencidos > 0 && <span className="text-red-500">{data.vencidos}🔴</span>})
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {modoEdicion && (
        <div className="rounded-md bg-yellow-50 border border-yellow-300 px-4 py-2 text-xs text-yellow-800">
          {pinSeleccionado
            ? "📍 Ahora hacé clic en el mapa para mover el pin al lugar correcto."
            : "Hacé clic en un pin para seleccionarlo y luego clic en el mapa para moverlo. También podés arrastrarlo directamente."}
        </div>
      )}

      <div className="rounded-lg overflow-hidden border border-gray-200 shadow-sm" style={{ height: "520px" }}>
        <MapErrorBoundary>
          <MapContainer center={[-27.48, -58.83]} zoom={13} style={{ height: "100%", width: "100%" }}>
            {/* CartoDB Voyager — Estilo moderno y limpio */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <MapClickHandler pinSeleccionado={pinSeleccionado} onMapClick={handleMapClick} />

            {puntos.map((item) => {
                const id = item.id ?? item.nroIntimacion;
                const seleccionado = pinSeleccionado === id;
                const vencido = estaVencido(item.fechaVencimiento);
                const colorPin = seleccionado ? "verde" : item.aproximado ? "naranja" : "azul";
                return (
                  <Marker
                    key={id}
                    position={[item.lat, item.lng]}
                    icon={crearIcono(colorPin, vencido, seleccionado)}
                    draggable={modoEdicion && isUserAdmin}
                    ref={(ref) => { if (ref && item.id) markerRefs.current[item.id] = ref; }}
                    eventHandlers={{
                      click: () => { if (modoEdicion) setPinSeleccionado(seleccionado ? null : id); },
                      dragend: async (e) => {
                        if (!modoEdicion || !isUserAdmin || !item.id) return;
                        const { lat, lng } = (e.target as L.Marker).getLatLng();
                        await guardarCoordenadas(item.id, lat, lng);
                      },
                    }}
                  >
                    <Popup><PopupContent item={item} vencido={vencido} guardando={guardando} guardadoOk={guardadoOk} modoEdicion={modoEdicion} seleccionado={seleccionado} /></Popup>
                  </Marker>
                );
              })
            }
          </MapContainer>
        </MapErrorBoundary>
      </div>

      <p className="text-xs text-gray-400 text-right">
        {puntos.length} de {safeIntimaciones.length} puntos ubicados · OpenStreetMap + Nominatim (Secuencial)
      </p>
    </div>
  );
}

function PopupContent({ item, vencido, guardando, guardadoOk, modoEdicion, seleccionado }: {
  item: Punto;
  vencido: boolean;
  guardando: string | null;
  guardadoOk: string | null;
  modoEdicion: boolean;
  seleccionado?: boolean;
}) {
  const id = item.id ?? item.nroIntimacion;
  return (
    <div style={{ minWidth: 180, fontSize: 13, lineHeight: 1.6 }}>
      <strong>Intimación #{item.nroIntimacion}</strong>
      {vencido && <span style={{ color: "#ef4444", fontSize: 11 }}> 🔴 Vencido</span>}
      {item.aproximado && !seleccionado && <span style={{ color: "#d97706", fontSize: 11 }}> ⚠️ aprox.</span>}
      {guardando === id && <span style={{ color: "#2563eb", fontSize: 11 }}> 💾 Guardando...</span>}
      {guardadoOk === id && <span style={{ color: "#16a34a", fontSize: 11 }}> ✓ Guardado</span>}
      <br />
      📍 {item.domicilio}<br />
      👤 <b>Responsable:</b> {item.responsable}<br />
      🔍 <b>Inspector:</b> {item.inspector}<br />
      📋 <b>Motivo:</b> {item.motivo}<br />
      ⏰ <b>Plazo:</b> {item.plazo} días<br />
      📅 <b>Vencimiento:</b> {item.fechaVencimiento}
      {modoEdicion && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#92400e", background: "#fef3c7", padding: "4px 6px", borderRadius: 4 }}>
          ✏️ Arrastrá el pin o hacé clic en él y luego en el mapa para moverlo.
        </div>
      )}
    </div>
  );
}
