import { StatusBadge } from '@/components/ui/StatusBadge';
import { WEEKDAY_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { dayResult } from '@/utils/menu-planning/mealPlanGrid';

const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const SHOWN = 2;

/**
 * Dải 5 ngày ở đầu kế hoạch tuần: kết quả kiểm BE đã lưu và tối đa 2 lỗi / cảnh báo của ngày, để thấy ngay ngày nào cần sửa.
 * Chỉ hiển thị `plan.issues`; không tự đánh giá. `onShowAll` mở modal danh sách đủ.
 */
export function WeekDaySummary({ plan, draft, onShowAll }) {
  return (
    <div className="td-days-wrap">
      {onShowAll && (
        <div className="td-days__bar">
          <button type="button" className="btn btn--sm" onClick={onShowAll}>
            Xem tất cả {(plan.issues || []).length} lưu ý
          </button>
        </div>
      )}
      <ol className="td-days" aria-label="Kết quả từng ngày">
        {draft.days.map((day, i) => {
          const result = day.off ? { tone: 'gray', label: 'Nghỉ' } : dayResult(plan, day.date);
          const issues = day.off
            ? []
            : (plan.issues || []).filter((x) => x.date === day.date && (x.severity === 'BLOCKING' || x.severity === 'WARNING'));
          return (
            <li key={day.date} className="td-day">
              <div className="td-day__top">
                <b>{WEEKDAY_LABELS[i]}</b>
                <span className="muted">{ddmm(day.date)}</span>
              </div>
              {result ? <StatusBadge tone={result.tone} label={result.label} /> : <StatusBadge tone="gray" label="Chưa kiểm" />}
              {issues.length > 0 && (
                <ul className="td-day__issues">
                  {issues.slice(0, SHOWN).map((x, k) => (
                    <li
                      key={`${x.code}-${k}`}
                      title={x.message}
                      className={x.severity === 'BLOCKING' ? 'td-day__issue--err' : 'td-day__issue--warn'}
                    >
                      {/* BE ghi ngày ở đầu câu; trong thẻ ngày đã có ngày nên bỏ phần đó khi hiển thị */}
                      {String(x.message || '').replace(/^\d{2}\/\d{2}\s*·\s*/, '')}
                    </li>
                  ))}
                </ul>
              )}
              {issues.length > SHOWN && onShowAll && (
                <button type="button" className="link-btn text-sm" onClick={onShowAll}>
                  +{issues.length - SHOWN} lưu ý khác
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
