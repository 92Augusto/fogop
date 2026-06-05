/**
 * Utilidad de Geocodificación Secuencial con control de frecuencia (Rate Limiting)
 * diseñada para cumplir con las políticas de uso de Nominatim (OpenStreetMap).
 * Versión mejorada: usa parámetros estructurados de Nominatim para mayor precisión.
 */

export interface GeocodingJob {
  id: string;
  direccionOriginal: string;
  intentos: number;
}

export interface GeocodingResult {
  id: string;
  lat: number;
  lng: number;
  aproximado: boolean;
  exito: boolean;
}

// Diccionario ampliado de corrección de calles conocidas con errores comunes de carga
const DICCIONARIO_CALLES: Record<string, string> = {
  "VELEZ SARFIELD": "Vélez Sársfield",
  "VELEZ SARSFIELD": "Vélez Sársfield",
  "SARFIELD": "Sársfield",
  "3 DE ABRIL": "3 de Abril",
  "FERRE": "Pedro Ferré",
  "PEDRO FERRE": "Pedro Ferré",
  "AV. PEDRO FERRE": "Avenida Pedro Ferré",
  "MAIPU": "Maipú",
  "ALTA GRACIA": "Alta Gracia",
  "ARMENIA": "Armenia",
  "INDEPENDENCIA": "Independencia",
  "CENTENARIO": "Centenario",
  "PONSATI": "Ponsati",
  "C. PELLEGRINI": "Carlos Pellegrini",
  "PELLEGRINI": "Carlos Pellegrini",
  "J. B. JUSTO": "Juan B. Justo",
  "J.B. JUSTO": "Juan B. Justo",
  "JUAN B JUSTO": "Juan B. Justo",
  "SAN MARTIN": "San Martín",
  "GDOR. RUIZ": "Gobernador Ruíz",
  "GDOR RUIZ": "Gobernador Ruíz",
  "GOVERNADOR RUIZ": "Gobernador Ruíz",
  "GOBERNADOR RUIZ": "Gobernador Ruíz",
  "RUIZ": "Ruíz",
  "BOLIVAR": "Bolívar",
  "ITUZAINGO": "Ituzaingó",
  "SANTA FE": "Santa Fe",
  "LA RIOJA": "La Rioja",
  "CORDOBA": "Córdoba",
  "TUCUMAN": "Tucumán",
  "ENTRE RIOS": "Entre Ríos",
  "ENTRE RÍOS": "Entre Ríos",
  "LINIERS": "Liniers",
  "MORENO": "Moreno",
  "BELGRANO": "Belgrano",
  "RIVADAVIA": "Rivadavia",
  "MITRE": "Mitre",
  "ROCA": "Roca",
  "PERU": "Perú",
  "BRASIL": "Brasil",
  "CHILE": "Chile",
  "URUGUAY": "Uruguay",
  "PARAGUAY": "Paraguay",
  "COLOMBIA": "Colombia",
  "ECUADOR": "Ecuador",
  "VENEZUELA": "Venezuela",
  "PANAMA": "Panamá",
  "MEXICO": "México",
  "MISIONES": "Misiones",
  "PAYSANDU": "Paysandú",
  "MARIANO I LOZA": "Mariano I. Loza",
  "M. I. LOZA": "Mariano I. Loza",
  "PJE": "Pasaje",
};

/**
 * Extrae la calle y altura de una dirección separados
 */
