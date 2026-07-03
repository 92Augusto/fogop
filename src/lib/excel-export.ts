import * as XLSX from "xlsx";
import type { Obra } from "@/data/obras";

export function exportObrasToExcel(obras: Obra[], filename = "obras_fogop.xlsx") {
  const data = obras.map((o) => ({
    Acta: o.acta || "",
    Año: o.anio,
    Fecha: o.fecha || "",
    "Expte. Madre": o.expteMadre,
    "Expte. Hijo": o.expteHijo,
    "Tipo de Obra": o.tipoObra,
    Ubicación: o.ubicacion,
    Dirección: o.direccion,
    Puntos: o.puntos,
    Estado: o.estado,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Obras");
  XLSX.writeFile(wb, filename);
}

export function exportAccessLogToExcel(
  log: { username: string; role: string; loginAt: string }[],
  filename = "registro_accesos.xlsx"
) {
  const data = log.map((e) => ({
    Usuario: e.username,
    Rol: e.role === "admin" ? "Administrador" : "Usuario",
    "Fecha y Hora": new Date(e.loginAt).toLocaleString("es-AR"),
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Accesos");
  XLSX.writeFile(wb, filename);
}
