const display = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const humanize = (value) => String(value)
  .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  .replace(/[_-]+/g, " ")
  .replace(/^./, (letter) => letter.toUpperCase());

const rowsFromObject = (value, keyName) => Object.entries(value || {}).map(([key, count]) => ({
  [keyName]: humanize(key),
  Value: count,
}));

function buildReportSections(data) {
  const metrics = Object.entries(data.metrics || {}).map(([key, metric]) => ({
    Metric: humanize(key),
    Value: metric?.value,
    "Change %": metric?.change,
  }));

  return [
    { name: "Report details", rows: [{ Period: data.range, Comparison: data.comparison }] },
    { name: "Summary", rows: metrics },
    { name: "Trend", rows: Array.isArray(data.trend) ? data.trend : [] },
    { name: "Response time", rows: rowsFromObject(data.responseDistribution, "Response time") },
    { name: "Lead sources", rows: (data.sourcePerformance || []).map((row) => ({
      Source: row.source, Leads: row.leads, Qualified: row.qualified, Rate: row.rate,
    })) },
    { name: "Campaigns", rows: (data.campaignPerformance || []).map((row) => ({
      Campaign: row.campaign, Leads: row.leads, Qualified: row.qualified, Appointments: row.appointments,
    })) },
    { name: "Services", rows: (data.servicePerformance || []).map((row) => ({
      Service: row.service, Leads: row.leads, Qualified: row.qualified, Rate: row.rate,
    })) },
    { name: "Representatives", rows: (data.repPerformance || []).map((row) => ({
      Representative: row.rep, Leads: row.leads, Qualified: row.qualified, Rate: row.rate,
    })) },
    { name: "Customer outcomes", rows: rowsFromObject(data.outcome, "Outcome") },
  ].filter((section) => section.rows.length);
}

function reportFilename(data, extension) {
  const period = String(data.range || "report").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const date = new Date().toISOString().slice(0, 10);
  return `golden-marketing-services-performance-${period || "report"}-${date}.${extension}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value) {
  let text = display(value);
  if (typeof value === "string" && /^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsForCsv(sections) {
  const rows = [["Section", "Record", "Metric", "Value"]];
  for (const section of sections) {
    for (const row of section.rows) {
      const [recordKey, ...valueKeys] = Object.keys(row);
      const record = display(row[recordKey]);
      for (const key of valueKeys) rows.push([section.name, record, key, display(row[key])]);
      if (!valueKeys.length) rows.push([section.name, record, "Value", ""]);
    }
  }
  return rows;
}

export function createReportCsv(data) {
  const csv = rowsForCsv(buildReportSections(data)).map((row) => row.map(csvCell).join(",")).join("\r\n");
  return {
    blob: new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }),
    filename: reportFilename(data, "csv"),
  };
}

export function exportReportCsv(data) {
  const { blob, filename } = createReportCsv(data);
  downloadBlob(blob, filename);
}

export async function createReportXlsx(data) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
    workbook.creator = "Golden Marketing Services";
  workbook.created = new Date();
  for (const section of buildReportSections(data)) {
    const sheet = workbook.addWorksheet(section.name.slice(0, 31));
    const columns = [...new Set(section.rows.flatMap((row) => Object.keys(row)))];
    sheet.addRow(columns);
    section.rows.forEach((row) => sheet.addRow(columns.map((column) => row[column] ?? "")));
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173C3A" } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    sheet.columns = columns.map((header, index) => ({
      key: header,
      width: Math.min(42, Math.max(14, header.length + 3, ...section.rows.map((row) => display(row[header]).length + 2))),
    }));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return {
    blob: new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename: reportFilename(data, "xlsx"),
  };
}

export async function exportReportXlsx(data) {
  const { blob, filename } = await createReportXlsx(data);
  downloadBlob(blob, filename);
}

function docxTable(section, docx) {
  const { Paragraph, Table, TableCell, TableRow, WidthType } = docx;
  const columns = [...new Set(section.rows.flatMap((row) => Object.keys(row)))];
  const makeRow = (values, header = false) => new TableRow({
    children: values.map((value) => new TableCell({
      children: [new Paragraph(display(value))],
      ...(header ? { shading: { fill: "173C3A" } } : {}),
    })),
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [makeRow(columns, true), ...section.rows.map((row) => makeRow(columns.map((column) => row[column])))],
  });
}

export async function createReportDocx(data) {
  const docx = await import("docx");
  const { Document, HeadingLevel, Packer, Paragraph } = docx;
  const sections = buildReportSections(data);
  const children = [
      new Paragraph({ text: "Golden Marketing Services", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: "Performance Report", heading: HeadingLevel.HEADING_2 }),
    new Paragraph(`Reporting period: ${display(data.range)} | Comparison: ${display(data.comparison)}`),
    new Paragraph(`Generated: ${new Date().toLocaleDateString()}`),
  ];
  for (const section of sections) {
    children.push(new Paragraph({ text: section.name, heading: HeadingLevel.HEADING_2 }));
    children.push(docxTable(section, docx));
  }
  const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));
  return { blob, filename: reportFilename(data, "docx") };
}

export async function exportReportDocx(data) {
  const { blob, filename } = await createReportDocx(data);
  downloadBlob(blob, filename);
}

export async function createReportPdf(data) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const sections = buildReportSections(data);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const addText = (text, options = {}) => {
    const fontSize = options.fontSize || 9;
    pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(display(text), contentWidth);
    const lineHeight = fontSize * 0.45;
    if (y + lines.length * lineHeight > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.text(lines, margin, y);
    y += lines.length * lineHeight + (options.gap ?? 2);
  };

  addText("Golden Marketing Services", { fontSize: 18, bold: true, gap: 3 });
  addText("Performance Report", { fontSize: 13, bold: true, gap: 2 });
  addText(`Period: ${display(data.range)} | Comparison: ${display(data.comparison)}`);
  addText(`Generated: ${new Date().toLocaleDateString()}`, { gap: 5 });

  for (const section of sections) {
    addText(section.name, { fontSize: 12, bold: true, gap: 2 });
    for (const row of section.rows) {
      addText(Object.entries(row).map(([key, value]) => `${humanize(key)}: ${display(value)}`).join("   | "), { gap: 1 });
    }
    y += 3;
  }

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFontSize(8);
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: "right" });
  }
  return {
    blob: new Blob([pdf.output("arraybuffer")], { type: "application/pdf" }),
    filename: reportFilename(data, "pdf"),
  };
}

export async function exportReportPdf(data) {
  const { blob, filename } = await createReportPdf(data);
  downloadBlob(blob, filename);
}
