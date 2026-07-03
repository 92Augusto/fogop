import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, orderBy, query, serverTimestamp, Timestamp,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth";
import type { ReactNode } from "react";
import { lazy, Suspense } from "react";
import { exportVeredasPedidosToPdf, exportVeredasIntimacionesToPdf } from "@/lib/pdf-export";
import { PasswordPromptDialog } from "@/components/PasswordPromptDialog";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type VeredasTab = "pedidos" | "intimaciones";
type IntiTab = "tabla" | "mapa";

type EstadoObra =
  | ""
  | "No responde"
  | "Proceso"
  | "Relevado"
  | "Presupuesto"
  | "Concluido";

const ESTADOS: EstadoObra[] = [
  "No responde",
  "Proceso",
  "Relevado",
  "Presupuesto",
  "Concluido",
];

const ESTADO_COLORS: Record<string, string> = {
  "No responde": "bg-red-100 text-red-800",
  "Proceso":     "bg-yellow-100 text-yellow-800",
  "Relevado":    "bg-blue-100 text-blue-800",
  "Presupuesto": "bg-purple-100 text-purple-800",
  "Concluido":   "bg-green-100 text-green-800",
};

export interface VeredaObra {
  id?: string;
  estado: EstadoObra;
  numeroBoleta: string;
  nombreApellido: string;
  direccion: string;
  barrio: string;
  observaciones: string;
  cargadoPor: string;
  expMadre: string;
  expHijo: string;
  telefono?: string;
  presupuestoPdf?: string;
  presupuestoPdfNombre?: string;
  presupuestoEnviado?: boolean;
  creadoEn: Timestamp | null;
}

export interface Intimacion {
  id?: string;
  fechaIntimacion: string;
  nroIntimacion: string;
  responsable: string;
  domicilio: string;
  inspector: string;
  zona: string;
  motivo: string;
  plazo: string;
  fechaVencimiento: string;
  observaciones: string;
  lat?: number;
  lng?: number;
}

// ─── Permisos ─────────────────────────────────────────────────────────────────

function puedeEditarEstado(username: string | undefined, role: string | undefined) {
  if (!username) return false;
  return role === "admin" || username.toLowerCase() === "eugenia";
}

function puedeEditarExp(username: string | undefined, role: string | undefined) {
  if (!username) return false;
  return (
    role === "admin" ||
    username.toLowerCase() === "eugenia" ||
    username.toLowerCase() === "fabri"
  );
}

// ─── Datos semilla (primera carga) ───────────────────────────────────────────

const SEED_INTIMACIONES: Omit<Intimacion, "id">[] = [
  { fechaIntimacion: "21/04/2026", nroIntimacion: "18073", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "BRASIL Nº 1341", inspector: "OVIEDO JUAN", zona: "1", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "21/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "21/04/2026", nroIntimacion: "18074", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "BRASIL Nº 1415", inspector: "OVIEDO JUAN", zona: "1", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "21/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "21/04/2026", nroIntimacion: "18075", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "BRASIL Nº 1433", inspector: "OVIEDO JUAN", zona: "1", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "21/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "21/04/2026", nroIntimacion: "18201", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "BRASIL Nº 1511", inspector: "OVIEDO JUAN", zona: "1", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "21/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "21/04/2026", nroIntimacion: "18202", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "BRASIL Nº 1547", inspector: "OVIEDO JUAN", zona: "1", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "21/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "21/04/2026", nroIntimacion: "18203", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "ROCA ESQ. AV. P. FERRE VEREDA NOROESTE", inspector: "OVIEDO JUAN", zona: "1", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "21/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "21/04/2026", nroIntimacion: "18204", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "ROCA Nº 1580", inspector: "OVIEDO JUAN", zona: "1", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "21/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "21/04/2026", nroIntimacion: "18205", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "ROCA Nº 1558", inspector: "OVIEDO JUAN", zona: "1", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "21/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "21/04/2026", nroIntimacion: "18206", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "ROCA ESQ. RIVADAVIA VEREDA SUROESTE", inspector: "OVIEDO JUAN", zona: "1", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "21/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "21/04/2026", nroIntimacion: "18207", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "ROCA ESQ. RIVADAVIA VEREDA SURESTE", inspector: "OVIEDO JUAN", zona: "1", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "21/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "21/04/2026", nroIntimacion: "18208", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "ROCA Nº 1425", inspector: "OVIEDO JUAN", zona: "1", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "21/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "22/04/2026", nroIntimacion: "18209", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "PERU Nº 1407", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "22/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "22/04/2026", nroIntimacion: "18210", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "PERU Nº 1455", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "22/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "22/04/2026", nroIntimacion: "18211", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "VELEZ SARFIELD Nº 1461", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "22/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "22/04/2026", nroIntimacion: "18212", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "VELEZ SARFIELD Nº 1464", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "22/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "22/04/2026", nroIntimacion: "18213", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "VELEZ SARFIELD Nº 1436", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "22/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "22/04/2026", nroIntimacion: "18214", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "VELEZ SARFIELD AL 1300 FRENTE Nº 1381", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "22/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "22/04/2026", nroIntimacion: "18215", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "VELEZ SARFIELD Nº 1347", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "22/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "22/04/2026", nroIntimacion: "18216", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "VELEZ SARFIELD Nº 1320", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "22/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "22/04/2026", nroIntimacion: "18217", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "VELEZ SARFIELD ESQ. BELGRANO VEREDA SUROESTE", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "22/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "23/04/2026", nroIntimacion: "18218", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "BELGRANO Nº 2482", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "23/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "23/04/2026", nroIntimacion: "18219", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "ITUZAINGO Nº 1362", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "23/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "23/04/2026", nroIntimacion: "18220", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "BOLIVAR Nº 2664", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "23/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "23/04/2026", nroIntimacion: "18221", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "BOLIVAR Nº 2472", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "23/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "23/04/2026", nroIntimacion: "18222", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "BELGRANO Y ITUZAINGO ESQ. NORESTE", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "23/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "23/04/2026", nroIntimacion: "18223", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "BELGRANO AL 2400 FRENTE A BELGRANO Nº 2426", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "23/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "23/04/2026", nroIntimacion: "18224", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "BELGRANO Nº 2252", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "23/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "23/04/2026", nroIntimacion: "18225", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "BELGRANO Nº 2248", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "23/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "24/04/2026", nroIntimacion: "18226", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "MORENO Nº 2151", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "24/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "24/04/2026", nroIntimacion: "18227", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "MORENO ESQ. PJE. LAFFONT", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "24/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "24/04/2026", nroIntimacion: "18228", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "MORENO Nº 2254", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "24/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "24/04/2026", nroIntimacion: "18229", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "MORENO Nº 2260", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "24/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "24/04/2026", nroIntimacion: "18230", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "MORENO Nº 2263", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "24/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "24/04/2026", nroIntimacion: "18231", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "MORENO ESQ. PERU", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "24/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
  { fechaIntimacion: "24/04/2026", nroIntimacion: "18232", responsable: "PROPIETARIO Y/O RESP. DE ADREMA", domicilio: "MORENO Nº 2389", inspector: "OVIEDO JUAN", zona: "", motivo: "PROCEDER A EL ARREGLO Y/O REPARACION DE LA VEREDA, PREVIO A LA SOLICITUD DE LOS PERMISOS MUNICIPALES CORRESPONDIENTES", plazo: "30", fechaVencimiento: "24/05/2026", observaciones: "OPERATIVO VEREDA FOGOP" },
];

// ─── Helper: formatear fecha de Excel ────────────────────────────────────────

function formatearFechaExcel(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string" && val.includes("/")) return val;
  if (typeof val === "number") {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      const d = String(date.d).padStart(2, "0");
      const m = String(date.m).padStart(2, "0");
      return `${d}/${m}/${date.y}`;
    }
  }
  if (val instanceof Date) {
    const d = String(val.getDate()).padStart(2, "0");
    const m = String(val.getMonth() + 1).padStart(2, "0");
    return `${d}/${m}/${val.getFullYear()}`;
  }
  return String(val);
}

