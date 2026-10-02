import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  createReportCsv,
  createReportDocx,
  createReportPdf,
  createReportXlsx,
} from "../src/lib/reportExports.js";
import { sampleReports } from "../src/services/sampleData.js";

const asBuffer = async (blob) => Buffer.from(await blob.arrayBuffer());

const assertArtifact = async ({ blob, filename }, extension, mimeType, signature) => {
  assert.ok(blob instanceof Blob, `${extension} export must return a Blob`);
  assert.equal(blob.type, mimeType, `${extension} export must use the expected MIME type`);
  assert.match(filename, new RegExp(`^golden-marketing-services-performance-.+-\\d{4}-\\d{2}-\\d{2}\\.${extension}$`));
  const bytes = await asBuffer(blob);
  assert.ok(bytes.length > 100, `${extension} export must contain a real document`);
  assert.equal(bytes.subarray(0, signature.length).toString("binary"), signature, `${extension} export signature is invalid`);
  return bytes;
};

const csv = createReportCsv({
  ...sampleReports,
  sourcePerformance: [
    ...sampleReports.sourcePerformance,
    { source: "=UNSAFE", leads: 1, qualified: 0, rate: 0 },
  ],
});
assert.equal(csv.blob.type, "text/csv;charset=utf-8");
assert.match(csv.filename, /^golden-marketing-services-performance-.+-\d{4}-\d{2}-\d{2}\.csv$/);
const csvText = await csv.blob.text();
assert.ok(csvText.startsWith("\"Section\",\"Record\",\"Metric\",\"Value\""));
assert.ok(csvText.includes("Lead Volume"));
assert.ok(csvText.includes("'=UNSAFE"), "CSV formula-like values must be escaped");

const xlsxBytes = await assertArtifact(
  await createReportXlsx(sampleReports),
  "xlsx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "PK\u0003\u0004",
);
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(xlsxBytes);
assert.ok(workbook.worksheets.length >= 5, "Excel export must contain report worksheets");
assert.equal(workbook.getWorksheet("Summary").getCell("A2").value, "Lead Volume");

await assertArtifact(
  await createReportDocx(sampleReports),
  "docx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "PK\u0003\u0004",
);

const pdfBytes = await assertArtifact(
  await createReportPdf(sampleReports),
  "pdf",
  "application/pdf",
  "%PDF",
);
assert.ok(pdfBytes.subarray(-1024).toString("latin1").includes("%%EOF"), "PDF export must have a valid trailer");

const emptyReport = {
  range: "Current period",
  comparison: "Previous period",
  metrics: {},
  trend: [],
  responseDistribution: {},
  sourcePerformance: [],
  campaignPerformance: [],
  servicePerformance: [],
  repPerformance: [],
  outcome: {},
};

assert.ok((await createReportCsv(emptyReport).blob.text()).includes("Report details"));
assert.ok((await asBuffer((await createReportXlsx(emptyReport)).blob)).length > 100);
assert.ok((await asBuffer((await createReportDocx(emptyReport)).blob)).length > 100);
assert.ok((await asBuffer((await createReportPdf(emptyReport)).blob)).length > 100);

console.log("Report exports: CSV, XLSX, DOCX, PDF, and empty-state artifacts PASS");
