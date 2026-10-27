import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from '@/components/ui/icons';
import { AiDraftTag } from '@/components/ui/AiDraftTag';
import { suggestLessonSteps } from '@/services/education-plan/educationPlanService';
import FloatingPanel from '@/components/education-plan/FloatingPanel';
import { Cell, focusCell } from '@/components/education-plan/planUi';
import {
  DAY_SECTIONS,
  WEEKDAY_LABELS,
  activitiesForRow,
  activityBody,
  copyMergedRows,
  addDays,
  cellKey,
  dayDraftFromWeek,
  dayGoalsOf,
  dayPlacedOf,
  copyLessonSteps,
  hocTitle,
  weekAimsFromGoals,
  ddmm,
  longDay,
  linkTypedActivities,
  rowCell,
  weekRows,
} from '@/models/education-plan/classPlan';
import { mtList } from '@/models/education-plan/goalTable';

/**
 * Ô của kế hoạch tuần có gợi ý hoạt động từ kế hoạch chủ đề (lọc theo loại giờ của dòng). Chọn gợi ý thì ghi nội dung
 * vào ô và nhớ MT của hoạt động; vẫn gõ tự do được. MT đã nhớ hiện thành nhãn dưới ô.
 */
function ActivityCell({ editable, suggestions, picks, text, onPick, onUnpick, children }) {
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
    <div ref={ref} className="ga-act-cell" onFocus={() => editable && suggestions.length > 0 && setOpen(true)}>
      {children}
      {/* Nhãn MT và "Chưa gắn MT" cùng một kiểu nút, luôn ở góc trái dưới của ô (Tiền 20/10). Ô có chữ mà chưa gắn MT
          thì không có gì để đánh giá trẻ: bấm để mở gợi ý */}
      {(picks.length > 0 || (editable && text?.trim())) && (
        <div className="ga-act-cell__foot">
          {picks.map((p) =>
            editable ? (
              <button
                key={p.id}
                type="button"
                className="btn btn--outline-primary btn--sm"
                title={`${p.text} (bấm để bỏ khỏi ô)`}
                aria-label={`Bỏ MT${p.goalNo} khỏi ô`}
                onClick={() => onUnpick(p.id)}
              >
                MT{p.goalNo} ×
              </button>
            ) : (
              <span key={p.id} className="btn btn--outline-primary btn--sm" title={p.text}>
                MT{p.goalNo}
              </span>
            ),
          )}
          {!picks.length && (
            <button
              type="button"
              className="btn btn--sm"
              title="Chọn hoạt động từ gợi ý để ô nhớ MT (dùng cho kế hoạch ngày và đánh giá trẻ)"
              onClick={() => ref.current?.querySelector('.ga-cell-input')?.focus()}
            >
              Chưa gắn MT
            </button>
          )}
        </div>
      )}
      {open && (
        <FloatingPanel anchorRef={ref} panelRef={panelRef} minWidth={420}>
          {/* Khung gợi ý (Tiền 21/10, phương án A): nhãn MT xanh dương, loại giờ chữ xám, tên hoạt động; đã chọn nền xanh lá + ✓,
              bấm lại để bỏ chọn */}
          <div className="card ga-sug-panel">
            <div className="text-xs ga-sug-panel__hint">Chọn hoạt động cho ô (hoặc gõ tự do)</div>
            <div className="search-select__list" role="listbox" aria-label="Gợi ý từ kế hoạch chủ đề">
              {suggestions.map((a) => {
                const picked = pickedIds.has(a.id);
                const colon = a.text.indexOf(':');
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="option"
                    aria-selected={picked}
                    className={`ga-sug ${picked ? 'ga-sug--on' : ''}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => (picked ? onUnpick(a.id) : onPick(a))}
                  >
                    <span className="ga-sug__mt">MT{a.goalNo}</span>
                    <span className="ga-sug__body">
                      {colon > 0 && <span className="ga-sug__type">{a.text.slice(0, colon)}</span>}
                      <span className="ga-sug__text">{activityBody(a.text)}</span>
                    </span>
                    {picked && <Check size={16} className="ga-sug__check" aria-hidden />}
                  </button>
                );
              })}
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

export function WeekTab({
  draft,
  week,
  editable,
  update: rawUpdate,
  activities = [],
  placedElsewhere = new Set(),
  prevWeek = null,
  coverage = null,
  goals = [],
}) {
  // Mỗi lần sửa bảng tuần: ô gõ tay trùng nội dung hoạt động của kế hoạch chủ đề thì tự nhớ MT
  const update = (fn) => rawUpdate((d) => linkTypedActivities(fn(d), activities, placedElsewhere));
  // Chọn gợi ý: ghi nội dung vào ô (dòng mới) và nhớ MT của hoạt động cho ô đó
  const pick = (r, day, a) =>
    update((d) => {
      const key = cellKey(r.key, day);
      const list = (d.picks ||= {})[key] || [];
      if (list.some((p) => p.id === a.id)) return d;
      if (d.unlinked?.[key]) d.unlinked[key] = d.unlinked[key].filter((x) => x !== a.id);
      d.picks[key] = [...list, { id: a.id, goalId: a.goalId, goalNo: a.goalNo, text: a.text }];
      const g = (d.grid[r.key] ||= rowCell(d, r));
      const add = (old) => (old?.trim() ? `${old}\n${activityBody(a.text)}` : activityBody(a.text));
      if (day === 'all') g.common = add(g.common);
      else if (day === 'extra') g.extra = add(g.extra);
      else if (r.key === 'hoc') g.days[day].topic = add(g.days[day].topic);
      else g.days[day] = add(g.days[day]);
      return d;
    });
  const unpick = (r, day, id) =>
    rawUpdate((d) => {
      const key = cellKey(r.key, day);
      d.picks = { ...(d.picks || {}), [key]: (d.picks?.[key] || []).filter((p) => p.id !== id) };
      d.unlinked = { ...(d.unlinked || {}), [key]: [...new Set([...(d.unlinked?.[key] || []), id])] };
      return d;
    });
  // Hoạt động đã xếp vào ô ngày khác (tuần này hoặc tuần khác của chủ đề) thì không gợi ý lại; ô đang giữ vẫn thấy để bỏ chọn
  const placedHere = dayPlacedOf(draft);
  const cellProps = (r, day) => ({
    editable,
    suggestions: activitiesForRow(activities, r.key).filter((a) => {
      const at = placedHere.get(a.id);
      return at ? at === cellKey(r.key, day) : !placedElsewhere.has(a.id);
    }),
    picks: draft.picks?.[cellKey(r.key, day)] || [],
    text: (() => {
      const g = rowCell(draft, r);
      if (day === 'all') return g.common;
      if (day === 'extra') return g.extra;
      const v = g.days[day];
      return typeof v === 'string' ? v : `${v?.subject || ''}${v?.topic || ''}`;
    })(),
    onPick: (a) => pick(r, day, a),
    onUnpick: (id) => unpick(r, day, id),
  });
  return (
    <>
      <div className="section-title">I. Mục đích yêu cầu</div>
      {/* Gợi ý ô Kiến thức từ câu MT của các hoạt động đã xếp trong tuần (chỉ khi ô còn trống), cô viết lại thành câu */}
      {editable && !draft.aims.knowledge?.trim() && weekAimsFromGoals(draft, goals) && (
        <div className="row row--wrap gap-2">
          <button
            type="button"
            className="btn btn--outline-primary btn--sm"
            onClick={() => update((d) => ((d.aims.knowledge = weekAimsFromGoals(d, goals)), d))}
          >
            Gợi ý Kiến thức từ MT đã xếp trong tuần
          </button>
        </div>
      )}
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
      {(coverage || (editable && prevWeek)) && (
        <div className="row row--wrap gap-2">
          {coverage && (
            <span className="muted text-sm">
              Cả chủ đề: đã xếp {coverage.placed}/{coverage.total} hoạt động, phủ {coverage.covered}/{coverage.goals} MT
              {coverage.missingGoals.length > 0 && ` · còn thiếu ${mtList(coverage.missingGoals.map((g) => g.no))}`}
            </span>
          )}
          {editable && prevWeek && (
            <button
              type="button"
              className="btn btn--outline-primary btn--sm"
              title="Chép các dòng cả tuần (Đón trẻ, Trò chuyện, Thể dục sáng, Chơi ở các góc, Trả trẻ…) còn trống từ tuần trước"
              onClick={() => update((d) => copyMergedRows(d, prevWeek))}
            >
              Lấy dòng cả tuần từ tuần trước
            </button>
          )}
        </div>
      )}
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
                <Fragment key={r.key}>
                  <tr>
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
                  {/* Phần chung cả tuần dưới 5 ô ngày (mẫu Thái Dương: Chơi tự do, Chơi tự chọn, Nêu gương cuối ngày) */}
                  {!merged && r.extraLabel && (editable || g.extra?.trim()) && (
                    <tr>
                      <td className="cell--fixed">
                        <div className="ga-goal-table__pad text-sm">{r.label} (cả tuần)</div>
                      </td>
                      <td colSpan={5}>
                        <ActivityCell {...cellProps(r, 'extra')}>
                          <Cell
                            editable={editable}
                            value={g.extra}
                            label={`${r.label} cả tuần`}
                            placeholder={r.extraLabel}
                            onChange={(v) => update((d) => (((d.grid[r.key] ||= rowCell(d, r)).extra = v), d))}
                          />
                        </ActivityCell>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function DayTab({ draft, index, editable, update, goals = [], assessTo = null, reuse = [] }) {
  const [aiBusy, setAiBusy] = useState(false);
  const d = draft.days[index];
  const hoc = draft.grid.hoc?.days?.[index] || {};
  // Đề tài lấy từ ô Hoạt động học của ngày; MT của ngày lấy từ các hoạt động đã chọn ở kế hoạch tuần
  const topic = hocTitle(hoc);
  const dayGoals = dayGoalsOf(draft)
    [index].map((id) => goals.find((g) => g.id === id))
    .filter(Boolean);
  const setDay = (field, v) => update((x) => ((x.days[index][field] = v), x));
  const setStep = (key, field, v) => update((x) => ((x.days[index].steps[key][field] = v), x));
  // Lấy từ kế hoạch tuần: điền ô trống và ô còn nguyên chữ của lần lấy trước (pulled), nên sửa tuần rồi lấy lại được;
  // ô cô đã sửa thì giữ nguyên
  const fromWeek = dayDraftFromWeek(draft, index, goals);
  const pulled = d.pulled || {};
  const fields = [
    { key: 'aims', value: fromWeek.aims, cur: d.aims, set: (x, v) => (x.days[index].aims = v) },
    { key: 'prep', value: fromWeek.prep, cur: d.prep, set: (x, v) => (x.days[index].prep = v) },
    ...Object.keys(d.steps)
      .filter((k) => k in fromWeek.steps || k in pulled)
      .map((k) => ({
        key: k,
        value: fromWeek.steps[k] || '',
        cur: d.steps[k]?.teacher,
        set: (x, v) => (x.days[index].steps[k].teacher = v),
      })),
  ];
  const fills = fields.filter((f) => (!f.cur?.trim() || f.cur === pulled[f.key]) && (f.cur || '') !== f.value);
  // AI gợi ý tiến trình a/b/c của giờ học: chỉ điền ô trống, ghi lại ô đã điền (aiSteps) để cô Giữ / Bỏ
  const aiSteps = async () => {
    setAiBusy(true);
    try {
      const topics = String(hoc.topic || '')
        .split('\n')
        .map((l) => l.replace(/^[\s\-–•+*]+/, '').trim())
        .filter(Boolean);
      const res = await suggestLessonSteps({ subject: hoc.subject || '', topics, goals: dayGoals.map((g) => g.text) });
      update((x) => {
        const day = x.days[index];
        const filled = [];
        ['a', 'b', 'c'].forEach((p) =>
          ['teacher', 'child'].forEach((f) => {
            const v = res?.[p]?.[f];
            if (v && !day.steps[`hoc.${p}`][f]?.trim()) {
              day.steps[`hoc.${p}`][f] = v;
              filled.push({ k: `hoc.${p}`, f, v });
            }
          }),
        );
        if (filled.length) day.aiSteps = filled;
        return x;
      });
    } finally {
      setAiBusy(false);
    }
  };
  const settleAi = (keep) =>
    update((x) => {
      const day = x.days[index];
      // Bỏ: chỉ xóa ô cô chưa sửa lại sau khi AI điền
      if (!keep) (day.aiSteps || []).forEach(({ k, f, v }) => day.steps[k][f] === v && (day.steps[k][f] = ''));
      delete day.aiSteps;
      return x;
    });
  const fillFromWeek = () =>
    update((x) => {
      fills.forEach((f) => f.set(x, f.value));
      x.days[index].pulled = { ...pulled, ...Object.fromEntries(fills.map((f) => [f.key, f.value])) };
      return x;
    });
  return (
    <>
      <div className="section-title center">{longDay(d.date, index)}</div>
      {(editable || assessTo) && (
        <div className="row row--wrap gap-2">
          {/* Giáo án đã duyệt: sang trang Đánh giá hằng ngày đúng lớp, ngày (tiêu chí lấy từ kế hoạch ngày này) */}
          {assessTo && (
            <Link className="btn btn--outline-primary btn--sm" to={assessTo}>
              Đánh giá trẻ ngày này
            </Link>
          )}
          {editable && (
            <button
              type="button"
              className="btn btn--outline-primary btn--sm"
              disabled={!fills.length}
              title={
                fills.length
                  ? 'Điền mục đích, chuẩn bị, tiến trình từ ô kế hoạch tuần của ngày này (ô trống hoặc ô chưa sửa từ lần lấy trước)'
                  : 'Kế hoạch tuần chưa có gì mới để lấy (ô cô đã tự sửa được giữ nguyên)'
              }
              onClick={fillFromWeek}
            >
              Lấy từ kế hoạch tuần
            </button>
          )}
          {/* Dùng lại tiến trình đã soạn cho cùng môn + nội dung chính (lớp khác, năm trước): chỉ điền ô trống */}
          {editable && reuse.length > 0 && (
            <button
              type="button"
              className="btn btn--outline-primary btn--sm"
              title={`Chép tiến trình a/b/c đã soạn ngày ${ddmm(reuse[0].date)} vào các ô còn trống của giờ học`}
              onClick={() => update((x) => copyLessonSteps(x, index, reuse[0].steps))}
            >
              Dùng lại bài đã soạn ({ddmm(reuse[0].date)})
            </button>
          )}
          {editable && (hoc.subject || hoc.topic) && (
            <button type="button" className="btn btn--outline-primary btn--sm" disabled={aiBusy} onClick={aiSteps}>
              {aiBusy ? 'AI đang soạn…' : 'AI gợi ý tiến trình giờ học'}
            </button>
          )}
        </div>
      )}
      {d.aiSteps?.length > 0 && (
        <div className="row row--wrap gap-2">
          <AiDraftTag />
          <span className="text-sm">Tiến trình giờ học do AI gợi ý, cô xem và sửa lại cho phù hợp với lớp.</span>
          {editable && (
            <>
              <button type="button" className="btn btn--primary btn--sm" onClick={() => settleAi(true)}>
                Giữ
              </button>
              <button type="button" className="btn btn--sm" onClick={() => settleAi(false)}>
                Bỏ
              </button>
            </>
          )}
        </div>
      )}
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
                      <span className="ga-goal-code">MT{g.no}</span> {g.text}
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
                      {s.key === 'hoc' && topic ? `: ${topic}` : ''}
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
    </>
  );
}