export function parsearDireccion(direccion: string): { calle: string; altura: string | null } {
  if (!direccion) return { calle: "", altura: null };

  let dir = direccion.toUpperCase().trim();

  // Remover descriptores de vereda y posición
  dir = dir.replace(/\bVEREDA\s+(NOROESTE|NORESTE|SUROESTE|SURESTE|NORTE|SUR|ESTE|OESTE)\b/gi, "");
  dir = dir.replace(/\bLINDERO\s+(SUR|NORTE|ESTE|OESTE|A)\b/gi, "");
  dir = dir.replace(/\bFRENTE\s+AL\s+EDIFICIO\b/gi, "");
  dir = dir.replace(/\bFRENTE\s+A\b/gi, "");
  dir = dir.replace(/\bFRENTE\b/gi, "");
  dir = dir.replace(/\bLINDERO\b/gi, "");

  // Normalizar Nº y símbolos similares
  dir = dir.replace(/Nº\s*/g, " ").replace(/N°\s*/g, " ").replace(/NUMERO\s*/g, " ");

  // Detectar altura (número al final)
  const matchAltura = dir.match(/\b(\d{3,5})\s*$/);
  let calle = dir;
  let altura: string | null = null;

  if (matchAltura) {
    altura = matchAltura[1];
    calle = dir.slice(0, matchAltura.index).trim();
  }

  // Normalizar abreviaturas en calle
  calle = calle.replace(/\bESQ\.?\b/g, "y").replace(/\bAV\.?\b/g, "Avenida").replace(/\bPJE\.?\b/g, "Pasaje");
  calle = calle.replace(/\s+/g, " ").trim();

  // Aplicar diccionario de corrección
  Object.keys(DICCIONARIO_CALLES).forEach((malEscrita) => {
    const regex = new RegExp(`\\b${malEscrita}\\b`, "gi");
    calle = calle.replace(regex, DICCIONARIO_CALLES[malEscrita]);
  });

  return { calle, altura };
}

/**
 * Limpia y normaliza una dirección (compatibilidad legada)
 */
export function limpiarDireccion(direccion: string): string {
  if (!direccion) return "";
  const { calle, altura } = parsearDireccion(direccion);
  const partes = [calle, altura].filter(Boolean).join(" ");
  return `${partes}, Corrientes, Argentina`;
}

export class GeocodingQueue {
  private queue: GeocodingJob[] = [];
  private totalJobs = 0;
  private completedJobs = 0;
  private isProcessing = false;
  private delayMs = 1200;
  private maxAttempts = 3;

  public onProgress?: (completados: number, total: number) => void;
  public onItemComplete?: (resultado: GeocodingResult) => void;
  public onComplete?: () => void;

  constructor(delayMs = 1200) {
    this.delayMs = delayMs;
  }

  public addJob(id: string, direccion: string) {
    const yaExiste = this.queue.some(job => job.id === id);
    if (!yaExiste) {
      this.queue.push({ id, direccionOriginal: direccion, intentos: 0 });
      this.totalJobs++;
      this.triggerProgress();
    }
  }

  public addJobs(jobs: { id: string; direccion: string }[]) {
    jobs.forEach(job => this.addJob(job.id, job.direccion));
  }

