import { Fragment, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, X } from '@/components/ui/icons';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DISH_TYPE_LABELS, MEAL_SESSION_LABELS, WEEKDAY_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import {
  addDish,
  dayAllergenNotes,
  dayResult,
  gridSections,
  removeDish,
  rowItems,
  setDayNote,
  setDayOff,
} from '@/utils/menu-planning/mealPlanGrid';
import { LUNCH_TYPES } from '@/utils/menu-planning/weekGridLayout';

const NOTE_MAX = 200;
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * Bảng kế hoạch tuần của một khối như sổ thực đơn: cột là các thứ, mỗi bữa một dải tiêu đề, bữa trưa tách hàng theo loại món,
 * hàng cuối "Suất dị ứng". Đầu cột: ngày, nhãn kết quả BE đã kiểm ("N lưu ý" / "Đạt"), ô ngày nghỉ.
 * `onEdit(fn)` nhận hàm biến đổi bản nháp; `editable` false ⇒ chỉ xem (đã công bố hoặc không có quyền sửa).
 * Bộ thực đơn mẫu dùng lại lưới với `hideDates` (ngày của bản nháp là ngày giả) và `allowOff={false}` (bộ mẫu không có ngày nghỉ).
 */
export function MealPlanGrid({
  draft,
  plan,
  block,
  sessions,
  dishes,
  editable,
  busy,
  onEdit,
  hideDates = false,
  allowOff = true,
  dayLink,
}) {
  const dishById = useMemo(() => Object.fromEntries(dishes.map((dish) => [String(dish.id), dish])), [dishes]);
  const sections = gridSections(draft, block, sessions, { keepEmpty: !!editable });
  const notesOf = (day) => (day.off ? [] : dayAllergenNotes(day, block, dishById));
  const hasNotes = draft.days.some((day) => notesOf(day).length > 0);
  const cols = draft.days.length + 1;

  const options = (row) =>
    dishes.filter((dish) => (!row.type ? true : row.type === 'OTHER' ? !LUNCH_TYPES.includes(dish.type) : dish.type === row.type));

  const cell = (day, session, row) => {
    if (day.off) return <td key={day.date} className="td-week__off" />;
    const items = rowItems(day, block, session, row);
    const chosen = new Set(items.map((item) => item.dishId));
    const choices = options(row).filter((dish) => !chosen.has(String(dish.id)));
    return (
      <td key={day.date} className={items.length ? undefined : 'td-week__cell--empty'}>
        {items.length > 0 ? (
          <ul className="td-week__dishes">
            {items.map((item) => (
              <li key={item.dishId}>
                <span className="td-grow">{item.dishName || 'Món đã xóa'}</span>
                {editable && (
                  <button
                    type="button"
                    className="td-week__x"
                    aria-label={`Bỏ ${item.dishName || 'món'}`}
                    disabled={busy}
                    onClick={() => onEdit((d) => removeDish(d, day.date, block, session, item.dishId))}
                  >
                    <X size={12} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          !editable && <span className="muted">—</span>
        )}
        {editable &&
          (options(row).length === 0 ? (
            <span className="muted td-week__pick-empty">
              Chưa có {row.type && row.type !== 'OTHER' ? DISH_TYPE_LABELS[row.type]?.toLowerCase() : 'món'} đang sử dụng.
            </span>
          ) : (
            // "+ Thêm" là chính ô chọn gốc: một lần bấm mở danh sách của trình duyệt, không bị cắt trong bảng cuộn
            <select
              className="td-week__add td-week__add-select"
              value=""
              disabled={busy || choices.length === 0}
              aria-label={`Thêm món ${MEAL_SESSION_LABELS[session]} ${row.label} ${hideDates ? WEEKDAY_LABELS[draft.days.indexOf(day)] : ddmm(day.date)}`}
              onChange={(e) => {
                const dish = dishById[e.target.value];
                if (dish) onEdit((d) => addDish(d, day.date, block, session, dish));
              }}
            >
              <option value="">+ Thêm</option>
              {choices.map((dish) => (
                <option key={dish.id} value={dish.id}>
                  {dish.name}
                  {row.type ? '' : ` (${DISH_TYPE_LABELS[dish.type] || dish.type})`}
                </option>
              ))}
            </select>
          ))}
      </td>
    );
  };

  return (
    <div className="table-wrap td-week-wrap">
      <table className="table table--grid td-week">
        <thead>
          <tr>
            <th className="td-week__label">
              <span className="sr-only">Món</span>
            </th>
            {draft.days.map((day, i) => {
              const result = day.off ? null : dayResult(plan, day.date);
              return (
                <th key={day.date}>
                  <div className="td-week__day">
                    <b>
                      {WEEKDAY_LABELS[i]} {!hideDates && <span className="muted td-week__date">{ddmm(day.date)}</span>}
                    </b>
                    {day.off &&
                      (editable ? (
                        <input
                          className="input"
                          maxLength={NOTE_MAX}
                          placeholder="Lý do nghỉ"
                          aria-label={`Lý do nghỉ ${WEEKDAY_LABELS[i]}`}
                          value={day.note}
                          disabled={busy}
                          onChange={(e) => onEdit((d) => setDayNote(d, day.date, e.target.value))}
                        />
                      ) : (
                        <span className="text-xs muted">Nghỉ{day.note ? `: ${day.note}` : ''}</span>
                      ))}
                    <div className="td-week__day-foot">
                      {result && <StatusBadge tone={result.tone} label={result.label} />}
                      {dayLink && !day.off && (
                        <Link className="text-xs" to={dayLink(day, i)} aria-label={`Thống kê định lượng ${WEEKDAY_LABELS[i]}`}>
                          Thống kê
                        </Link>
                      )}
                      {editable && allowOff && (
                        <label className="checkbox text-xs">
                          <input
                            type="checkbox"
                            checked={day.off}
                            disabled={busy}
                            onChange={(e) => onEdit((d) => setDayOff(d, day.date, e.target.checked))}
                          />{' '}
                          Nghỉ
                        </label>
                      )}
                    </div>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.session}>
              <tr className="td-week__band">
                <th scope="colgroup" colSpan={cols}>
                  {MEAL_SESSION_LABELS[section.session]}
                </th>
              </tr>
              {section.rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="td-week__label">
                    {row.label}
                  </th>
                  {draft.days.map((day) => cell(day, section.session, row))}
                </tr>
              ))}
            </Fragment>
          ))}
          {hasNotes && (
            <tr className="td-week__allergy-row">
              <th scope="row" className="td-week__label">
                <span className="td-week__allergy-label">
                  <AlertTriangle size={14} aria-hidden="true" /> Suất dị ứng
                </span>
              </th>
              {draft.days.map((day) => {
                const list = notesOf(day);
                return (
                  <td key={day.date} className={day.off ? 'td-week__off' : undefined}>
                    {list.length > 0 ? (
                      // Số trẻ dị ứng theo chất và món thay thế chưa có trên hệ thống (lát món thay thế dị ứng)
                      <ul className="td-week__notes">
                        {list.map((note) => (
                          <li key={note.key} className="td-week__note--missing">
                            <b>{note.dish}:</b> {note.allergens.join(', ').toLowerCase()} · chưa có suất thay thế
                          </li>
                        ))}
                      </ul>
                    ) : (
                      !day.off && <span className="muted">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
