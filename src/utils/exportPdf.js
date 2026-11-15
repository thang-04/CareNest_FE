/** Shared export: render a .print-sheet element to an A4 PDF (any module). */
/** Libraries are loaded only when needed (code splitting). `orientation`: 'portrait' (mặc định) | 'landscape' cho biểu mẫu nhiều cột. */
export const exportElementToPdf = async (element, filename, { orientation = 'portrait' } = {}) => {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    // Bản xem trước phóng/thu tờ giấy bằng transform: chụp ở khổ thật nên gỡ transform và khung cắt của các lớp bọc
    onclone: (_doc, cloned) => {
      for (let node = cloned.parentElement; node; node = node.parentElement) {
        if (node.dataset?.printFit !== undefined || node.classList.contains('print-preview__scale')) {
          node.style.transform = 'none';
          node.style.width = 'auto';
          node.style.height = 'auto';
        }
      }
    },
  });
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
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
