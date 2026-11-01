/** Shared export: render a .print-sheet element to an A4 PDF (any module). */
/** Libraries are loaded only when needed (code splitting). */
export const exportElementToPdf = async (element, filename) => {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;
  const img = canvas.toDataURL('image/jpeg', 0.92);
  let offset = 0;
  // Split long documents over several pages.
  while (offset < imgHeight) {
    if (offset > 0) pdf.addPage();
    pdf.addImage(img, 'JPEG', 0, -offset, pageWidth, imgHeight);
    offset += pageHeight;
  }
  pdf.save(filename);
};
