/*
 * Phần chung của bản in đánh giá để file .doc mở bằng Word giống bản xem trước: Word chỉ nhận khổ giấy khai ở @page đặt
 * tên, cần độ rộng cột cố định và bỏ qua chiều cao của div rỗng.
 */
const PAPER = { portrait: [595.3, 841.9], landscape: [841.9, 595.3] };

const UNIT_PT = { cm: 28.35, mm: 2.835, pt: 1 };
const toPt = (length) => parseFloat(length) * UNIT_PT[length.slice(-2)];

/** Bề rộng vùng nội dung (pt) theo lề viết như CSS: "trên phải dưới trái", thiếu thì lấy theo quy tắc rút gọn. */
const printableWidth = (orientation, margin) => {
  const [top, right = top, , left = right] = margin.split(' ').map(toPt);
  return Math.floor(PAPER[orientation][0] - left - right);
};

const px = (pt) => Math.round((pt * 4) / 3);

const ZOOMS = Array.from({ length: 23 }, (_, i) => (50 + i * 5) / 100);

/** Phóng hoặc thu cả trang theo nấc cho vừa bề ngang khung xem, giữ nguyên bố cục sẽ in (32px: lề và thanh cuộn). */
const fitToFrame = (width) =>
  ZOOMS.map((zoom) => `@media screen and (min-width: ${Math.ceil(px(width) * zoom) + 32}px) { body { zoom: ${zoom}; } }`).join('\n');

export const pageCss = (orientation, margin) => {
  const [width, height] = PAPER[orientation];
  const printable = printableWidth(orientation, margin);
  // Trên màn: dàn trang đúng bề rộng vùng in rồi phóng cho đầy khung, nên cột và chỗ xuống dòng giống bản in
  return `@page Section1 { size: ${width}pt ${height}pt; mso-page-orientation: ${orientation}; margin: ${margin}; }
@page { size: A4 ${orientation}; margin: ${margin}; }
div.Section1 { page: Section1; }
@media screen {
body { margin: 8px; zoom: ${ZOOMS[0]}; }
div.Section1 { width: ${printable}pt; margin: 0 auto; }
}
${fitToFrame(printable)}`;
};

/** Bề rộng vùng in (pt) của khổ A4 với lề trái, phải tính bằng pt. */
export const contentWidth = (orientation, left, right) => Math.floor(PAPER[orientation][0] - left - right);

/** Làm tròn xuống 0,1pt để tổng các cột không vượt vùng in. */
export const share = (total, count) => Math.floor((total / count) * 10) / 10;

/** Thẻ mở bảng lưới kèm colgroup: độ rộng từng cột theo pt. */
export const gridOpen = (widths) => {
  const total = Math.floor(widths.reduce((sum, w) => sum + w, 0) * 10) / 10;
  const cols = widths.map((w) => `<col width="${px(w)}" style="width:${w}pt"/>`).join('');
  return `<table class="grid" width="${px(total)}" style="width:${total}pt; table-layout:fixed"><colgroup>${cols}</colgroup>`;
};

export const SIGN_SPACE = '<div class="sign"><p>&nbsp;</p><p>&nbsp;</p><p>&nbsp;</p></div>';
