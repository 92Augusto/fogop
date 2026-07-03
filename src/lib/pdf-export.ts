import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Obra } from "@/data/obras";

export function exportObrasToPdf(obras: Obra[], filename = "obras_fogop.pdf") {
  const doc = new jsPDF("landscape");
  
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
  const doc = new jsPDF();
  
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
