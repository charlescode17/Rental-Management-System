import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ReportRow = {
  building: string;
  room: string;
  tenantName: string;
  paymentDate: string;
  monthsCovered: number;
  amount: number;
  status: string;
};

function safeFilename(name: string) {
  return name.replace(/[^a-z0-9\-_.]/gi, "_");
}

// ---------- EXCEL ----------

export async function exportPaymentsToExcel(
  rows: ReportRow[],
  options: {
    title?: string;
    filename?: string;
    dateRangeLabel?: string;
  } = {},
) {
  const title = options.title || "Rent Report";
  const generated = new Date().toLocaleString();
  const total = rows.reduce((s, r) => s + (r.amount || 0), 0);

  const header = [
    "Building",
    "Room",
    "Tenant",
    "Payment Date",
    "Months Covered",
    "Status",
    "Amount (RWF)",
  ];

  const topRows: any[][] = [[title]];
  if (options.dateRangeLabel) {
    topRows.push([options.dateRangeLabel]);
  }
  topRows.push([`Generated: ${generated}`]);
  topRows.push([]);

  const aoa: any[][] = [
    ...topRows,
    header,
    ...rows.map((r) => [
      r.building,
      r.room,
      r.tenantName,
      r.paymentDate,
      r.monthsCovered,
      r.status,
      r.amount,
    ]),
    [],
    ["", "", "", "", "", "Total", total],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!cols"] = [
    { wch: 16 },
    { wch: 10 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 16 },
  ];

  const headerRowIdx = topRows.length; // 0-based index of the real header row
  ws["!merges"] = [];
  for (let r = 0; r < headerRowIdx - 1; r++) {
    ws["!merges"].push({ s: { r, c: 0 }, e: { r, c: header.length - 1 } });
  }

  const totalRowIdx = aoa.length - 1;

  const titleCell = ws["A1"];
  if (titleCell) {
    titleCell.s = { font: { bold: true, sz: 14, color: { rgb: "2F6F5E" } } };
  }
  for (let r = 1; r < headerRowIdx - 1; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[addr]) {
      ws[addr].s = { font: { italic: true, sz: 9, color: { rgb: "6B7280" } } };
    }
  }

  for (let c = 0; c < header.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "2F6F5E" } },
        alignment: { horizontal: "left" },
      };
    }
  }

  const amountCol = header.length - 1;
  for (let r = headerRowIdx + 1; r <= totalRowIdx; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: amountCol });
    if (ws[addr] && typeof ws[addr].v === "number") {
      ws[addr].z = "#,##0";
    }
  }

  for (let c = 0; c < header.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: totalRowIdx, c });
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true, color: { rgb: "2F6F5E" } },
        border: { top: { style: "thin", color: { rgb: "2F6F5E" } } },
      };
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Payments");

  const filename =
    options.filename || `rent-report-${safeFilename(title)}.xlsx`;
  XLSX.writeFile(wb, filename, { cellStyles: true });
}

// ---------- PDF ----------

export async function exportPaymentsToPDF(
  rows: ReportRow[],
  options: {
    title?: string;
    filename?: string;
    total?: number;
    dateRangeLabel?: string; // e.g. "Jan 1, 2026 – Jun 30, 2026" — only set for custom range reports
  } = {},
) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const BRAND: [number, number, number] = [47, 111, 94]; // #2F6F5E
  const BRAND_TINT: [number, number, number] = [235, 243, 240];
  const TEXT_MUTED: [number, number, number] = [107, 114, 128];
  const TEXT_DARK: [number, number, number] = [31, 41, 55];

  const title = options.title || "Rent Report";
  const total =
    typeof options.total === "number"
      ? options.total
      : rows.reduce((s, r) => s + (r.amount || 0), 0);
  const genDate = new Date().toLocaleString();

  const cardW = 160;
  const cardX = pageWidth - margin - cardW;
  const cardGap = 16;
  const maxTextWidth = cardX - margin - cardGap;

  // ---- Title ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...BRAND);
  doc.text(title, margin, 48);

  // ---- Date range subtitle (custom reports only) — auto-shrinks / wraps to fit ----
  let nextY = 66;
  if (options.dateRangeLabel) {
    let fontSize = 11;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_MUTED);
    doc.setFontSize(fontSize);

    while (
      doc.getTextWidth(options.dateRangeLabel) > maxTextWidth &&
      fontSize > 7
    ) {
      fontSize -= 0.5;
      doc.setFontSize(fontSize);
    }

    if (doc.getTextWidth(options.dateRangeLabel) > maxTextWidth) {
      const lines = doc.splitTextToSize(options.dateRangeLabel, maxTextWidth);
      doc.text(lines, margin, nextY);
      nextY += lines.length * (fontSize + 2);
    } else {
      doc.text(options.dateRangeLabel, margin, nextY);
      nextY += fontSize + 4;
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Generated: ${genDate}`, margin, nextY);
  doc.text(`Records: ${rows.length}`, margin, nextY + 12);

  // ---- Total "stat card" (fixed position, unaffected by title/subtitle length) ----
  doc.setFillColor(...BRAND_TINT);
  doc.roundedRect(cardX, 36, cardW, 44, 4, 4, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("TOTAL COLLECTED", cardX + 12, 50);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...BRAND);
  doc.text(`RWF ${total.toLocaleString("en-US")}`, cardX + 12, 68);

  // Rule + table start position shift down if the header block grew (wrapped subtitle)
  const ruleY = Math.max(96, nextY + 20);
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(1);
  doc.line(margin, ruleY, pageWidth - margin, ruleY);

  // ---- Table (with totals row baked in) ----
  const head = [
    [
      "Building",
      "Room",
      "Tenant",
      "Payment Date",
      "Months",
      "Status",
      "Amount",
    ],
  ];
  const body = rows.map((r) => [
    r.building,
    r.room,
    r.tenantName,
    r.paymentDate,
    String(r.monthsCovered),
    r.status,
    `RWF ${r.amount.toLocaleString("en-US")}`,
  ]);
  const footRow = [
    "",
    "",
    "",
    "",
    "",
    "Total",
    `RWF ${total.toLocaleString("en-US")}`,
  ];

  autoTable(doc, {
    head,
    body,
    foot: [footRow],
    startY: ruleY + 16,
    margin: { left: margin, right: margin, bottom: 50 },
    styles: {
      fontSize: 9.5,
      textColor: TEXT_DARK,
      cellPadding: { top: 6, bottom: 6, left: 6, right: 6 },
      lineColor: [225, 230, 228],
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: BRAND,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "left",
      cellPadding: { top: 8, bottom: 8, left: 6, right: 6 },
    },
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: BRAND,
      fontStyle: "bold",
      halign: "right",
      lineColor: BRAND,
      lineWidth: { top: 1 },
    },
    alternateRowStyles: {
      fillColor: BRAND_TINT,
    },
    columnStyles: {
      4: { halign: "center" },
      6: { halign: "right", fontStyle: "bold" },
    },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      const pageNum = doc.getCurrentPageInfo().pageNumber;
      doc.setDrawColor(...BRAND_TINT);
      doc.setLineWidth(0.5);
      doc.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(title, margin, pageHeight - 20);
      doc.text(
        `Page ${pageNum} of ${pageCount}`,
        pageWidth - margin - 70,
        pageHeight - 20,
      );
    },
  });

  const filename = options.filename || `rent-report-${safeFilename(title)}.pdf`;
  doc.save(filename);
}
