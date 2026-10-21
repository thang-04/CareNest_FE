import { Fragment, useEffect, useRef, useState } from 'react';
import FloatingPanel from '@/components/education-plan/FloatingPanel';
import { Cell, focusCell } from '@/components/education-plan/planUi';
import {
  DAY_SECTIONS,
  WEEKDAY_LABELS,
  activitiesForRow,
  addDays,
  cellKey,
  dayGoalsOf,
  ddmm,
  longDay,
  rowCell,
  weekRows,
} from '@/models/education-plan/classPlan';

// Phần nội dung của hoạt động để ghi vào ô ("Trò chuyện: Ngày hội đến trường" → "Ngày hội đến trường")
const activityBody = (text) => (text.includes(':') ? text.slice(text.indexOf(':') + 1).trim() : text);

/**
 * Ô của kế hoạch tuần có gợi ý hoạt động từ kế hoạch chủ đề (lọc theo loại giờ của dòng). Chọn gợi ý thì ghi nội dung
 * vào ô và nhớ MT của hoạt động; vẫn gõ tự do được. MT đã nhớ hiện thành nhãn dưới ô.
 */
function ActivityCell({ editable, suggestions, picks, onPick, onUnpick, children }) {
  const ref = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!ref.current?.contains(e.target) && !panelRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const pickedIds = new Set(picks.map((p) => p.id));
  return (
    <div ref={ref} onFocus={() => editable && suggestions.length > 0 && setOpen(true)}>
      {children}
      {picks.length > 0 && (
        <div className="ga-goal-table__pad row row--wrap gap-2">
          {picks.map((p) => (
            <span key={p.id} className="chip chip--blue" title={p.text}>
              MT {p.goalNo}
              {editable && (
                <button type="button" className="icon-btn" aria-label={`Bỏ MT ${p.goalNo} khỏi ô`} onClick={() => onUnpick(p.id)}>
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {open && (
        <FloatingPanel anchorRef={ref} panelRef={panelRef} minWidth={420}>
          <div className="card">
            <div className="search-select__list" role="listbox" aria-label="Gợi ý từ kế hoạch chủ đề">
              <div className="muted text-xs ga-goal-table__pad">
                Gợi ý từ cột Hoạt động giáo dục của kế hoạch chủ đề (bấm để chọn, hoặc gõ tự do)
              </div>
              {suggestions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="option"
                  aria-selected={pickedIds.has(a.id)}
                  className={`search-select__option ${pickedIds.has(a.id) ? 'search-select__option--active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPick(a)}
                >
                  <span className="fw-600">MT {a.goalNo}</span> · {a.text}
                </button>
              ))}
            </div>
          </div>
        </FloatingPanel>
      )}
    </div>
  );
}

/* Nội dung giáo án một tuần (kế hoạch tuần, kế hoạch ngày) dùng ở trang soạn và trang duyệt hồ sơ chủ đề. */

const AIMS = [
  { key: 'knowledge', label: '1. Kiến thức' },
  { key: 'skills', label: '2. Kỹ năng' },
  { key: 'attitude', label: '3. Thái độ' },
];

/** Bảng nhãn | nội dung dùng cho Mục đích yêu cầu, Chuẩn bị. */
function LabelTable({ rows }) {
  return (
    <div className="table-wrap">
      <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
        <colgroup>
          <col className="ga-goal-table__group" />
          <col />
        </colgroup>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="cell--fixed">
                <div className="ga-goal-table__pad fw-600">{r.label}</div>
              </td>
              <td>{r.cell}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function WeekTab({ draft, week, editable, update, activities = [] }) {
  // Chọn gợi ý: ghi nội dung vào ô (dòng mới) và nhớ MT của hoạt động cho ô đó
  const pick = (r, day, a) =>
    update((d) => {
      const key = cellKey(r.key, day);
      const list = (d.picks ||= {})[key] || [];
      if (list.some((p) => p.id === a.id)) return d;
      d.picks[key] = [...list, { id: a.id, goalId: a.goalId, goalNo: a.goalNo, text: a.text }];
      const g = (d.grid[r.key] ||= rowCell(d, r));
      const add = (old) => (old?.trim() ? `${old}\n${activityBody(a.text)}` : activityBody(a.text));
      if (day === 'all') g.common = add(g.common);
      else if (r.key === 'hoc') g.days[day].topic = add(g.days[day].topic);
      else g.days[day] = add(g.days[day]);
      return d;
    });
  const unpick = (r, day, id) =>
    update((d) => {
      const key = cellKey(r.key, day);
      d.picks = { ...(d.picks || {}), [key]: (d.picks?.[key] || []).filter((p) => p.id !== id) };
      return d;
    });
  const cellProps = (r, day) => ({
    editable,
    suggestions: activitiesForRow(activities, r.key),
    picks: draft.picks?.[cellKey(r.key, day)] || [],
    onPick: (a) => pick(r, day, a),
    onUnpick: (id) => unpick(r, day, id),
  });
  return (
    <>
      <div className="section-title">I. Mục đích yêu cầu</div>
      <LabelTable
        rows={AIMS.map((a) => ({
          label: a.label,
          cell: (
            <Cell editable={editable} value={draft.aims[a.key]} label={a.label} onChange={(v) => update((d) => ((d.aims[a.key] = v), d))} />
          ),
        }))}
      />
      <div className="section-title">II. Chuẩn bị</div>
      <LabelTable
        rows={[
          {
            label: 'Chuẩn bị',
            cell: <Cell editable={editable} value={draft.prep} label="Chuẩn bị" onChange={(v) => update((d) => ((d.prep = v), d))} />,
          },
        ]}
      />
      <div className="section-title">III. Tổ chức hoạt động</div>
      <div className="table-wrap">
        <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
          <colgroup>
            <col className="ga-goal-table__group" />
            {WEEKDAY_LABELS.map((l) => (
              <col key={l} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="cell--fixed">Tên hoạt động</th>
              {WEEKDAY_LABELS.map((l, i) => (
                <th key={l} className="center">
                  {l} · {ddmm(addDays(week.start, i))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekRows().map((r) => {
              const g = rowCell(draft, r);
              const merged = r.canMerge && g.allWeek;
              return (
                <tr key={r.key}>
                  <td className="cell--fixed">
                    <div className="ga-goal-table__pad stack">
                      <span className="fw-600">{r.label}</span>
                      {r.canMerge && editable && (
                        <label className="row gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={g.allWeek}
                            onChange={(e) => update((d) => (((d.grid[r.key] ||= rowCell(d, r)).allWeek = e.target.checked), d))}
                          />
                          Cả tuần
                        </label>
                      )}
                    </div>
                  </td>
                  {merged ? (
                    <td colSpan={5}>
                      <ActivityCell {...cellProps(r, 'all')}>
                        <Cell
                          editable={editable}
                          value={g.common}
                          label={`${r.label} cả tuần`}
                          onChange={(v) => update((d) => (((d.grid[r.key] ||= rowCell(d, r)).common = v), d))}
                        />
                      </ActivityCell>
                    </td>
                  ) : (
                    g.days.map((v, i) => (
                      <td key={i}>
                        <ActivityCell {...cellProps(r, i)}>
                          {r.key === 'hoc' ? (
                            <>
                              <Cell
                                editable={editable}
                                value={v.subject}
                                label={`Môn ${WEEKDAY_LABELS[i]}`}
                                placeholder="Môn / lĩnh vực"
                                onChange={(x) => update((d) => ((d.grid.hoc.days[i].subject = x), d))}
                              />
                              <Cell
                                editable={editable}
                                value={v.topic}
                                label={`Đề tài ${WEEKDAY_LABELS[i]}`}
                                placeholder="Đề tài"
                                onChange={(x) => update((d) => ((d.grid.hoc.days[i].topic = x), d))}
                              />
                            </>
                          ) : (
                            <Cell
                              editable={editable}
                              value={v}
                              label={`${r.label} ${WEEKDAY_LABELS[i]}`}
                              onChange={(x) => update((d) => (((d.grid[r.key] ||= rowCell(d, r)).days[i] = x), d))}
                            />
                          )}
                        </ActivityCell>
                      </td>
                    ))
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function DayTab({ draft, index, editable, canEvaluate, update, goals = [] }) {
  const d = draft.days[index];
  const hoc = draft.grid.hoc?.days?.[index] || {};
  // Đề tài lấy từ ô Hoạt động học của ngày; MT của ngày lấy từ các hoạt động đã chọn ở kế hoạch tuần
  const topic = [hoc.subject, hoc.topic].filter((x) => x?.trim()).join(' – ');
  const dayGoals = dayGoalsOf(draft)
    [index].map((id) => goals.find((g) => g.id === id))
    .filter(Boolean);
  const setDay = (field, v) => update((x) => ((x.days[index][field] = v), x));
  const setStep = (key, field, v) => update((x) => ((x.days[index].steps[key][field] = v), x));
  return (
    <>
      <div className="section-title center">{longDay(d.date, index)}</div>
      <LabelTable
        rows={[
          {
            label: 'Đề tài (Hoạt động học)',
            cell: (
              <div className="ga-goal-table__pad ga-cell-text">
                {topic || <span className="muted">Chưa ghi ở ô Hoạt động học của kế hoạch tuần</span>}
              </div>
            ),
          },
          {
            label: 'Mục tiêu trong ngày',
            cell: (
              <div className="ga-goal-table__pad ga-cell-text">
                {dayGoals.length ? (
                  dayGoals.map((g) => (
                    <div key={g.id}>
                      <span className="ga-goal-code">MT {g.no}</span> {g.text}
                    </div>
                  ))
                ) : (
                  <span className="muted">Chọn hoạt động từ gợi ý ở kế hoạch tuần để hệ thống nhớ MT của ngày</span>
                )}
              </div>
            ),
          },
        ]}
      />
      <div className="section-title">I. Mục đích yêu cầu</div>
      <LabelTable
        rows={[
          {
            label: 'Mục đích yêu cầu',
            cell: <Cell editable={editable} value={d.aims} label="Mục đích yêu cầu" onChange={(v) => setDay('aims', v)} />,
          },
        ]}
      />
      <div className="section-title">II. Chuẩn bị</div>
      <LabelTable
        rows={[
          {
            label: 'Chuẩn bị',
            cell: <Cell editable={editable} value={d.prep} label="Chuẩn bị của ngày" onChange={(v) => setDay('prep', v)} />,
          },
        ]}
      />
      <div className="section-title">III. Tiến trình hoạt động</div>
      <div className="table-wrap">
        <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
          <colgroup>
            <col />
            <col />
            <col className="ga-goal-table__group" />
          </colgroup>
          <thead>
            <tr>
              <th>Hoạt động của cô</th>
              <th>Hoạt động của trẻ</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {DAY_SECTIONS.map((s) => (
              <Fragment key={s.key}>
                <tr>
                  <td colSpan={3} className="cell--fixed">
                    <div className="ga-goal-table__pad fw-600">
                      {s.label}
                      {s.key === 'hoc' && (hoc.subject || hoc.topic) ? `: ${[hoc.subject, hoc.topic].filter(Boolean).join(' – ')}` : ''}
                    </div>
                  </td>
                </tr>
                {s.parts.map((p) => {
                  const key = `${s.key}.${p.key}`;
                  const st = d.steps[key];
                  return (
                    <Fragment key={key}>
                      {p.label && (
                        <tr>
                          <td colSpan={3}>
                            <div className="ga-goal-table__pad">
                              <i>{p.label}</i>
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td>
                          <Cell
                            editable={editable}
                            value={st.teacher}
                            label={`${s.label} ${p.label} – hoạt động của cô`}
                            onChange={(v) => setStep(key, 'teacher', v)}
                          />
                        </td>
                        <td>
                          <Cell
                            editable={editable}
                            value={st.child}
                            label={`${s.label} ${p.label} – hoạt động của trẻ`}
                            onChange={(v) => setStep(key, 'child', v)}
                          />
                        </td>
                        <td>
                          <Cell
                            editable={editable}
                            value={st.note}
                            label={`${s.label} ${p.label} – ghi chú`}
                            onChange={(v) => setStep(key, 'note', v)}
                          />
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="section-title">Sau buổi dạy</div>
      <LabelTable
        rows={[
          {
            label: 'Đánh giá trẻ trong ngày',
            cell: (
              <Cell editable={canEvaluate} value={d.evaluation} label="Đánh giá trẻ trong ngày" onChange={(v) => setDay('evaluation', v)} />
            ),
          },
          {
            label: 'Kế hoạch điều chỉnh và bổ sung',
            cell: (
              <Cell
                editable={canEvaluate}
                value={d.adjustment}
                label="Kế hoạch điều chỉnh và bổ sung"
                onChange={(v) => setDay('adjustment', v)}
              />
            ),
          },
        ]}
      />
    </>
  );
}
