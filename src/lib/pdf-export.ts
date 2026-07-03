import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Obra } from "@/data/obras";
import type { Relevamiento } from "@/components/Relevamientos";
import type { VeredaObra, Intimacion } from "@/components/Veredas";

export function exportObrasToPdf(obras: Obra[], filename = "obras_fogop.pdf") {
  const doc = new jsPDF({
    orientation: "landscape",
    encryption: {
      userPassword: "",
      ownerPassword: "Augustoelmascapo",
      userPermissions: ["print"]
    }
  });
  
  // Título
  doc.setFontSize(16);
  doc.text("Reporte de Obras Públicas - FOGOP", 14, 15);
  doc.setFontSize(10);
  doc.text(`Generado el: ${new Date().toLocaleString("es-AR")}`, 14, 22);

  const columns = [
    { header: "Acta", dataKey: "acta" },
    { header: "Año", dataKey: "anio" },
    { header: "Fecha", dataKey: "fecha" },
    { header: "Expte. Madre", dataKey: "expteMadre" },
    { header: "Expte. Hijo", dataKey: "expteHijo" },
    { header: "Tipo de Obra", dataKey: "tipoObra" },
    { header: "Dirección", dataKey: "direccion" },
    { header: "Puntos", dataKey: "puntos" },
    { header: "Estado", dataKey: "estado" },
  ];

  const rows = obras.map((o) => ({
    acta: o.acta || "—",
    anio: o.anio,
    fecha: o.fecha || "—",
    expteMadre: o.expteMadre,
    expteHijo: o.expteHijo || "—",
    tipoObra: o.tipoObra,
    direccion: o.direccion,
    puntos: o.puntos || "—",
    estado: o.estado,
  }));

  autoTable(doc, {
    columns,
    body: rows,
    startY: 28,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42] }, // Gris oscuro slate-900
    styles: { fontSize: 8 },
    didDrawPage: (data) => {
      // Marca de agua
      const pageSize = doc.internal.pageSize;
      const pageWidth = pageSize.getWidth();
      const pageHeight = pageSize.getHeight();
      
      const originalColor = doc.getTextColor();
      doc.setTextColor(220, 220, 220); // Gris claro
      doc.setFontSize(36);
      doc.setFont("helvetica", "bold");
      
      // Marca de agua en diagonal en el centro de la página
      doc.text("Augusto N. Valentinotti", pageWidth / 2, pageHeight / 2, {
        angle: 315,
        align: "center",
        baseline: "middle"
      });
      
      // Restaurar estilos
      doc.setTextColor(originalColor);
    }
  });

  doc.save(filename);
}

export function exportAccessLogToPdf(
  log: { username: string; role: string; loginAt: string }[],
  filename = "registro_accesos.pdf"
) {
  const doc = new jsPDF({
    orientation: "portrait",
    encryption: {
      userPassword: "",
      ownerPassword: "Augustoelmascapo",
      userPermissions: ["print"]
    }
  });
  
  doc.setFontSize(16);
  doc.text("Registro de Accesos - FOGOP", 14, 15);
  doc.setFontSize(10);
  doc.text(`Generado el: ${new Date().toLocaleString("es-AR")}`, 14, 22);

  const columns = [
    { header: "Usuario", dataKey: "username" },
    { header: "Rol", dataKey: "role" },
    { header: "Fecha y Hora", dataKey: "loginAt" },
  ];

  const rows = log.map((e) => ({
    username: e.username,
    role: e.role === "admin" ? "Administrador" : "Usuario",
    loginAt: new Date(e.loginAt).toLocaleString("es-AR"),
  }));

  autoTable(doc, {
    columns,
    body: rows,
    startY: 28,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 9 },
    didDrawPage: (data) => {
      const pageSize = doc.internal.pageSize;
      const pageWidth = pageSize.getWidth();
      const pageHeight = pageSize.getHeight();
      
      const originalColor = doc.getTextColor();
      doc.setTextColor(220, 220, 220);
      doc.setFontSize(36);
      doc.setFont("helvetica", "bold");
      
      doc.text("Augusto N. Valentinotti", pageWidth / 2, pageHeight / 2, {
        angle: 315,
        align: "center",
        baseline: "middle"
      });
      
      doc.setTextColor(originalColor);
    }
  });

  doc.save(filename);
}