  public async start() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.processNext();
  }

  public pause() { this.isProcessing = false; }

  public clear() {
    this.queue = [];
    this.totalJobs = 0;
    this.completedJobs = 0;
    this.isProcessing = false;
    this.triggerProgress();
  }

  public getStats() {
    return { completados: this.completedJobs, totales: this.totalJobs, pendientes: this.queue.length, activo: this.isProcessing };
  }

  private triggerProgress() {
    if (this.onProgress) this.onProgress(this.completedJobs, this.totalJobs);
  }

  private async processNext() {
    if (!this.isProcessing || this.queue.length === 0) {
      this.isProcessing = false;
      if (this.queue.length === 0 && this.onComplete) this.onComplete();
      return;
    }

    const job = this.queue.shift()!;
    job.intentos++;

    try {
      const result = await this.geocode(job.direccionOriginal);
      if (result) {
        this.completedJobs++;
        this.triggerProgress();
        if (this.onItemComplete) this.onItemComplete({ id: job.id, lat: result.lat, lng: result.lng, aproximado: result.aproximado, exito: true });
      } else {
        if (job.intentos < this.maxAttempts) {
          this.queue.push(job);
        } else {
          this.completedJobs++;
          this.triggerProgress();
          if (this.onItemComplete) this.onItemComplete({ id: job.id, lat: 0, lng: 0, aproximado: false, exito: false });
        }
      }
    } catch (error) {
      console.error(`Error geocodificando ID ${job.id}:`, error);
      if (job.intentos < this.maxAttempts) {
        this.queue.push(job);
      } else {
        this.completedJobs++;
        this.triggerProgress();
        if (this.onItemComplete) this.onItemComplete({ id: job.id, lat: 0, lng: 0, aproximado: false, exito: false });
      }
    }

    setTimeout(() => this.processNext(), this.delayMs);
  }

  /**
   * Geocodificación principal: 3 intentos progresivos para máxima precisión.
   * Intento 1: API estructurada de Nominatim (street+city separados) → mayor precisión de número
   * Intento 2: Query libre con viewbox restringido a Corrientes
   * Intento 3: Fallback solo con calle (aproximado)
   */
  private async geocode(direccion: string): Promise<{ lat: number; lng: number; aproximado: boolean } | null> {
    const { calle, altura } = parsearDireccion(direccion);
    if (!calle) return null;

    // ── Intento 1: query ESTRUCTURADO (máxima precisión de número de puerta) ──
    const streetParam = altura ? `${calle} ${altura}` : calle;
    const url1 = `https://nominatim.openstreetmap.org/search?format=jsonv2&street=${encodeURIComponent(streetParam)}&city=Corrientes&state=Corrientes&country=Argentina&limit=3&addressdetails=1`;
    const r1 = await this.fetchNominatim(url1);
    if (r1) return r1;

    // ── Intento 2: query LIBRE con bounding box de Corrientes ──
    if (altura) {
      const q2 = `${calle} ${altura}, Corrientes, Argentina`;
      const url2 = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q2)}&viewbox=-58.92,-27.57,-58.73,-27.40&bounded=1&limit=3&addressdetails=1`;
      const r2 = await this.fetchNominatim(url2);
      if (r2) return r2;
    }

    // ── Intento 3: fallback solo calle (aproximado) ──
    return this.geocodeFallback(calle);
  }

  /**
   * Fetch a Nominatim y selecciona el mejor candidato dentro del área de Corrientes.
   */
  private async fetchNominatim(url: string): Promise<{ lat: number; lng: number; aproximado: boolean } | null> {
    try {
      const res = await fetch(url, {
        headers: { "Accept-Language": "es" }
      });
      if (!res.ok) {
        if (res.status === 429) {
          console.warn("Nominatim rate limit (429). Aumentando intervalo.");
          this.delayMs = Math.min(this.delayMs + 600, 4000);
        }
        return null;
      }
      const data = await res.json();
      if (!data || data.length === 0) return null;

      // Filtrar dentro del área metropolitana de Corrientes
      const BBOX = { latMin: -27.57, latMax: -27.40, lngMin: -58.92, lngMax: -58.73 };
      const enArea = data.filter((item: { lat: string; lon: string }) => {
        const lat = parseFloat(item.lat), lng = parseFloat(item.lon);
        return lat >= BBOX.latMin && lat <= BBOX.latMax && lng >= BBOX.lngMin && lng <= BBOX.lngMax;
      });

      const candidatos = enArea.length > 0 ? enArea : data;
      const item = candidatos[0];
      const lat = parseFloat(item.lat), lng = parseFloat(item.lon);

      // Precisión: si tiene número de puerta o es un edificio → exacto; si no → aproximado
      const addr = item.address || {};
      const tieneNumero = !!(addr.house_number);
      const esEdificio = item.class === "building" || item.type === "house" || item.type === "house_number" || item.type === "residential" || tieneNumero;

      return { lat, lng, aproximado: !esEdificio };
    } catch (e) {
      console.error("Error de red en Nominatim:", e);
      return null;
    }
  }

  /**
   * Fallback: geocodifica solo la calle sin número → siempre marcado como aproximado.
   */
  private async geocodeFallback(calle: string): Promise<{ lat: number; lng: number; aproximado: boolean } | null> {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(calle + ", Corrientes, Argentina")}&viewbox=-58.92,-27.57,-58.73,-27.40&bounded=1&limit=1`;
    try {
      const res = await fetch(url, {
        headers: { "Accept-Language": "es" }
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), aproximado: true };
    } catch { return null; }
    return null;
  }
}
