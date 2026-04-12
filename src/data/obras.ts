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