// Marca de agua helper para las nuevas funciones
function drawWatermark(doc: jsPDF) {
  const pageSize = doc.internal.pageSize;
  const pageWidth = pageSize.getWidth();
  const pageHeight = pageSize.getHeight();
  
  const originalColor = doc.getTextColor();
  doc.setTextColor(220, 220, 220); // Gris claro
  doc.setFontSize(36);
  doc.setFont("helvetica", "bold");
  
  doc.text("Augusto N. Valentinotti", pageWidth / 2, pageHeight / 2, {
    angle: 315,
    align: "center",
    baseline: "middle"
  });
  
  doc.setTextColor(originalColor);
}

export function exportRelevamientosToPdf(filas: Relevamiento[], isAdmin: boolean, filename = "relevamientos.pdf") {
  if (filas.length === 0) return;
  const doc = new jsPDF({
    orientation: "portrait",
    encryption: {
      userPassword: "",
      ownerPassword: "Augustoelmascapo",
      userPermissions: ["print"]
    }
  });
  
  doc.setFontSize(16);
  doc.text("Reporte de Relevamientos - FOGOP", 14, 15);
  doc.setFontSize(10);
  doc.text(`Generado el: ${new Date().toLocaleString("es-AR")}`, 14, 22);

  const columns = [
    { header: "Fecha", dataKey: "fecha" },
    { header: "Calle", dataKey: "calle" },
    { header: "Altura", dataKey: "altura" },
    { header: "Obra", dataKey: "obra" },
    { header: "Observaciones", dataKey: "observaciones" },
  ];
  if (isAdmin) {
    columns.push({ header: "Cargado por", dataKey: "cargadoPor" });
  }

  const formatFechaRelevamiento = (ts: any): string => {
    if (!ts) return "—";
    if (typeof ts.toDate === "function") return ts.toDate().toLocaleString("es-AR");
    return new Date(ts).toLocaleString("es-AR");
  };

  const rows = filas.map((r) => {
    const base: any = {
      fecha: formatFechaRelevamiento(r.creadoEn),
      calle: r.calle,
      altura: r.altura || "—",
      obra: r.obra,
      observaciones: r.observaciones || "—",
    };
    if (isAdmin) base.cargadoPor = r.cargadoPor;
    return base;
  });

  autoTable(doc, {
    columns,
    body: rows,
    startY: 28,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42] },
    didDrawPage: () => drawWatermark(doc)
  });

  doc.save(filename);
}

