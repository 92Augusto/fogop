export type TipoObra =
  | "Sistema Videovigilancia"
  | "Recambio De Luminarias"
  | "Reconstrucción De Veredas"
  | "Pavimento/Ripio"
  | "Desagues Pluviales"
  | "Red Cloacales";

export type EstadoObra =
  | "Proceso de aprobación"
  | "Pendiente de realización"
  | "Liquidado"
  | "Ejecutado FOGOP"
  | "Ejecutado Infra"
  | "Ejecutado";

export interface Obra {
  id: number;
  acta: string;
  anio: number;
  fecha: string | null;
  expteMadre: string;
  expteHijo: string;
  tipoObra: TipoObra;
  ubicacion: string;
  direccion: string;
  puntos: number;
  estado: EstadoObra;
}

export const TIPOS_OBRA: TipoObra[] = [
  "Sistema Videovigilancia",
  "Recambio De Luminarias",
  "Reconstrucción De Veredas",
  "Pavimento/Ripio",
  "Desagues Pluviales",
  "Red Cloacales",
];

export const ESTADOS_OBRA: EstadoObra[] = [
  "Proceso de aprobación",
  "Pendiente de realización",
  "Liquidado",
  "Ejecutado FOGOP",
  "Ejecutado Infra",
  "Ejecutado",
];