// ─── Helper: parsear Excel a intimaciones ────────────────────────────────────

function parsearExcel(buffer: ArrayBuffer): Omit<Intimacion, "id">[] {
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

      const nro = get(["NRO. INTIM", "NRO INTIM", "NUMERO INTIM"]);
      if (!nro) return null;

      return {
        fechaIntimacion: formatearFechaExcel(r[Object.keys(r).find(k => k.toUpperCase().includes("FECHA INTIM")) ?? ""]),
        nroIntimacion: nro,
        responsable: get(["RESPONSABLE"]),
        domicilio: get(["DOMICILIO"]),
        inspector: get(["INSPECTOR"]),
        zona: get(["ZONA"]),
        motivo: get(["MOTIVO"]),
        plazo: get(["PLAZO"]),
        fechaVencimiento: formatearFechaExcel(r[Object.keys(r).find(k => k.toUpperCase().includes("VENCIM")) ?? ""]),
        observaciones: get(["OBSERVAC"]),
      } as Omit<Intimacion, "id">;
    })
    .filter(Boolean) as Omit<Intimacion, "id">[];
}

// ─── Helpers exportar ─────────────────────────────────────────────────────────

function formatFecha(ts: Timestamp | null): string {
  if (!ts) return "—";
  return ts.toDate().toLocaleString("es-AR");
}

