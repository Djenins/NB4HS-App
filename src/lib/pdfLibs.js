// pdfLibs.js -- html2canvas + jsPDF, fetched only when someone actually
// exports a PDF. Together they're ~600 KB minified; imported statically they
// sat in the main bundle and every page (the public kiosk included) paid for
// two export buttons deep in the staff app.
export async function loadPdfLibs() {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  return { html2canvas, jsPDF };
}
