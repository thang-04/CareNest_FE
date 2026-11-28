import { Button } from '@/components';
import { AlertTriangle, ChevronDown } from '@/components/ui/icons';

/** Dải ngày thu gọn được trong bảng `table--grid`: dòng tiêu đề nhóm + số dòng; `warning` là cảnh báo ngắn của ngày (vd. "2 chờ duyệt"). */
export function DayBandRow({ colSpan, label, count, unit = 'dòng', warning, open, onToggle }) {
  return (
    <tr>
      <th scope="rowgroup" colSpan={colSpan} className="kb-day-band">
        <Button variant="link" icon={ChevronDown} className="kb-day-band__btn" aria-expanded={open} onClick={onToggle}>
          {label}
          {warning && (
            <span className="kb-day-band__warn">
              <AlertTriangle size={14} />
              {warning}
            </span>
          )}
          <span className="kb-day-band__count">
            {count} {unit}
          </span>
        </Button>
      </th>
    </tr>
  );
}
