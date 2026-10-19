import { Link } from 'react-router-dom';
import { MoreHorizontal } from '@/components/ui/icons';

/** Nút "…" cuối dòng bảng mở danh sách thao tác. items: [{ label, to, icon }]. */
export function RowMenu({ label, items }) {
  return (
    <details className="row-menu" onClick={(e) => e.stopPropagation()}>
      <summary className="icon-btn" aria-label={label} title="Thao tác">
        <MoreHorizontal size={18} />
      </summary>
      <div className="row-menu__panel">
        {items.map(({ label: text, to, icon: Icon }) => (
          <Link key={to} to={to}>
            {Icon && <Icon size={16} />} {text}
          </Link>
        ))}
      </div>
    </details>
  );
}
