// Khổ A4 dọc, lề 10 mm (đơn vị mm của jsPDF)
const A4 = { width: 210, height: 297, margin: 10 };
// Chụp phiếu ở bề rộng cố định gần khổ giấy để chữ không bị thu nhỏ khi màn hình rộng
const CAPTURE_WIDTH_PX = 760;

/** Tên file phiếu khám: PhieuKham_<mã trẻ>_<ngày khám yyyy-MM-dd>.pdf; bỏ ký tự không hợp lệ trong tên file. */
export const examSheetFileName = (child, date) =>
  `PhieuKham_${String(child?.code || child?.id || '').replace(/[^\w-]/g, '')}_${String(date || '').slice(0, 10)}.pdf`;

/**
 * Chia phiếu cao totalHeight thành các trang cao tối đa pageHeight, ngắt ở đáy dòng gần nhất (rowBottoms) để không cắt ngang
 * dòng của bảng; dòng cao hơn một trang thì cắt theo trang. Trả [[đầu, cuối], ...] cùng đơn vị với tham số.
 */
export const examSheetPageSlices = (rowBottoms, pageHeight, totalHeight) => {
  const slices = [];
  let start = 0;
  while (start < totalHeight) {
    const limit = start + pageHeight;
    if (limit >= totalHeight) {
      slices.push([start, totalHeight]);
      break;
    }
    const fit = rowBottoms.filter((bottom) => bottom > start && bottom <= limit);
    const end = fit.length ? Math.max(...fit) : limit;
    slices.push([start, end]);
    start = end;
  }
  return slices;
};

/**
 * Xuất phiếu (phần tử đang hiện trên trang) ra PDF A4: chụp bản sao ở bề rộng cố định, ngắt trang theo dòng của bảng.
 * Phần tử con có data-html2canvas-ignore (vd. nút Xuất file) không vào file. Thư viện chỉ tải khi bấm xuất.
 */
export async function exportExamSheetPdf(element, filename) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  let rowBottoms = [];
  let cssHeight = 0;
  // Nền: thẻ phiếu (--color-surface); phần trống lấy nền trắng mặc định của html2canvas
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    onclone: (_doc, cloned) => {
      cloned.style.width = `${CAPTURE_WIDTH_PX}px`;
      cloned.style.maxWidth = 'none';
      cloned.style.boxShadow = 'none';
      // Bảng cuộn ngang trên màn hẹp: bản chụp hiện đủ, không cắt cột
      cloned.querySelectorAll('.table-wrap').forEach((wrap) => {
        wrap.style.overflow = 'visible';
      });
      const box = cloned.getBoundingClientRect();
      cssHeight = box.height;
      rowBottoms = [...cloned.querySelectorAll('tr')].map((tr) => tr.getBoundingClientRect().bottom - box.top);
    },
  });
  const contentWidth = A4.width - 2 * A4.margin;
  const contentHeight = A4.height - 2 * A4.margin;
  const pxPerCss = cssHeight ? canvas.height / cssHeight : 1;
  const pageHeightPx = (canvas.width * contentHeight) / contentWidth;
  const slices = examSheetPageSlices(
    rowBottoms.map((bottom) => bottom * pxPerCss),
    pageHeightPx,
    canvas.height,
  );
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  slices.forEach(([from, to], index) => {
    const height = Math.ceil(to - from);
    const page = document.createElement('canvas');
    page.width = canvas.width;
    page.height = height;
    page.getContext('2d').drawImage(canvas, 0, from, canvas.width, height, 0, 0, canvas.width, height);
    if (index > 0) pdf.addPage();
    pdf.addImage(page.toDataURL('image/jpeg', 0.92), 'JPEG', A4.margin, A4.margin, contentWidth, (height * contentWidth) / canvas.width);
  });
  pdf.save(filename);
}