export const ANIOS = [2017, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

// Sample dataset — replace with full 417 records from Libro1.xlsx
export const obrasData: Obra[] = [
  { id: 1, acta: "Acta N° 639", anio: 2024, fecha: "2024-03-15", expteMadre: "226-V-2025", expteHijo: "7944-S-2025", tipoObra: "Sistema Videovigilancia", ubicacion: "", direccion: "Barrio ANTARTIDA ARGENTINA I", puntos: 45, estado: "Ejecutado FOGOP" },
  { id: 2, acta: "Acta N° 640", anio: 2024, fecha: "2024-04-10", expteMadre: "227-V-2025", expteHijo: "7945-S-2025", tipoObra: "Sistema Videovigilancia", ubicacion: "", direccion: "Barrio LAGUNA SECA", puntos: 32, estado: "Ejecutado" },
  { id: 3, acta: "Acta N° 641", anio: 2023, fecha: "2023-07-22", expteMadre: "150-V-2023", expteHijo: "5200-S-2023", tipoObra: "Recambio De Luminarias", ubicacion: "", direccion: "Barrio CENTRO - Av. Costanera", puntos: 120, estado: "Liquidado" },
  { id: 4, acta: "", anio: 2025, fecha: null, expteMadre: "301-V-2025", expteHijo: "8100-S-2025", tipoObra: "Reconstrucción De Veredas", ubicacion: "", direccion: "Barrio SAN MARTIN - Calle Junín", puntos: 0, estado: "Proceso de aprobación" },
  { id: 5, acta: "", anio: 2025, fecha: null, expteMadre: "302-V-2025", expteHijo: "", tipoObra: "Pavimento/Ripio", ubicacion: "", direccion: "Barrio MOLINA PUNTA - Calle 56", puntos: 0, estado: "Pendiente de realización" },
  { id: 6, acta: "Acta N° 500", anio: 2022, fecha: "2022-11-05", expteMadre: "100-V-2022", expteHijo: "3200-S-2022", tipoObra: "Desagues Pluviales", ubicacion: "Zona Sur", direccion: "Barrio PONCE - Av. Maipú", puntos: 0, estado: "Ejecutado Infra" },
  { id: 7, acta: "Acta N° 501", anio: 2022, fecha: "2022-12-01", expteMadre: "101-V-2022", expteHijo: "3201-S-2022", tipoObra: "Red Cloacales", ubicacion: "Zona Norte", direccion: "Barrio ESPERANZA - Ruta 12", puntos: 0, estado: "Ejecutado" },
  { id: 8, acta: "Acta N° 600", anio: 2023, fecha: "2023-05-10", expteMadre: "151-V-2023", expteHijo: "5201-S-2023", tipoObra: "Sistema Videovigilancia", ubicacion: "", direccion: "Barrio BAÑADO NORTE", puntos: 85, estado: "Ejecutado FOGOP" },
  { id: 9, acta: "Acta N° 601", anio: 2023, fecha: "2023-06-15", expteMadre: "152-V-2023", expteHijo: "5202-S-2023", tipoObra: "Recambio De Luminarias", ubicacion: "", direccion: "Barrio CAMBA CUA - Calle Belgrano", puntos: 65, estado: "Liquidado" },
  { id: 10, acta: "Acta N° 602", anio: 2023, fecha: null, expteMadre: "153-V-2023", expteHijo: "5203-S-2023", tipoObra: "Sistema Videovigilancia", ubicacion: "", direccion: "Barrio VILLA RAQUEL", puntos: 28, estado: "Ejecutado" },
  { id: 11, acta: "", anio: 2024, fecha: null, expteMadre: "228-V-2024", expteHijo: "7946-S-2024", tipoObra: "Recambio De Luminarias", ubicacion: "", direccion: "Barrio ALDANA - Calle 9 de Julio", puntos: 150, estado: "Ejecutado Infra" },
  { id: 12, acta: "Acta N° 650", anio: 2024, fecha: "2024-08-20", expteMadre: "229-V-2024", expteHijo: "7947-S-2024", tipoObra: "Pavimento/Ripio", ubicacion: "Zona Este", direccion: "Barrio INDUSTRIAL - Acceso Sur", puntos: 0, estado: "Proceso de aprobación" },
  { id: 13, acta: "Acta N° 300", anio: 2021, fecha: "2021-03-01", expteMadre: "80-V-2021", expteHijo: "2100-S-2021", tipoObra: "Sistema Videovigilancia", ubicacion: "", direccion: "Barrio CENTRO - Plaza 25 de Mayo", puntos: 55, estado: "Liquidado" },
  { id: 14, acta: "Acta N° 301", anio: 2021, fecha: "2021-04-15", expteMadre: "81-V-2021", expteHijo: "2101-S-2021", tipoObra: "Desagues Pluviales", ubicacion: "", direccion: "Barrio QUILMES", puntos: 0, estado: "Ejecutado FOGOP" },
  { id: 15, acta: "Acta N° 200", anio: 2020, fecha: "2020-09-10", expteMadre: "50-V-2020", expteHijo: "1500-S-2020", tipoObra: "Red Cloacales", ubicacion: "", direccion: "Barrio PIRAYUI", puntos: 0, estado: "Ejecutado" },
  { id: 16, acta: "", anio: 2025, fecha: null, expteMadre: "303-V-2025", expteHijo: "8101-S-2025", tipoObra: "Sistema Videovigilancia", ubicacion: "", direccion: "Barrio BERÓN DE ASTRADA", puntos: 40, estado: "Pendiente de realización" },
  { id: 17, acta: "Acta N° 100", anio: 2019, fecha: "2019-06-20", expteMadre: "30-V-2019", expteHijo: "900-S-2019", tipoObra: "Recambio De Luminarias", ubicacion: "", direccion: "Barrio LIBERTAD - Av. 3 de Abril", puntos: 200, estado: "Liquidado" },
  { id: 18, acta: "Acta N° 50", anio: 2017, fecha: "2017-11-30", expteMadre: "10-V-2017", expteHijo: "300-S-2017", tipoObra: "Recambio De Luminarias", ubicacion: "", direccion: "Barrio CENTRO - Calle San Juan", puntos: 285, estado: "Ejecutado" },
  { id: 19, acta: "Acta N° 651", anio: 2024, fecha: "2024-09-05", expteMadre: "230-V-2024", expteHijo: "", tipoObra: "Reconstrucción De Veredas", ubicacion: "", direccion: "Barrio SANTA LUCIA", puntos: 0, estado: "Ejecutado Infra" },
  { id: 20, acta: "", anio: 2025, fecha: null, expteMadre: "304-V-2025", expteHijo: "8102-S-2025", tipoObra: "Desagues Pluviales", ubicacion: "", direccion: "Barrio 1000 VIVIENDAS", puntos: 0, estado: "Proceso de aprobación" },
  { id: 21, acta: "Acta N° 603", anio: 2023, fecha: "2023-08-12", expteMadre: "154-V-2023", expteHijo: "5204-S-2023", tipoObra: "Sistema Videovigilancia", ubicacion: "Zona Centro", direccion: "Barrio YAPEYÚ", puntos: 38, estado: "Ejecutado FOGOP" },
  { id: 22, acta: "Acta N° 502", anio: 2022, fecha: "2022-10-18", expteMadre: "102-V-2022", expteHijo: "3202-S-2022", tipoObra: "Recambio De Luminarias", ubicacion: "", direccion: "Barrio CACIQUE CANINDEYÚ", puntos: 95, estado: "Ejecutado" },
  { id: 23, acta: "Acta N° 302", anio: 2021, fecha: "2021-05-20", expteMadre: "82-V-2021", expteHijo: "2102-S-2021", tipoObra: "Pavimento/Ripio", ubicacion: "", direccion: "Barrio ARAZATY", puntos: 0, estado: "Liquidado" },
  { id: 24, acta: "", anio: 2025, fecha: null, expteMadre: "305-V-2025", expteHijo: "8103-S-2025", tipoObra: "Red Cloacales", ubicacion: "", direccion: "Barrio DR. MONTAÑA", puntos: 0, estado: "Pendiente de realización" },
  { id: 25, acta: "Acta N° 652", anio: 2024, fecha: "2024-07-01", expteMadre: "231-V-2024", expteHijo: "7948-S-2024", tipoObra: "Sistema Videovigilancia", ubicacion: "", direccion: "Barrio PATONO", puntos: 52, estado: "Ejecutado FOGOP" },
];
