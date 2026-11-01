import { LogoMark, Wordmark } from '@/components/brand/Logo';
import { DEFAULT_PRINT_TEMPLATE } from '@/config/printTemplate';

/**
 * Header of every A4 document (phiếu, biên bản). Put it first inside
 * <div className="print-sheet">. School info comes from config/printTemplate.js.
 */
export function PrintHeader({ template = DEFAULT_PRINT_TEMPLATE }) {
  return (
    <div className="ps-header">
      <div className="ps-brand">
        <LogoMark size={64} />
        <div>
          <Wordmark size={30} />
          <div className="ps-brand__slogan">{template.slogan}</div>
        </div>
      </div>
      <div className="ps-school">
        <div className="ps-school__name">{template.schoolName}</div>
        <div>Địa chỉ: {template.address}</div>
        <div>
          Điện thoại: {template.phone} &nbsp;|&nbsp; Email: {template.email}
        </div>
      </div>
    </div>
  );
}