function exportarHtml(filas: Record<string, string>[], nombre: string) {
  const encabezados = Object.keys(filas[0]);
  const filasTR = filas
    .map((f) => `<tr>${Object.values(f).map((v) => `<td>${v}</td>`).join("")}</tr>`)
    .join("");
  const html = `<table><tr>${encabezados.map((h) => `<th>${h}</th>`).join("")}</tr>${filasTR}</table>`;
  const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

function exportarExcelPedidos(
  obras: VeredaObra[],
  isAdmin: boolean,
  colsVisibles: Record<string, boolean>
) {
  if (obras.length === 0) return;
  const filas = obras.map((o) => {
    const base: Record<string, string> = {};
    if (colsVisibles.estado)        base["Estado"] = o.estado || "—";
    if (colsVisibles.nroIntimacion) base["Nro. Intimación"] = o.numeroBoleta;
    if (colsVisibles.nombreApellido) base["Nombre y Apellido"] = o.nombreApellido;
    if (colsVisibles.direccion)     base["Dirección"] = o.direccion;
    if (colsVisibles.barrio)        base["Barrio"] = o.barrio;
    if (colsVisibles.telefono)      base["Teléfono"] = (o as any).telefono || "";
    if (colsVisibles.observaciones) base["Observaciones"] = o.observaciones || "";
    if (colsVisibles.fecha)         base["Fecha y Hora"] = formatFecha(o.creadoEn);
    if (isAdmin)                    base["Cargado por"] = o.cargadoPor;
    if (colsVisibles.expMadre)      base["Exp. Madre"] = o.expMadre || "";
    if (colsVisibles.expHijo)       base["Exp. Hijo"] = o.expHijo || "";
    return base;
  });
  exportarHtml(filas, "pedidos_veredas.xls");
}

function exportarExcelIntimaciones(filas: Intimacion[]) {
  if (filas.length === 0) return;
  const mapped = filas.map((i) => ({
    "Fecha Intimación": i.fechaIntimacion,
    "Nro. Intimación": i.nroIntimacion,
    Responsable: i.responsable,
    Domicilio: i.domicilio,
    Inspector: i.inspector,
    Zona: i.zona,
    Motivo: i.motivo,
    "Plazo (días)": i.plazo,
    "Fecha Vencimiento": i.fechaVencimiento,
    Observaciones: i.observaciones,
  }));
  exportarHtml(mapped, "intimaciones_veredas.xls");
}

// ─── Componente principal ─────────────────────────────────────────────────────

const MapComponent = lazy(() => import("./IntimacionesMapa").catch(err => {
  console.error("Error al cargar mapa", err);
  return { default: () => <div className="p-4 bg-red-100 text-red-800 rounded-md">Error al cargar el módulo del mapa. Revisa tu conexión a internet y recarga la página.</div> };
}));

function ClientOnly({ children, fallback }: { children: ReactNode, fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}

export function Veredas() {
  const [activeTab, setActiveTab] = useState<VeredasTab>("pedidos");
  const [nrosIntimacion, setNrosIntimacion] = useState<Set<string>>(new Set());

  const actualizarNros = (lista: Intimacion[]) => {
    setNrosIntimacion(new Set(lista.map((i) => i.nroIntimacion)));
  };

  return (
    <div className="space-y-4">
      <div className="mb-6 flex border-b">
        {(["pedidos", "intimaciones"] as VeredasTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-5 py-2.5 text-sm font-medium capitalize transition-colors ${
              activeTab === t
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "pedidos" ? "Pedidos" : "Intimaciones"}
          </button>
        ))}
      </div>
      {activeTab === "pedidos" && <PedidosTab nrosIntimacion={nrosIntimacion} />}
      {activeTab === "intimaciones" && <IntimacionesTab onIntimacionesCargadas={actualizarNros} />}
    </div>
  );
}

// ─── Tab Pedidos ──────────────────────────────────────────────────────────────

const emptyForm = {
  estado: "" as EstadoObra,
  numeroBoleta: "",
  nombreApellido: "",
  direccion: "",
  barrio: "",
  observaciones: "",
  expMadre: "",
  expHijo: "",
  telefono: "",
};

function PedidosTab({ nrosIntimacion }: { nrosIntimacion: Set<string> }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canEstado = puedeEditarEstado(user?.username, user?.role);
  const canExp = puedeEditarExp(user?.username, user?.role);

  const [obras, setObras] = useState<VeredaObra[]>([]);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [filtroEstado, setFiltroEstado] = useState<EstadoObra | "">("");
  const [colsVisibles, setColsVisibles] = useState({
    estado: true,
    nroIntimacion: true,
    nombreApellido: true,
    direccion: true,
    barrio: true,
    telefono: true,
    observaciones: true,
    fecha: true,
    expMadre: true,
    expHijo: true,
    presupuesto: true,
  });
  const toggleCol = (col: keyof typeof colsVisibles) =>
    setColsVisibles((v) => ({ ...v, [col]: !v[col] }));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [pdfBase64, setPdfBase64] = useState("");
  const [pdfNombre, setPdfNombre] = useState("");
  const [pdfError, setPdfError] = useState("");

  const fetchObras = async () => {
    try {
      const q = query(collection(db, "veredas"), orderBy("creadoEn", "desc"));
      const snap = await getDocs(q);
      setObras(snap.docs.map((d) => ({ id: d.id, ...d.data() } as VeredaObra)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchObras(); }, []);

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPdfError("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { setPdfError("Solo se aceptan archivos PDF."); return; }
    if (file.size > 700 * 1024) { setPdfError("El PDF no puede superar los 700 KB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1];
      setPdfBase64(b64);
      setPdfNombre(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setEditForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    setError("");
    if (!form.numeroBoleta.trim() || !form.nombreApellido.trim() || !form.direccion.trim() || !form.barrio.trim()) {
      setError("Completá todos los campos obligatorios.");
      return;
    }
    if (form.estado === "Presupuesto" && !pdfBase64) {
      setError("Con estado Presupuesto debés adjuntar un PDF.");
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "veredas"), {
        ...form,
        cargadoPor: user?.username ?? "desconocido",
        expMadre: form.expMadre || "",
        expHijo: form.expHijo || "",
        presupuestoPdf: pdfBase64 || "",
        presupuestoPdfNombre: pdfNombre || "",
        creadoEn: serverTimestamp(),
      });
      setForm(emptyForm);
      setPdfBase64("");
      setPdfNombre("");
      setShowForm(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      fetchObras();
    } catch {
      setError("Error al guardar. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateDoc(doc(db, "veredas", id), { ...editForm });
      setEditingId(null);
      fetchObras();
    } catch {
      alert("Error al guardar los cambios.");
    }
  };

  const handleQuickUpdate = async (id: string, fields: Partial<VeredaObra>) => {
    try {
      await updateDoc(doc(db, "veredas", id), fields as Record<string, unknown>);
      fetchObras();
    } catch {
      alert("Error al actualizar.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminás esta obra?")) return;
    try {
      await deleteDoc(doc(db, "veredas", id));
      fetchObras();
    } catch {
      alert("Error al eliminar.");
    }
  };

  const [paginaPedidos, setPaginaPedidos] = useState(1);
  useEffect(() => { setPaginaPedidos(1); }, [filtroEstado]);

  const obrasFiltradas = useMemo(() => {
    if (!filtroEstado) return obras;
    return obras.filter((o) => o.estado === filtroEstado);
  }, [obras, filtroEstado]);

  const obrasPaginadasFinal = useMemo(() => {
    const inicio = (paginaPedidos - 1) * POR_PAGINA;
    return obrasFiltradas.slice(inicio, inicio + POR_PAGINA);
  }, [obrasFiltradas, paginaPedidos]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Pedidos de obras de veredas</h2>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => exportarExcelPedidos(obrasFiltradas, isAdmin, colsVisibles)}
              disabled={obrasFiltradas.length === 0}
              className="rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40"
            >
              Exportar Excel
            </button>
          )}
          <>
            <button
              onClick={() => {
                if (isAdmin) {
                  exportVeredasPedidosToPdf(obrasFiltradas, isAdmin, colsVisibles);
                } else {
                  setIsPasswordModalOpen(true);
                }
              }}
              disabled={obrasFiltradas.length === 0}
              className="rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40"
            >
              Exportar PDF
            </button>
            <PasswordPromptDialog
              isOpen={isPasswordModalOpen}
              onClose={() => setIsPasswordModalOpen(false)}
              onConfirm={() => exportVeredasPedidosToPdf(obrasFiltradas, isAdmin, colsVisibles)}
            />
          </>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-accent"
          >
            {showForm ? "Cancelar" : "+ Nueva obra"}
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Filtrar por estado</label>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as EstadoObra)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">Todos</option>
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        {filtroEstado && (
          <button onClick={() => setFiltroEstado("")} className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
            Limpiar
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {obrasFiltradas.length} de {obras.length} registros
        </span>
      </div>

      {success && (
        <div className="mb-4 rounded-md bg-green-100 px-4 py-2 text-sm text-green-800">
          Obra cargada correctamente.
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-1">
        {([
          ["estado","Estado"],["nroIntimacion","Nro."],["nombreApellido","Nombre"],
          ["direccion","Dirección"],["barrio","Barrio"],["telefono","Teléfono"],
          ["observaciones","Obs."],["fecha","Fecha"],["expMadre","Exp.Madre"],
          ["expHijo","Exp.Hijo"],["presupuesto","Presup."],
        ] as [keyof typeof colsVisibles, string][]).map(([col, label]) => (
          <button
            key={col}
            onClick={() => toggleCol(col)}
            className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
              colsVisibles[col]
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted text-muted-foreground border-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="mb-6 rounded-lg border bg-card p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Nueva obra de vereda</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {canEstado && (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Estado</label>
                <select name="estado" value={form.estado} onChange={handleChange} className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground">
                  <option value="">Sin estado</option>
                  {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Nro. Intimación *</label>
              <input name="numeroBoleta" value={form.numeroBoleta} onChange={handleChange} className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" placeholder="Ej: 18073" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Nombre y Apellido *</label>
              <input name="nombreApellido" value={form.nombreApellido} onChange={handleChange} className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" placeholder="Ej: Juan García" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Dirección *</label>
              <input name="direccion" value={form.direccion} onChange={handleChange} className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" placeholder="Ej: San Martín 456" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Barrio *</label>
              <input name="barrio" value={form.barrio} onChange={handleChange} className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" placeholder="Ej: Centro" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Teléfono (opcional)</label>
              <input name="telefono" value={form.telefono ?? ""} onChange={handleChange} className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" placeholder="Ej: 3794 123456" />
            </div>
            {canExp && (
              <>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Exp. Madre</label>
                  <input name="expMadre" value={form.expMadre} onChange={handleChange} className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" placeholder="Ej: 1234/2026" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Exp. Hijo</label>
                  <input name="expHijo" value={form.expHijo} onChange={handleChange} className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" placeholder="Ej: 5678/2026" />
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground">Observaciones (opcional)</label>
              <textarea name="observaciones" value={form.observaciones} onChange={handleChange} rows={3} className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm text-foreground" placeholder="Observaciones adicionales..." />
            </div>
            {form.estado === "Presupuesto" && canEstado && (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted-foreground">PDF de presupuesto (máx. 700 KB) *</label>
                <input ref={pdfRef} type="file" accept="application/pdf" onChange={handlePdfChange} className="w-full text-sm text-foreground" />
                {pdfNombre && <p className="mt-1 text-xs text-green-700">✓ {pdfNombre}</p>}
                {pdfError && <p className="mt-1 text-xs text-destructive">{pdfError}</p>}
              </div>
            )}
          </div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <div className="mt-4 flex justify-end">
            <button onClick={handleSubmit} disabled={submitting} className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-accent disabled:opacity-50">
              {submitting ? "Guardando..." : "Guardar obra"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : obrasFiltradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay obras para mostrar.</p>
      ) : (
        <>
        <div className="overflow-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                {colsVisibles.estado && <th className="px-3 py-2 font-medium text-foreground">Estado</th>}
                {colsVisibles.nroIntimacion && <th className="px-3 py-2 font-medium text-foreground">Nro. Intimación</th>}
                {colsVisibles.nombreApellido && <th className="px-3 py-2 font-medium text-foreground">Nombre y Apellido</th>}
                {colsVisibles.direccion && <th className="px-3 py-2 font-medium text-foreground">Dirección</th>}
                {colsVisibles.barrio && <th className="px-3 py-2 font-medium text-foreground">Barrio</th>}
                {colsVisibles.telefono && <th className="px-3 py-2 font-medium text-foreground">Teléfono</th>}
                {colsVisibles.observaciones && <th className="px-3 py-2 font-medium text-foreground">Observaciones</th>}
                {colsVisibles.fecha && <th className="px-3 py-2 font-medium text-foreground">Fecha y Hora</th>}
                {isAdmin && <th className="px-3 py-2 font-medium text-foreground">Cargado por</th>}
                {colsVisibles.expMadre && <th className="px-3 py-2 font-medium text-foreground">Exp. Madre</th>}
                {colsVisibles.expHijo && <th className="px-3 py-2 font-medium text-foreground">Exp. Hijo</th>}
                {colsVisibles.presupuesto && <th className="px-3 py-2 font-medium text-foreground">Presupuesto</th>}
                {isAdmin && <th className="px-3 py-2 font-medium text-foreground">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {obrasPaginadasFinal.map((o) => (
                <tr key={o.id} className="border-t hover:bg-muted/30">
                  {editingId === o.id ? (
                    <>
                      <td className="px-2 py-1.5">
                        {canEstado ? (
                          <select name="estado" value={editForm.estado} onChange={handleEditChange} className="w-full rounded border bg-background px-2 py-1 text-sm text-foreground">
                            <option value="">—</option>
                            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                          </select>
                        ) : (
                          <EstadoBadge estado={o.estado} />
                        )}
                      </td>
                      <td className="px-2 py-1.5"><input name="numeroBoleta" value={editForm.numeroBoleta} onChange={handleEditChange} className="w-24 rounded border bg-background px-2 py-1 text-sm text-foreground" /></td>
                      <td className="px-2 py-1.5"><input name="nombreApellido" value={editForm.nombreApellido} onChange={handleEditChange} className="w-full rounded border bg-background px-2 py-1 text-sm text-foreground" /></td>
                      <td className="px-2 py-1.5"><input name="direccion" value={editForm.direccion} onChange={handleEditChange} className="w-full rounded border bg-background px-2 py-1 text-sm text-foreground" /></td>
                      {colsVisibles.barrio && <td className="px-2 py-1.5"><input name="barrio" value={editForm.barrio} onChange={handleEditChange} className="w-24 rounded border bg-background px-2 py-1 text-sm text-foreground" /></td>}
                      {colsVisibles.telefono && <td className="px-2 py-1.5"><input name="telefono" value={(editForm as any).telefono ?? ""} onChange={handleEditChange} className="w-28 rounded border bg-background px-2 py-1 text-sm text-foreground" placeholder="Teléfono" /></td>}
                      {colsVisibles.observaciones && <td className="px-2 py-1.5"><input name="observaciones" value={editForm.observaciones} onChange={handleEditChange} className="w-full rounded border bg-background px-2 py-1 text-sm text-foreground" /></td>}
                      {colsVisibles.fecha && <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatFecha(o.creadoEn)}</td>}
                      {isAdmin && <td className="px-3 py-2 text-muted-foreground">{o.cargadoPor}</td>}
                      {colsVisibles.expMadre && <td className="px-2 py-1.5">
                        {canExp ? (
                          <input name="expMadre" value={editForm.expMadre} onChange={handleEditChange} className="w-24 rounded border bg-background px-2 py-1 text-sm text-foreground" />
                        ) : (
                          <span className="text-foreground">{o.expMadre || "—"}</span>
                        )}
                      </td>}
                      {colsVisibles.expHijo && <td className="px-2 py-1.5">
                        {canExp ? (
                          <input name="expHijo" value={editForm.expHijo} onChange={handleEditChange} className="w-24 rounded border bg-background px-2 py-1 text-sm text-foreground" />
                        ) : (
                          <span className="text-foreground">{o.expHijo || "—"}</span>
                        )}
                      </td>}
                      {colsVisibles.presupuesto && <td className="px-3 py-2">
                        {o.presupuestoPdf ? (
                          <span className="text-xs text-muted-foreground">Ya adjunto ✓</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>}
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button onClick={() => handleSaveEdit(o.id!)} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-accent">Aceptar</button>
                          <button onClick={() => setEditingId(null)} className="rounded-md border px-3 py-1 text-xs text-muted-foreground hover:bg-muted">Cancelar</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      {colsVisibles.estado && <td className="px-3 py-2">
                        {canEstado ? (
                          <select
                            value={o.estado || ""}
                            onChange={(e) => handleQuickUpdate(o.id!, { estado: e.target.value as EstadoObra })}
                            className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium focus:ring-1 ${o.estado ? ESTADO_COLORS[o.estado] : "bg-muted text-muted-foreground"}`}
                          >
                            <option value="">Sin estado</option>
                            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                          </select>
                        ) : (
                          <EstadoBadge estado={o.estado} />
                        )}
                      </td>}
                      {colsVisibles.nroIntimacion && <td className="px-3 py-2 text-foreground">
                        <div className="flex flex-col gap-0.5">
                          <span>{o.numeroBoleta}</span>
                          {nrosIntimacion.has(o.numeroBoleta.trim()) && (
  <span className="inline-flex w-fit items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
    ✓ en Intimaciones
  </span>
)}
                        </div>
                      </td>}
                      {colsVisibles.nombreApellido && <td className="px-3 py-2 text-foreground">{o.nombreApellido}</td>}
                      {colsVisibles.direccion && <td className="px-3 py-2 text-foreground">{o.direccion}</td>}
                      {colsVisibles.barrio && <td className="px-3 py-2 text-foreground">{o.barrio}</td>}
                      {colsVisibles.telefono && <td className="px-3 py-2 text-foreground">{(o as any).telefono || "—"}</td>}
                      {colsVisibles.observaciones && <td className="px-3 py-2 text-muted-foreground">{o.observaciones || "—"}</td>}
                      {colsVisibles.fecha && <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatFecha(o.creadoEn)}</td>}
                      {isAdmin && <td className="px-3 py-2 text-muted-foreground">{o.cargadoPor}</td>}
                      {colsVisibles.expMadre && <td className="px-3 py-2">
                        {canExp ? (
                          <EditableCell value={o.expMadre || ""} onSave={(v) => handleQuickUpdate(o.id!, { expMadre: v })} placeholder="—" />
                        ) : (
                          <span className="text-foreground">{o.expMadre || "—"}</span>
                        )}
                      </td>}
                      {colsVisibles.expHijo && <td className="px-3 py-2">
                        {canExp ? (
                          <EditableCell value={o.expHijo || ""} onSave={(v) => handleQuickUpdate(o.id!, { expHijo: v })} placeholder="—" />
                        ) : (
                          <span className="text-foreground">{o.expHijo || "—"}</span>
                        )}
                      </td>}
                      {colsVisibles.presupuesto && <td className="px-3 py-2">
                        <div className="flex flex-col gap-1.5">
                        {canEstado ? (
                          <PdfCell
                            obraId={o.id!}
                            pdfBase64={o.presupuestoPdf || ""}
                            pdfNombre={o.presupuestoPdfNombre || ""}
                            estado={o.estado}
                            onUploaded={(base64, nombre) =>
                              handleQuickUpdate(o.id!, { presupuestoPdf: base64, presupuestoPdfNombre: nombre })
                            }
                          />
                        ) : (
                          o.presupuestoPdf ? (
                            <button
                              title="Ver presupuesto"
                              onClick={() => {
                                const link = document.createElement("a");
                                link.href = `data:application/pdf;base64,${o.presupuestoPdf}`;
                                link.download = o.presupuestoPdfNombre || "presupuesto.pdf";
                                link.click();
                              }}
                              className="text-lg hover:opacity-70"
                            >
                              📄
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )
                        )}
                        {o.estado === "Presupuesto" && (
                          <label className="flex cursor-pointer items-center gap-1.5 text-xs select-none">
                            <input
                              type="checkbox"
                              checked={!!(o as any).presupuestoEnviado}
                              onChange={(e) =>
                                handleQuickUpdate(o.id!, { presupuestoEnviado: e.target.checked } as any)
                              }
                              className="h-3.5 w-3.5 rounded accent-primary"
                            />
                            <span className={(o as any).presupuestoEnviado ? "text-green-700 font-medium" : "text-muted-foreground"}>
                              {(o as any).presupuestoEnviado ? "✓ Enviado" : "Enviado"}
                            </span>
                          </label>
                        )}
                        </div>
                      </td>}
                      {isAdmin && (
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingId(o.id!);
                                setEditForm({
                                  estado: o.estado || "",
                                  numeroBoleta: o.numeroBoleta,
                                  nombreApellido: o.nombreApellido,
                                  direccion: o.direccion,
                                  barrio: o.barrio,
                                  observaciones: o.observaciones,
                                  expMadre: o.expMadre || "",
                                  expHijo: o.expHijo || "",
                                });
                              }}
                              className="text-xs text-primary hover:underline"
                            >
                              Editar
                            </button>
                            <button onClick={() => handleDelete(o.id!)} className="text-xs text-destructive hover:underline">Eliminar</button>
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
        <Paginador total={obrasFiltradas.length} pagina={paginaPedidos} setPagina={setPaginaPedidos} />
        </>
      )}
    </div>
  );
}


// ─── Paginador reutilizable ───────────────────────────────────────────────────

const POR_PAGINA = 50;

function Paginador({
  total,
  pagina,
  setPagina,
}: {
  total: number;
  pagina: number;
  setPagina: (p: number) => void;
}) {
  const totalPaginas = Math.ceil(total / POR_PAGINA);
  if (totalPaginas <= 1) return null;
  const desde = (pagina - 1) * POR_PAGINA + 1;
  const hasta = Math.min(pagina * POR_PAGINA, total);
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
      <span>{desde}–{hasta} de {total} registros</span>
      <div className="flex gap-1">
        <button
          onClick={() => setPagina(1)}
          disabled={pagina === 1}
          className="rounded border px-2 py-1 hover:bg-muted disabled:opacity-30"
        >«</button>
        <button
          onClick={() => setPagina(pagina - 1)}
          disabled={pagina === 1}
          className="rounded border px-2 py-1 hover:bg-muted disabled:opacity-30"
        >‹</button>
        {Array.from({ length: totalPaginas }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPaginas || Math.abs(p - pagina) <= 1)
          .reduce<(number | "...")[]>((acc, p, i, arr) => {
            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === "..." ? (
              <span key={`e${i}`} className="px-2 py-1">…</span>
            ) : (
              <button
                key={p}
                onClick={() => setPagina(p as number)}
                className={`rounded border px-2 py-1 hover:bg-muted ${pagina === p ? "bg-primary text-primary-foreground border-primary" : ""}`}
              >
                {p}
              </button>
            )
          )}
        <button
          onClick={() => setPagina(pagina + 1)}
          disabled={pagina === totalPaginas}
          className="rounded border px-2 py-1 hover:bg-muted disabled:opacity-30"
        >›</button>
        <button
          onClick={() => setPagina(totalPaginas)}
          disabled={pagina === totalPaginas}
          className="rounded border px-2 py-1 hover:bg-muted disabled:opacity-30"
        >»</button>
      </div>
    </div>
  );
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function EstadoBadge({ estado }: { estado: EstadoObra }) {
  if (!estado) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLORS[estado] ?? "bg-muted text-muted-foreground"}`}>
      {estado}
    </span>
  );
}

function EditableCell({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  const commit = () => {
    setEditing(false);
    if (local !== value) onSave(local);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setLocal(value); setEditing(false); } }}
        className="w-28 rounded border bg-background px-2 py-0.5 text-sm text-foreground"
      />
    );
  }

  return (
    <button onClick={() => { setLocal(value); setEditing(true); }} className="group flex items-center gap-1 text-sm text-foreground hover:text-primary" title="Clic para editar">
      <span>{value || <span className="text-muted-foreground">{placeholder}</span>}</span>
      <span className="opacity-0 group-hover:opacity-100 text-xs text-muted-foreground">✎</span>
    </button>
  );
}

function PdfCell({ pdfBase64, pdfNombre, estado, onUploaded }: {
  obraId: string;
  pdfBase64: string;
  pdfNombre: string;
  estado: EstadoObra;
  onUploaded: (base64: string, nombre: string) => void;
}) {
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { setError("Solo PDF."); return; }
    if (file.size > 700 * 1024) { setError("Máx. 700 KB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1];
      onUploaded(b64, file.name);
    };
    reader.readAsDataURL(file);
  };

  const descargar = () => {
    const link = document.createElement("a");
    link.href = `data:application/pdf;base64,${pdfBase64}`;
    link.download = pdfNombre || "presupuesto.pdf";
    link.click();
  };

  if (estado !== "Presupuesto") {
    return pdfBase64 ? (
      <button onClick={descargar} title="Descargar presupuesto" className="text-lg hover:opacity-70">📄</button>
    ) : (
      <span className="text-xs text-muted-foreground">—</span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {pdfBase64 ? (
        <div className="flex items-center gap-2">
          <button onClick={descargar} title="Descargar presupuesto" className="text-lg hover:opacity-70">📄</button>
          <button onClick={() => inputRef.current?.click()} className="text-xs text-primary hover:underline">Cambiar</button>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} className="rounded-md border px-2 py-1 text-xs text-foreground hover:bg-muted">+ Adjuntar PDF</button>
      )}
      <input ref={inputRef} type="file" accept="application/pdf" onChange={handleFile} className="hidden" />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── Tab Intimaciones ─────────────────────────────────────────────────────────

function IntimacionesTab({ onIntimacionesCargadas }: { onIntimacionesCargadas: (lista: Intimacion[]) => void }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [intiTab, setIntiTab] = useState<IntiTab>("tabla");
  const [intimaciones, setIntimaciones] = useState<Intimacion[]>([]);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroNro, setFiltroNro] = useState("");
  const [filtroDomicilio, setFiltroDomicilio] = useState("");
  const [filtroVencidos, setFiltroVencidos] = useState(false);
  const excelRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Intimacion>>({});

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateDoc(doc(db, "intimaciones", id), { ...editForm });
      setEditingId(null);
      await fetchIntimaciones();
    } catch {
      alert("Error al guardar los cambios.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminás esta intimación?")) return;
    try {
      await deleteDoc(doc(db, "intimaciones", id));
      await fetchIntimaciones();
    } catch {
      alert("Error al eliminar.");
    }
  };

  const fetchIntimaciones = async () => {
    try {
      const snap = await getDocs(collection(db, "intimaciones"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Intimacion));
      data.sort((a, b) => Number(a.nroIntimacion) - Number(b.nroIntimacion));
      setIntimaciones(data);
onIntimacionesCargadas(data);
      return data;
    } catch (e) {
      console.error(e);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const data = await fetchIntimaciones();
      if (data.length === 0) {
        const batch = writeBatch(db);
        SEED_INTIMACIONES.forEach((item) => {
          const ref = doc(collection(db, "intimaciones"), `intim_${item.nroIntimacion}`);
          batch.set(ref, item);
        });
        await batch.commit();
        await fetchIntimaciones();
      }
    })();
  }, []);

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg("");
    try {
      const buffer = await file.arrayBuffer();
      const nuevos = parsearExcel(buffer);

      if (nuevos.length === 0) {
        setUploadMsg("No se encontraron filas válidas en el archivo.");
        setUploading(false);
        return;
      }

      const batch = writeBatch(db);
      let actualizados = 0;
      let agregados = 0;

      const snapExistentes = await getDocs(collection(db, "intimaciones"));
      const existentesPorNro: Record<string, string> = {};
      snapExistentes.forEach((d) => {
        const data = d.data() as Intimacion;
        existentesPorNro[data.nroIntimacion] = d.id;
      });

      nuevos.forEach((item) => {
        if (existentesPorNro[item.nroIntimacion]) {
          const ref = doc(db, "intimaciones", existentesPorNro[item.nroIntimacion]);
          batch.update(ref, item as Record<string, unknown>);
          actualizados++;
        } else {
          const ref = doc(collection(db, "intimaciones"), `intim_${item.nroIntimacion}`);
          batch.set(ref, item);
          agregados++;
        }
      });

      await batch.commit();
      await fetchIntimaciones();
      setUploadMsg(`✓ ${agregados} nuevos agregados, ${actualizados} actualizados.`);
      setTimeout(() => setUploadMsg(""), 5000);
    } catch (err) {
      console.error(err);
      setUploadMsg("Error al procesar el archivo. Verificá que sea el formato correcto.");
    } finally {
      setUploading(false);
      if (excelRef.current) excelRef.current.value = "";
    }
  };

  const fechasUnicas = useMemo(() => {
    const s = new Set(intimaciones.map((i) => i.fechaIntimacion).filter(Boolean));
    return Array.from(s).sort((a, b) => {
      const partsA = a.split("/");
      const partsB = b.split("/");
      const dateA = partsA.length === 3 ? new Date(Number(partsA[2]), Number(partsA[1]) - 1, Number(partsA[0])) : new Date(0);
      const dateB = partsB.length === 3 ? new Date(Number(partsB[2]), Number(partsB[1]) - 1, Number(partsB[0])) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [intimaciones]);

  const hoy = new Date();
hoy.setHours(0, 0, 0, 0);

const [paginaInti, setPaginaInti] = useState(1);

  useEffect(() => { setPaginaInti(1); }, [filtroFecha, filtroNro, filtroDomicilio, filtroVencidos]);

  const resultados = useMemo(() => {
  return intimaciones.filter((i) => {
    if (filtroFecha && i.fechaIntimacion !== filtroFecha) return false;
    if (filtroNro && !i.nroIntimacion.includes(filtroNro.trim())) return false;
    if (filtroDomicilio && !i.domicilio.toLowerCase().includes(filtroDomicilio.toLowerCase().trim())) return false;
    if (filtroVencidos) {
      if (!i.fechaVencimiento) return false;
      const partes = i.fechaVencimiento.split("/");
      if (partes.length !== 3) return false;
      const [d, m, a] = partes.map(Number);
      const fv = new Date(a, m - 1, d);
      if (isNaN(fv.getTime())) return false;
      if (fv >= hoy) return false;
    }
    return true;
  });
}, [intimaciones, filtroFecha, filtroNro, filtroDomicilio, filtroVencidos]);

  const resultadosPaginados = useMemo(() => {
    const inicio = (paginaInti - 1) * POR_PAGINA;
    return resultados.slice(inicio, inicio + POR_PAGINA);
  }, [resultados, paginaInti]);

  return (
    <div>
      {/* ── Sub-pestañas: Tabla / Mapa ── */}
      <div className="mb-4 flex border-b">
        {(["tabla", "mapa"] as IntiTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setIntiTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              intiTab === t
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "tabla" ? "📋 Tabla" : "🗺️ Mapa"}
          </button>
        ))}
      </div>

      {/* ── Vista Mapa ── */}
      {intiTab === "mapa" && (
        <ClientOnly fallback={<div className="py-8 text-center text-sm text-muted-foreground">Cargando mapa...</div>}>
          <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Cargando mapa...</div>}>
            <MapComponent intimaciones={resultados} isAdmin={isAdmin} />
          </Suspense>
        </ClientOnly>
      )}

      {/* ── Vista Tabla ── */}
      {intiTab === "tabla" && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-foreground">Intimaciones — Operativo Veredas FOGOP</h2>
            <div className="flex gap-2">
              {isAdmin && (
                <>
                  <button
                    onClick={() => excelRef.current?.click()}
                    disabled={uploading}
                    className="rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    {uploading ? "Procesando..." : "↑ Actualizar con Excel"}
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
                <button
                  onClick={() => exportarExcelIntimaciones(resultados)}
                  disabled={resultados.length === 0}
                  className="rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40"
                >
                  Exportar Excel
                </button>
              )}
              <>
                <button
                  onClick={() => {
                    if (isAdmin) {
                      exportVeredasIntimacionesToPdf(resultados);
                    } else {
                      setIsPasswordModalOpen(true);
                    }
                  }}
                  disabled={resultados.length === 0}
                  className="rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40"
                >
                  Exportar PDF
                </button>
                <PasswordPromptDialog
                  isOpen={isPasswordModalOpen}
                  onClose={() => setIsPasswordModalOpen(false)}
                  onConfirm={() => exportVeredasIntimacionesToPdf(resultados)}
                />
              </>
            </div>
          </div>

          {uploadMsg && (
            <div className={`mb-4 rounded-md px-4 py-2 text-sm ${uploadMsg.startsWith("✓") ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
              {uploadMsg}
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Fecha</label>
              <select value={filtroFecha} onChange={(e) => setFiltroFecha(e.target.value)} className="rounded-md border bg-background px-3 py-1.5 text-sm text-foreground">
                <option value="">Todas</option>
                {fechasUnicas.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Nro. Intimación</label>
              <input value={filtroNro} onChange={(e) => setFiltroNro(e.target.value)} placeholder="Ej: 18073" className="rounded-md border bg-background px-3 py-1.5 text-sm text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Domicilio</label>
              <input value={filtroDomicilio} onChange={(e) => setFiltroDomicilio(e.target.value)} placeholder="Ej: Brasil" className="rounded-md border bg-background px-3 py-1.5 text-sm text-foreground w-48" />
            </div>
            <button
  onClick={() => setFiltroVencidos((v) => !v)}
  className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
    filtroVencidos
      ? "bg-red-100 border-red-300 text-red-700"
      : "text-muted-foreground hover:bg-muted"
  }`}
>
  {filtroVencidos ? "🔴 Vencidos" : "Ver vencidos"}
</button>
<button onClick={() => { setFiltroFecha(""); setFiltroNro(""); setFiltroDomicilio(""); setFiltroVencidos(false); }} className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">
  Limpiar
</button>
            <span className="ml-auto text-xs text-muted-foreground">{resultados.length} de {intimaciones.length} registros</span>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : resultados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin resultados para los filtros aplicados.</p>
          ) : (
            <>
            <div className="overflow-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2 font-medium text-foreground">Fecha</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium text-foreground">Nro.</th>
                    <th className="px-3 py-2 font-medium text-foreground">Domicilio</th>
                    <th className="px-3 py-2 font-medium text-foreground">Inspector</th>
                    <th className="px-3 py-2 font-medium text-foreground">Zona</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium text-foreground">Plazo</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium text-foreground">Vencimiento</th>
                    <th className="px-3 py-2 font-medium text-foreground">Observaciones</th>
                    {isAdmin && <th className="px-3 py-2 font-medium text-foreground">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {resultadosPaginados.map((i) => (
                    <tr key={i.id ?? i.nroIntimacion} className="border-t hover:bg-muted/40">
                      {editingId === i.id ? (
                        <>
                          <td className="px-2 py-1.5"><input name="fechaIntimacion" value={editForm.fechaIntimacion || ""} onChange={handleEditChange} className="w-24 rounded border bg-background px-2 py-1 text-sm text-foreground" /></td>
                          <td className="px-2 py-1.5"><input name="nroIntimacion" value={editForm.nroIntimacion || ""} onChange={handleEditChange} className="w-20 rounded border bg-background px-2 py-1 text-sm text-foreground" /></td>
                          <td className="px-2 py-1.5"><input name="domicilio" value={editForm.domicilio || ""} onChange={handleEditChange} className="w-full rounded border bg-background px-2 py-1 text-sm text-foreground" /></td>
                          <td className="px-2 py-1.5"><input name="inspector" value={editForm.inspector || ""} onChange={handleEditChange} className="w-full rounded border bg-background px-2 py-1 text-sm text-foreground" /></td>
                          <td className="px-2 py-1.5"><input name="zona" value={editForm.zona || ""} onChange={handleEditChange} className="w-12 rounded border bg-background px-2 py-1 text-sm text-foreground" /></td>
                          <td className="px-2 py-1.5"><input name="plazo" value={editForm.plazo || ""} onChange={handleEditChange} className="w-16 rounded border bg-background px-2 py-1 text-sm text-foreground" /></td>
                          <td className="px-2 py-1.5"><input name="fechaVencimiento" value={editForm.fechaVencimiento || ""} onChange={handleEditChange} className="w-24 rounded border bg-background px-2 py-1 text-sm text-foreground" /></td>
                          <td className="px-2 py-1.5"><input name="observaciones" value={editForm.observaciones || ""} onChange={handleEditChange} className="w-full rounded border bg-background px-2 py-1 text-sm text-foreground" /></td>
                          <td className="px-3 py-2">
                            <div className="flex gap-2">
                              <button onClick={() => handleSaveEdit(i.id!)} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-accent">Aceptar</button>
                              <button onClick={() => setEditingId(null)} className="rounded-md border px-3 py-1 text-xs text-muted-foreground hover:bg-muted">Cancelar</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="whitespace-nowrap px-3 py-2 text-foreground">{i.fechaIntimacion}</td>
                          <td className="px-3 py-2 text-foreground">{i.nroIntimacion}</td>
                          <td className="px-3 py-2 text-foreground">{i.domicilio}</td>
                          <td className="px-3 py-2 text-foreground">{i.inspector}</td>
                          <td className="px-3 py-2 text-foreground">{i.zona || "—"}</td>
                          <td className="px-3 py-2 text-foreground">{i.plazo} días</td>
                          <td className="whitespace-nowrap px-3 py-2 text-foreground">{i.fechaVencimiento}</td>
                          <td className="px-3 py-2 text-muted-foreground">{i.observaciones || "—"}</td>
                          {isAdmin && (
                            <td className="px-3 py-2">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingId(i.id!);
                                    setEditForm({
                                      fechaIntimacion: i.fechaIntimacion || "",
                                      nroIntimacion: i.nroIntimacion || "",
                                      domicilio: i.domicilio || "",
                                      inspector: i.inspector || "",
                                      zona: i.zona || "",
                                      plazo: i.plazo || "",
                                      fechaVencimiento: i.fechaVencimiento || "",
                                      observaciones: i.observaciones || "",
                                    });
                                  }}
                                  className="text-xs text-primary hover:underline"
                                >
                                  Editar
                                </button>
                                <button onClick={() => handleDelete(i.id!)} className="text-xs text-destructive hover:underline">Eliminar</button>
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
            <Paginador total={resultados.length} pagina={paginaInti} setPagina={setPaginaInti} />
            </>
          )}
        </div>
      )}
    </div>
  );
}