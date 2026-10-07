import { useMasterData } from '@/hooks/useMasterData';
import { MEAL_SESSIONS, MEAL_SESSION_LABELS } from '@/models/kitchen/kitchenConstants';

/* Small filter controls shared by the kitchen pages (all labelled, DESIGN.md §13). */

export function KbDateFilter({ value, onChange, label = 'Ngày' }) {
  return (
    <label className="date-filter">
      {label}
      <input type="date" className="input" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </label>
  );
}

export function KbSessionFilter({ value, onChange, withAll = false }) {
  return (
    <label className="date-filter">
      Bữa ăn
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {withAll && <option value="ALL">Cả ngày</option>}
        {MEAL_SESSIONS.map((s) => (
          <option key={s} value={s}>
            {MEAL_SESSION_LABELS[s]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Campus picker for the Principal (school-wide scope); other roles see their campus name only. */
export function KbCampusFilter({ campusId, onChange, canPick }) {
  const md = useMasterData();
  if (!canPick) {
    const campus = md.campusById(campusId);
    return campus ? <span className="chip chip--teal">{campus.shortName || campus.name}</span> : null;
  }
  return (
    <label className="date-filter">
      Điểm trường
      <select className="select" value={campusId} onChange={(e) => onChange(e.target.value)}>
        {md.campuses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.shortName || c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Number with up to 3 decimals in Vietnamese format, e.g. 2,4. */
export const fmtQty = (n) =>
  n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 3 });
