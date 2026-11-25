import { Button } from '@/components';
import { ChevronDown } from '@/components/ui/icons';

/** Dải ngày thu gọn được trong bảng `table--grid`: dòng tiêu đề nhóm + số dòng. */
export function DayBandRow({ colSpan, label, count, unit = 'dòng', open, onToggle }) {
  return (
    <tr>
      <th scope="rowgroup" colSpan={colSpan} className="kb-day-band">
        <Button variant="link" icon={ChevronDown} className="kb-day-band__btn" aria-expanded={open} onClick={onToggle}>
          {label}
          <span className="kb-day-band__count">
            {count} {unit}
          </span>
        </Button>
      </th>
    </tr>
  );
}
