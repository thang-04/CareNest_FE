import { Fragment, useState } from 'react';
import { AlertTriangle, Plus, X } from '@/components/ui/icons';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LUNCH_TYPES, dayAllergyNotes, weekSections } from '@/utils/menu-planning/weekGridLayout';
import { daySummary } from '@/utils/menu-planning/daySummary';
import { DISH_TYPE_LABELS, RECORD_STATUS, WEEKDAY_LABELS } from '@/models/menu-planning/menuPlanningConstants';

const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Nhãn kết quả đầu cột: "Đạt" hoặc "N lưu ý" (đỏ khi có lỗi nặng); bấm để mở chi tiết ngày. */
function DayResult({ day, wm, catalog, issues, onOpen }) {
  if (day.holiday) return null;
  if (!issues) {
    const sum = daySummary(day, wm, catalog);
    return sum ? <StatusBadge tone={sum.check.tone} label={sum.check.label} /> : <span className="text-xs muted">Chưa có món</span>;
  }
  const badge = issues.length ? (
    <StatusBadge tone={issues.some((x) => x.tone === 'bad') ? 'red' : 'orange'} label={`${issues.length} lưu ý`} />
  ) : (
    <StatusBadge tone="green" label="Đạt" />
  );
  if (!onOpen) return badge;
  return (
    <button type="button" className="td-week__result" onClick={() => onOpen(day.date)} title="Xem số liệu so với định mức">
      {badge}
    </button>
  );
}

// Bấm "Thêm" xong mở luôn danh sách món, đỡ phải bấm lần hai; trình duyệt không hỗ trợ thì chỉ focus
const openPicker = (el) => {
  if (!el?.showPicker) return;
  try {
    el.showPicker();
  } catch {
    /* mất user activation hoặc trình duyệt chặn: người dùng bấm ô chọn như bình thường */
  }
};

const inRow = (row, dish) => !row.type || (row.type === 'OTHER' ? !LUNCH_TYPES.includes(dish?.type) : dish?.type === row.type);

/**
 * Bảng thực đơn tuần (cột là các thứ), gom theo bữa: mỗi bữa một dải tiêu đề, bữa trưa tách loại món.
 * Đầu cột: thực đơn mẫu, ngày nghỉ, nhãn kết quả. Dị ứng gom thành một hàng cuối bảng.
 * editable=false: chỉ xem (HT, bản đã xuất bản, xem trước bản AI) — ẩn loại món cả tuần không dùng.
 * issuesByDate + onOpenDay: nhãn "N lưu ý" bấm mở chi tiết; dayNotes: { [date]: node } dưới đầu cột;
 * isNew(date, session, dishId): tô nền món khác bản đang soạn.
 */
