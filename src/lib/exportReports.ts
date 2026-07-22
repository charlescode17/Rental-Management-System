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

export async function exportPaymentsToExcel(
  rows: ReportRow[],
  options: { title?: string; filename?: string } = {},
) {
  const header = [
    "Building",
    "Room",
    "Tenant",
    "Payment Date",
    "Months Covered",
    "Status",
    "Amount",
  ];

  const aoa = [
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
  ];

  const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
  aoa.push([]);
  aoa.push(["", "", "", "", "Total", "", total]);

  const ws = XLSX.utils.aoa_to_sheet(aoa as any);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Payments");

  const filename =
    options.filename ||
    `rent-report-${safeFilename(options.title || "report")}.xlsx`;
  XLSX.writeFile(wb, filename);
}

export async function exportPaymentsToPDF(
  rows: ReportRow[],
  options: { title?: string; filename?: string; total?: number } = {},
) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.text(options.title || "Rent Report", margin, 48);
  doc.setFontSize(10);
  const genDate = new Date().toLocaleString();
  doc.text(`Generated: ${genDate}`, margin, 64);
  if (typeof options.total === "number") {
    doc.text(
      `Total: RWF ${options.total.toLocaleString("en-US")}`,
      pageWidth - margin - 150,
      64,
    );
  }

  const head = [
    ["Building", "Room", "Tenant", "Payment Date", "Months", "Status", "Amount"],
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

  autoTable(doc, {
    head,
    body,
    startY: 84,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [230, 230, 230] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      6: { halign: "right" },
    },
    margin: { left: margin, right: margin },
  });

  const filename =
    options.filename ||
    `rent-report-${safeFilename(options.title || "report")}.pdf`;
  doc.save(filename);
}
