import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Clock, Stethoscope, Thermometer, UserX } from '@/components/ui/icons';

const ICONS = { 'not-taken': Clock, 'health-noted': Thermometer, 'health-unchecked': Stethoscope, unexcused: UserX };
const BADGE_TONE = { orange: 'chip--orange', red: 'chip--red', gray: 'chip--gray' };

/**
 * Danh sách "Cần chú ý hôm nay": mỗi dòng là một mục bất thường đã tính ở service, bấm mở màn xử lý của module.
 * items: [{ key, tone, title, meta, to, badge }]. Rỗng/tải/lỗi do `Widget` bao ngoài lo.
 */
export function AttentionList({ items }) {
  return (
    <ul className="db-list db-attention">
      {items.map(({ key, tone, title, meta, to, badge }) => {
        const Icon = ICONS[key] || AlertTriangle;
        return (
          <li key={key} className="db-list__item">
            <Link to={to} className="db-list__link">
              <span className={`db-list__icon db-attention__icon db-attention__icon--${tone}`} aria-hidden="true">
                <Icon size={16} />
              </span>
              <span className="db-list__main">
                <span className="db-list__title">{title}</span>
                {meta && <span className="db-list__meta">{meta}</span>}
              </span>
              <span className="db-list__end">
                {badge && <span className={`chip ${BADGE_TONE[tone] || 'chip--gray'}`}>{badge}</span>}
                <ChevronRight size={16} className="muted" aria-hidden="true" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