export function WeekGrid({
  wm,
  catalog,
  menus,
  allergyRows,
  allergyMenus,
  editable,
  busy,
  onPickMenu,
  onHoliday,
  onChangeMeals,
  issuesByDate,
  onOpenDay,
  dayNotes,
  isNew,
}) {
  const [adding, setAdding] = useState(null);
  const sections = weekSections(catalog.nutritionSetups, wm.ageGroupId, wm.days, catalog.dishById, { keepEmpty: !!editable });
  const notesOf = (day) => sections.flatMap((s) => dayAllergyNotes({ day, session: s.session, catalog, allergyRows, allergyMenus }));
  const hasNotes = wm.days.some((d) => notesOf(d).length > 0);
  const cols = wm.days.length + 1;

  const change = (day, session, fn) => {
    const meals = (day.meals || []).map((m) => (m.session === session ? { ...m, items: fn(m.items) } : m));
    if (!meals.some((m) => m.session === session)) meals.push({ session, items: fn([]) });
    onChangeMeals(day.date, meals);
  };

  const dishCell = (d, row) => {
    if (d.holiday) return <td key={d.date} className="td-week__off" />;
    const items = ((d.meals || []).find((m) => m.session === row.session)?.items || [])
      .map((it, idx) => ({ it, idx, dish: catalog.dishById[it.dishId] }))
      .filter(({ dish }) => inRow(row, dish));
    const k = `${d.date}|${row.key}`;
    const options = catalog.dishes.filter(
      (x) => x.status === RECORD_STATUS.ACTIVE && (row.type && row.type !== 'OTHER' ? x.type === row.type : true),
    );
    return (
      <td key={d.date} className={items.length ? undefined : 'td-week__cell--empty'}>
        {items.length > 0 ? (
          <ul className="td-week__dishes">
            {items.map(({ it, idx, dish }) => (
              <li key={`${it.dishId}-${idx}`} className={isNew?.(d.date, row.session, it.dishId) ? 'td-week__new' : undefined}>
                <span className="td-grow">{dish?.name || 'Món đã xóa'}</span>
                {editable && (
                  <button
                    type="button"
                    className="td-week__x"
                    aria-label={`Bỏ ${dish?.name || 'món'}`}
                    disabled={busy}
                    onClick={() => change(d, row.session, (list) => list.filter((_, j) => j !== idx))}
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
          (adding === k && options.length === 0 ? (
            // Chỉ món "Đang sử dụng" chọn được vào thực đơn (món Nháp/Ngừng không hiện) — nói rõ thay vì danh sách rỗng
            <span className="muted td-week__pick-empty" role="status">
              Chưa có món {row.type ? DISH_TYPE_LABELS[row.type]?.toLowerCase() : ''} đang sử dụng.{' '}
              <button type="button" className="td-week__add" onClick={() => setAdding(null)}>
                Đóng
              </button>
            </span>
          ) : adding === k ? (
            <select
              className="select td-week__pick"
              autoFocus
              ref={openPicker}
              defaultValue=""
              onBlur={() => setAdding(null)}
              onKeyDown={(e) => e.key === 'Escape' && setAdding(null)}
              onChange={(e) => {
                if (e.target.value) change(d, row.session, (list) => [...list, { dishId: e.target.value, portion: 1 }]);
                setAdding(null);
              }}
              aria-label={`Thêm món ${row.label}`}
            >
              <option value="">Chọn món…</option>
              {options.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                  {row.type ? '' : ` (${DISH_TYPE_LABELS[x.type]})`}
                </option>
              ))}
            </select>
          ) : (
            <button type="button" className="td-week__add" disabled={busy} onClick={() => setAdding(k)}>
              <Plus size={12} /> Thêm
            </button>
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
            {wm.days.map((d, i) => (
              <th key={d.date}>
                <div className="td-week__day">
                  <b>
                    {WEEKDAY_LABELS[i]} <span className="muted td-week__date">{ddmm(d.date)}</span>
                  </b>
                  {editable && !d.holiday ? (
                    <select
                      className="select"
                      value={d.menuId || ''}
                      disabled={busy}
                      aria-label={`Thực đơn mẫu ${WEEKDAY_LABELS[i]}`}
                      title={menus.find((m) => m.id === d.menuId)?.name || 'Chọn thực đơn mẫu'}
                      onChange={(e) => onPickMenu(d.date, e.target.value)}
                    >
                      <option value="">Chọn thực đơn mẫu</option>
                      {menus.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs muted">
                      {d.holiday ? `Nghỉ: ${d.note}` : menus.find((m) => m.id === d.menuId)?.name || '—'}
                    </span>
                  )}
                  <div className="td-week__day-foot">
                    <DayResult day={d} wm={wm} catalog={catalog} issues={issuesByDate?.[d.date]} onOpen={onOpenDay} />
                    {editable && (
                      <label className="checkbox text-xs">
                        <input
                          type="checkbox"
                          checked={!!d.holiday}
                          disabled={busy}
                          onChange={(e) => onHoliday(d.date, e.target.checked)}
                        />{' '}
                        Nghỉ
                      </label>
                    )}
                  </div>
                  {dayNotes?.[d.date]}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((s) => (
            <Fragment key={s.session}>
              <tr className="td-week__band">
                <th scope="colgroup" colSpan={cols}>
                  {s.label}
                </th>
              </tr>
              {s.rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row" className="td-week__label">
                    {row.label}
                  </th>
                  {wm.days.map((d) => dishCell(d, row))}
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
              {wm.days.map((d) => {
                const list = notesOf(d);
                return (
                  <td key={d.date} className={d.holiday ? 'td-week__off' : undefined}>
                    {list.length > 0 ? (
                      <ul className="td-week__notes">
                        {list.map((n) => (
                          <li key={n.key} className={n.missing ? 'td-week__note--missing' : undefined}>
                            <b>{n.dish}:</b> {n.text}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      !d.holiday && <span className="muted">—</span>
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
