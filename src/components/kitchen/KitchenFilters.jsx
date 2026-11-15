import { useMasterData } from '@/hooks/useMasterData';
import { ALL_MEAL_SESSIONS, MEAL_SESSION_LABELS } from '@/models/kitchen/kitchenConstants';
import { DateInput } from '@/components/form/DateInput';
import { formatQty, isIsoDate } from '@/utils/format';

/* Small filter controls shared by the kitchen pages (all labelled, DESIGN.md §10). */

export function KbDateFilter({ value, onChange, label = 'Ngày' }) {
  return (
    <label className="date-filter">
      {label}
      <DateInput value={value} onChange={(next) => isIsoDate(next) && onChange(next)} aria-label={label} />
    </label>
  );
}

/** Ngày lọc không bắt buộc: để trống = không lọc theo ngày; chỉ nhận ngày đủ hoặc rỗng. */
export function KbOptionalDateFilter({ value, onChange, label }) {
  return (
    <label className="date-filter">
      {label}
      <DateInput value={value} onChange={(next) => (next === '' || isIsoDate(next)) && onChange(next)} aria-label={label} />
    </label>
  );
}

export function KbSessionFilter({ value, onChange, withAll = false, sessions = ALL_MEAL_SESSIONS }) {
  return (
    <label className="date-filter">
      Bữa ăn
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {withAll && <option value="ALL">Cả ngày</option>}
        {sessions.map((s) => (
          <option key={s} value={s}>
            {MEAL_SESSION_LABELS[s]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Campus picker for the Principal (school-wide scope); other roles see their campus name only. */
export function KbCampusFilter({ campusId, onChange, canPick, campuses }) {
  const md = useMasterData();
  // `campuses` = danh sách service của màn trả về (cùng nguồn với dữ liệu); không truyền thì lấy danh mục chung
  const list = campuses || md.campuses;
  if (!canPick) {
    const campus = list.find((c) => String(c.id) === String(campusId));
    // Vẫn có nhãn như bản chọn được để chip thẳng hàng với các ô lọc khác
    return campus ? (
      <div className="date-filter">
        Điểm trường
        <span className="date-filter__static">
          <span className="chip chip--teal">{campus.shortName || campus.name}</span>
        </span>
      </div>
    ) : null;
  }
  return (
    <label className="date-filter">
      Điểm trường
      <select className="select" value={campusId} onChange={(e) => onChange(e.target.value)}>
        {list.map((c) => (
          <option key={c.id} value={c.id}>
            {c.shortName || c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Number with up to 3 decimals in Vietnamese format, e.g. 2,4. */
export const fmtQty = formatQty;