export function exportVeredasPedidosToPdf(
  obras: VeredaObra[],
  isAdmin: boolean,
  colsVisibles: Record<string, boolean>,
  filename = "pedidos_veredas.pdf"
) {
  if (obras.length === 0) return;
  const doc = new jsPDF({
    orientation: "landscape",
    encryption: {
      userPassword: "",
      ownerPassword: "Augustoelmascapo",
      userPermissions: ["print"]
    }
  });
  
  doc.setFontSize(16);
  doc.text("Pedidos de Obras de Veredas - FOGOP", 14, 15);
  doc.setFontSize(10);
  doc.text(`Generado el: ${new Date().toLocaleString("es-AR")}`, 14, 22);

  const columns: { header: string; dataKey: string }[] = [];
  if (colsVisibles.estado)        columns.push({ header: "Estado", dataKey: "estado" });
  if (colsVisibles.nroIntimacion) columns.push({ header: "Nro. Intimación", dataKey: "numeroBoleta" });
  if (colsVisibles.nombreApellido) columns.push({ header: "Nombre y Apellido", dataKey: "nombreApellido" });
  if (colsVisibles.direccion)     columns.push({ header: "Dirección", dataKey: "direccion" });
  if (colsVisibles.barrio)        columns.push({ header: "Barrio", dataKey: "barrio" });
  if (colsVisibles.telefono)      columns.push({ header: "Teléfono", dataKey: "telefono" });
  if (colsVisibles.observaciones) columns.push({ header: "Observaciones", dataKey: "observaciones" });
  if (colsVisibles.fecha)         columns.push({ header: "Fecha y Hora", dataKey: "fecha" });
  if (isAdmin)                    columns.push({ header: "Cargado por", dataKey: "cargadoPor" });
  if (colsVisibles.expMadre)      columns.push({ header: "Exp. Madre", dataKey: "expMadre" });
  if (colsVisibles.expHijo)       columns.push({ header: "Exp. Hijo", dataKey: "expHijo" });

  const formatFechaVereda = (ts: any): string => {
    if (!ts) return "—";
    if (typeof ts.toDate === "function") return ts.toDate().toLocaleString("es-AR");
    return new Date(ts).toLocaleString("es-AR");
  };

  const rows = obras.map((o) => ({
    estado: o.estado || "—",
    numeroBoleta: o.numeroBoleta || "—",
    nombreApellido: o.nombreApellido || "—",
    direccion: o.direccion || "—",
    barrio: o.barrio || "—",
    telefono: o.telefono || "—",
    observaciones: o.observaciones || "—",
    fecha: formatFechaVereda(o.creadoEn),
    cargadoPor: o.cargadoPor || "—",
    expMadre: o.expMadre || "—",
    expHijo: o.expHijo || "—",
  }));

  autoTable(doc, {
    columns,
    body: rows,
    startY: 28,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 8 },
    didDrawPage: () => drawWatermark(doc)
  });

  doc.save(filename);
}

export function exportVeredasIntimacionesToPdf(filas: Intimacion[], filename = "intimaciones_veredas.pdf") {
  if (filas.length === 0) return;
  const doc = new jsPDF({
    orientation: "landscape",
    encryption: {
      userPassword: "",
      ownerPassword: "Augustoelmascapo",
      userPermissions: ["print"]
    }
  });
  
  doc.setFontSize(16);
  doc.text("Intimaciones de Veredas - FOGOP", 14, 15);
  doc.setFontSize(10);
  doc.text(`Generado el: ${new Date().toLocaleString("es-AR")}`, 14, 22);

  const columns = [
    { header: "Fecha Intimación", dataKey: "fechaIntimacion" },
    { header: "Nro. Intimación", dataKey: "nroIntimacion" },
    { header: "Responsable", dataKey: "responsable" },
    { header: "Domicilio", dataKey: "domicilio" },
    { header: "Inspector", dataKey: "inspector" },
    { header: "Zona", dataKey: "zona" },
    { header: "Motivo", dataKey: "motivo" },
    { header: "Plazo (días)", dataKey: "plazo" },
    { header: "Fecha Vencimiento", dataKey: "fechaVencimiento" },
    { header: "Observaciones", dataKey: "observaciones" },
  ];

  const rows = filas.map((i) => ({
    fechaIntimacion: i.fechaIntimacion || "—",
    nroIntimacion: i.nroIntimacion || "—",
    responsable: i.responsable || "—",
    domicilio: i.domicilio || "—",
    inspector: i.inspector || "—",
    zona: i.zona || "—",
    motivo: i.motivo || "—",
    plazo: i.plazo || "—",
    fechaVencimiento: i.fechaVencimiento || "—",
    observaciones: i.observaciones || "—",
  }));

  autoTable(doc, {
    columns,
    body: rows,
    startY: 28,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42] },
    styles: { fontSize: 8 },
    didDrawPage: () => drawWatermark(doc)
  });

  doc.save(filename);
}
