import { DEFAULT_PRINT_TEMPLATE } from '@/config/printTemplate';
import { docHeaderLines } from '@/components/print/docTemplate';

/**
 * Đầu trang của mọi bản in A4 (phiếu, biên bản): quốc hiệu 2 cột như bản Word (docHeaderHtml).
 * Đặt đầu tiên trong <div className="print-sheet">. Thông tin trường lấy từ config/printTemplate.js.
 */
export function PrintHeader({ template = DEFAULT_PRINT_TEMPLATE }) {
  const { left, right } = docHeaderLines(template);
  const col = (lines) => (
    <div className="ps-header__col">
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
      <div className="ps-header__rule" aria-hidden />
    </div>
  );
  return (
    <div className="ps-header">
      {col(left)}
      {col(right)}
    </div>
  );
}
