import { Link } from 'react-router-dom';
import { HeartPulse } from '@/components/ui/icons';

// Bấm nút trong dòng bấm được không kích hoạt luôn cả dòng
const stop = (e) => e.stopPropagation();

/**
 * Thao tác dòng của danh sách trẻ trong đợt khám, kỳ cân đo: tối đa 2 nút có chữ thay icon khó hiểu (user yêu cầu 2026-11-11).
 * primary: { label, to, icon, strong } — strong: nút chính (Khám, Nhập số đo); không strong: nút viền xanh (Xem phiếu, Sửa số đo).
 * healthLink: sổ sức khỏe của trẻ, luôn có. name: tên trẻ cho trình đọc màn hình.
 */
export function RosterActions({ name, primary, healthLink }) {
  return (
    <div className="tr-roster-actions">
      {primary && (
        <Link
          className={`btn btn--sm ${primary.strong ? 'btn--primary' : 'btn--outline-primary'}`}
          to={primary.to}
          onClick={stop}
          aria-label={`${primary.label} – ${name}`}
        >
          <primary.icon size={14} /> {primary.label}
        </Link>
      )}
      <Link className="btn btn--sm" to={healthLink} onClick={stop} aria-label={`Sổ sức khỏe – ${name}`}>
        <HeartPulse size={14} /> Sổ sức khỏe
      </Link>
    </div>
  );
}
