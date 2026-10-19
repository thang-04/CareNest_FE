import { Link } from 'react-router-dom';
import { ArrowLeft } from '@/components/ui/icons';

/** Thanh đầu trang gọn của trang sửa: nút quay lại, tiêu đề, thông tin phụ và các nút trên cùng một hàng. */
export function EditHead({ backTo, backLabel = 'Quay lại', title, meta, actions }) {
  return (
    <div className="edit-head">
      <Link className="icon-btn" to={backTo} aria-label={backLabel} title={backLabel}>
        <ArrowLeft size={18} />
      </Link>
      <h1>{title}</h1>
      {meta && <span className="edit-head__meta">{meta}</span>}
      {actions && <div className="edit-head__actions">{actions}</div>}
    </div>
  );
}
