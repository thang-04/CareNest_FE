import { Link } from 'react-router-dom';
import { Button } from '@/components';
import { HeartPulse } from '@/components/ui/icons';

// Bấm nút trong dòng bấm được không kích hoạt luôn cả dòng
const stop = (e) => e.stopPropagation();

/**
 * Thao tác dòng của danh sách trẻ trong đợt khám, kỳ cân đo: tối đa 2 nút có chữ thay icon khó hiểu (user yêu cầu 2026-11-11).
 * primary: { label, to, icon, strong } — strong: nút chính (Khám, Nhập số đo); không strong: nút viền xanh (Xem phiếu, Sửa số đo).
 * primary.disabled + title: nút khóa kèm lý do. healthLink: sổ sức khỏe của trẻ; bỏ trống ở dòng chỉ xem (trẻ đã chuyển lớp). name: tên trẻ cho trình đọc màn hình.
 */
export function RosterActions({ name, primary, healthLink }) {
  return (
    <div className="tr-roster-actions">
      {primary?.disabled && (
        <Button size="sm" icon={primary.icon} disabled title={primary.title} aria-label={`${primary.label} – ${name}`}>
          {primary.label}
        </Button>
      )}
      {primary && !primary.disabled && (
        <Link
          className={`btn btn--sm ${primary.strong ? 'btn--primary' : 'btn--outline-primary'}`}
          to={primary.to}
          onClick={stop}
          aria-label={`${primary.label} – ${name}`}
        >
          <primary.icon size={14} /> {primary.label}
        </Link>
      )}
      {healthLink && (
        <Link className="btn btn--sm" to={healthLink} onClick={stop} aria-label={`Sổ sức khỏe – ${name}`}>
          <HeartPulse size={14} /> Sổ sức khỏe
        </Link>
      )}
    </div>
  );
}
