import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Check, Copy, Plus, Trash2 } from '@/components/ui/icons';
import { AiDraftTag } from '@/components/ui/AiDraftTag';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { suggestLessonSteps } from '@/services/education-plan/educationPlanService';
import FloatingPanel from '@/components/education-plan/FloatingPanel';
import { FoldSection } from '@/components/education-plan/eduUi';
import { Cell, focusCell } from '@/components/education-plan/planUi';
import {
  DAY_REVIEW,
  DAY_SECTIONS,
  HOC_SUGGESTED_ROWS,
  NAME_MAX,
  PREP_TARGETS,
  TEXT_MAX,
  WEEKDAY_LABELS,
  activitiesForRow,
  activityBody,
  copyMergedRows,
  copyPrevCorners,
  cornersToGrid,
  addDays,
  cellKey,
  dayDraftFromWeek,
  dayGoalsOf,
  dayPlacedOf,
  copyLessonSteps,
  emptyRow,
  newCorner,
  rowsFromDraft,
  rowsSig,
  sectionHasContent,
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
function ActivityCell({ editable, suggestions, picks, text, onPick, onUnpick, flagOf = () => null, children }) {
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
          {picks.map((p) => {
            // Ô đỏ (BE:EDU-26): MT của hoạt động đổi / bị bỏ ở kế hoạch năm mới
            const flag = flagOf(p.goalId);
            const cls = `btn ${flag ? 'btn--outline-danger' : 'btn--outline-primary'} btn--sm`;
            const label = flag ? `${flag.label} !` : `MT${p.goalNo}`;
            return editable ? (
              <button
                key={p.id}
                type="button"
                className={cls}
                title={flag ? flag.message : `${p.text} (bấm để bỏ khỏi ô)`}
                aria-label={`Bỏ ${label} khỏi ô`}
                onClick={() => onUnpick(p.id)}
              >
                {label} ×
              </button>
            ) : (
              <span key={p.id} className={cls} title={flag ? flag.message : p.text}>
                {label}
              </span>
            );
          })}
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
function LabelTable({ rows, editable = false }) {
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
              <td className={editable ? 'cell--fixed' : ''}>
                <div className="ga-goal-table__pad fw-600">{r.label}</div>
              </td>
              <td className={editable ? 'ga-cell-editable' : ''}>{r.cell}</td>
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
  dayEditable = () => editable,
  update: rawUpdate,
  activities = [],
  placedElsewhere = new Set(),
  prevWeek = null,
  coverage = null,
  goals = [],
  flagOf = () => null,
}) {
  const [askDelete, setAskDelete] = useState(null);
  // Mỗi lần sửa bảng tuần: ô gõ tay trùng nội dung hoạt động của kế hoạch chủ đề thì tự nhớ MT
  const update = (fn) =>
    rawUpdate((d) =>
      linkTypedActivities(fn(d), activities, placedElsewhere, (day) => (typeof day === 'number' ? dayEditable(day) : editable)),
    );
  // Bảng góc là nguồn của dòng Góc trong bảng Thứ 2–6 (FR-015b)
  const editCorners = (fn) => rawUpdate((d) => cornersToGrid(fn(d)));
  const setCorner = (id, field, v) => editCorners((d) => ((d.corners.find((c) => c.id === id)[field] = v), d));
  const moveCorner = (i, to) =>
    editCorners((d) => {
      [d.corners[i], d.corners[to]] = [d.corners[to], d.corners[i]];
      return d;
    });
  const removeCorner = (id) =>
    editCorners((d) => {
      d.corners = d.corners.filter((c) => c.id !== id);
      if (d.picks?.['goc.all']) d.picks['goc.all'] = d.picks['goc.all'].filter((p) => p.cornerId !== id);
      return d;
    });
  const pickCorner = (id, a) =>
    rawUpdate((d) => {
      const list = ((d.picks ||= {})['goc.all'] ||= []);
      if (!list.some((p) => p.id === a.id && p.cornerId === id))
        list.push({ id: a.id, goalId: a.goalId, goalNo: a.goalNo, text: a.text, cornerId: id });
      const c = d.corners.find((x) => x.id === id);
      if (c && !c.content?.trim()) c.content = activityBody(a.text);
      return cornersToGrid(d);
    });
  const unpickCorner = (id, actId) =>
    rawUpdate((d) => {
      d.picks['goc.all'] = (d.picks?.['goc.all'] || []).filter((p) => !(p.id === actId && p.cornerId === id));
      return d;
    });
  const corners = draft.corners || [];
  const goalIds = new Set(goals.map((g) => g.id));
  const prevCorners = prevWeek?.corners?.length ? prevWeek : null;
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
    editable: typeof day === 'number' ? dayEditable(day) : editable,
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
    flagOf,
  });
  return (
    <>
      <FoldSection title="I. Mục đích yêu cầu">
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
          editable={editable}
          rows={AIMS.map((a) => ({
            label: a.label,
            cell: (
              <Cell
                editable={editable}
                value={draft.aims[a.key]}
                label={a.label}
                onChange={(v) => update((d) => ((d.aims[a.key] = v), d))}
              />
            ),
          }))}
        />
      </FoldSection>
      <FoldSection title="II. Chuẩn bị">
        <LabelTable
          editable={editable}
          rows={PREP_TARGETS.map((t) => ({
            label: t.label,
            cell: (
              <Cell
                editable={editable}
                value={draft.prep?.[t.key]}
                label={`Chuẩn bị ${t.label}`}
                onChange={(v) => update((d) => (((d.prep ||= {})[t.key] = v), d))}
              />
            ),
          }))}
        />
      </FoldSection>
      <FoldSection title="III. Tổ chức hoạt động">
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
                <th className={editable ? 'cell--fixed' : ''}>Tên hoạt động</th>
                {WEEKDAY_LABELS.map((l, i) => (
                  <th key={l} className={`center ${editable ? 'ga-th-editable' : ''}`}>
                    {l} · {ddmm(addDays(week.start, i))}
                    {week.offDays?.[i] && <div className="text-xs text-warning">Nghỉ: {week.offDays[i]}</div>}
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
                      <td className={editable ? 'cell--fixed' : ''}>
                        <div className="ga-goal-table__pad stack">
                          <span className="fw-600">{r.label}</span>
                          {r.canMerge && editable && r.key !== 'goc' && (
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
                      {r.key === 'goc' ? (
                        <td colSpan={5}>
                          <Cell editable={false} value={g.common} label={r.label} />
                          {editable && <div className="ga-goal-table__pad text-xs muted">Sửa ở bảng Hoạt động góc</div>}
                        </td>
                      ) : merged ? (
                        <td colSpan={5} className={editable ? 'ga-cell-editable' : ''}>
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
                          <td key={i} className={editable && dayEditable(i) ? 'ga-cell-editable' : ''}>
                            <ActivityCell {...cellProps(r, i)}>
                              {r.key === 'hoc' ? (
                                <>
                                  <Cell
                                    editable={dayEditable(i)}
                                    value={v.subject}
                                    label={`Môn ${WEEKDAY_LABELS[i]}`}
                                    placeholder="Môn / lĩnh vực"
                                    onChange={(x) => update((d) => ((d.grid.hoc.days[i].subject = x), d))}
                                  />
                                  <Cell
                                    editable={dayEditable(i)}
                                    value={v.topic}
                                    label={`Đề tài ${WEEKDAY_LABELS[i]}`}
                                    placeholder="Đề tài"
                                    onChange={(x) => update((d) => ((d.grid.hoc.days[i].topic = x), d))}
                                  />
                                </>
                              ) : (
                                <Cell
                                  editable={dayEditable(i)}
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
      </FoldSection>
      <FoldSection title="IV. Hoạt động góc">
        {editable && corners.length === 0 && (
          <div className="row row--wrap gap-2">
            <button
              type="button"
              className="btn btn--outline-primary btn--sm"
              disabled={!prevCorners}
              title={prevCorners ? undefined : 'Tuần trước chưa có bảng góc'}
              onClick={() => rawUpdate((d) => copyPrevCorners(d, prevCorners, goalIds))}
            >
              <Copy size={16} aria-hidden /> Chép bảng góc tuần trước
            </button>
          </div>
        )}
        <div className="table-wrap">
          <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
            <thead>
              <tr>
                <th>Góc</th>
                <th>Nội dung</th>
                <th>Mục đích, yêu cầu</th>
                <th>Chuẩn bị</th>
                <th>Cách tiến hành</th>
                {editable && <th className="cell--actions">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {corners.length === 0 && (
                <tr>
                  <td colSpan={editable ? 6 : 5}>
                    <div className="ga-goal-table__pad muted">Chưa có góc nào</div>
                  </td>
                </tr>
              )}
              {corners.map((c, i) => {
                const picks = (draft.picks?.['goc.all'] || []).filter((p) => p.cornerId === c.id);
                return (
                  <tr key={c.id}>
                    <td className={editable ? 'ga-cell-editable' : ''}>
                      <Cell
                        editable={editable}
                        value={c.name}
                        label={`Tên góc ${i + 1}`}
                        placeholder="Tên góc"
                        onChange={(v) => setCorner(c.id, 'name', v.slice(0, NAME_MAX))}
                      />
                    </td>
                    <td className={editable ? 'ga-cell-editable' : ''}>
                      <ActivityCell
                        editable={editable}
                        suggestions={activitiesForRow(activities, 'goc')}
                        picks={picks}
                        text={c.content}
                        onPick={(a) => pickCorner(c.id, a)}
                        onUnpick={(id) => unpickCorner(c.id, id)}
                        flagOf={flagOf}
                      >
                        <Cell
                          editable={editable}
                          value={c.content}
                          label={`Nội dung ${c.name || `góc ${i + 1}`}`}
                          onChange={(v) => setCorner(c.id, 'content', v)}
                        />
                      </ActivityCell>
                    </td>
                    {[
                      ['aims', 'Mục đích, yêu cầu'],
                      ['prep', 'Chuẩn bị'],
                      ['steps', 'Cách tiến hành'],
                    ].map(([f, name]) => (
                      <td key={f} className={editable ? 'ga-cell-editable' : ''}>
                        <Cell
                          editable={editable}
                          value={c[f]}
                          label={`${name} ${c.name || `góc ${i + 1}`}`}
                          onChange={(v) => setCorner(c.id, f, v)}
                        />
                        {(c[f] || '').length > TEXT_MAX && <p className="field__error ga-goal-table__pad">Tối đa {TEXT_MAX} ký tự.</p>}
                      </td>
                    ))}
                    {editable && (
                      <td className="cell--actions">
                        <div className="row gap-1 ga-goal-table__pad">
                          <button
                            type="button"
                            className="icon-btn"
                            disabled={i === 0}
                            aria-label={`Đưa góc ${i + 1} lên`}
                            title="Lên"
                            onClick={() => moveCorner(i, i - 1)}
                          >
                            <ArrowUp size={16} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            disabled={i === corners.length - 1}
                            aria-label={`Đưa góc ${i + 1} xuống`}
                            title="Xuống"
                            onClick={() => moveCorner(i, i + 1)}
                          >
                            <ArrowDown size={16} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn--danger"
                            aria-label={`Xóa góc ${c.name || i + 1}`}
                            title="Xóa góc"
                            onClick={() => setAskDelete(c)}
                          >
                            <Trash2 size={16} aria-hidden />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {editable && (
          <div className="row">
            <button
              type="button"
              className="btn btn--sm btn--outline-primary"
              onClick={() => editCorners((d) => ((d.corners = [...(d.corners || []), newCorner()]), d))}
            >
              <Plus size={16} aria-hidden /> Thêm góc
            </button>
          </div>
        )}
      </FoldSection>
      <ConfirmationModal
        open={!!askDelete}
        danger
        title="Xóa góc"
        message={
          askDelete ? `Xóa ${askDelete.name?.trim() ? `"${askDelete.name.trim()}"` : 'góc này'}? Nội dung và MT đã gắn của góc sẽ mất.` : ''
        }
        confirmLabel="Xóa"
        onConfirm={() => {
          removeCorner(askDelete.id);
          setAskDelete(null);
        }}
        onClose={() => setAskDelete(null)}
      />
    </>
  );
}

/** Ô chữ kèm lỗi chữ đỏ khi vượt giới hạn độ dài (spec 005 FR-023). */
function LimitedCell({ value, max = TEXT_MAX, ...props }) {
  const over = (value || '').length > max;
  return (
    <>
      <Cell value={value} {...props} />
      {over && (
        <p className="field__error ga-goal-table__pad">
          Tối đa {max} ký tự (đang {value.length}).
        </p>
      )}
    </>
  );
}

const STEP_FIELDS = [
  ['teacher', 'hoạt động của cô'],
  ['child', 'hoạt động của trẻ'],
  ['note', 'ghi chú'],
];

/** Bảng Tiến hành của một mục: dòng có tên tùy chọn, thêm/xóa/đổi thứ tự (FR-003, FR-004). */
function StepRows({ rows, editable, label, onChange, onAskDelete }) {
  const set = (i, field, v) => onChange(rows.map((r, n) => (n === i ? { ...r, [field]: v } : r)));
  const move = (i, to) => {
    const next = [...rows];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  };
  const remove = (i) => {
    const r = rows[i];
    const name = r.title?.trim() ? `"${r.title.trim()}"` : `dòng ${i + 1}`;
    if (sectionHasContent({ rows: [r] })) onAskDelete(name, () => onChange(rows.filter((_, n) => n !== i)));
    else onChange(rows.filter((_, n) => n !== i));
  };
  return (
    <>
      <div className="table-wrap">
        <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
          <colgroup>
            <col className="ga-goal-table__group" />
            <col />
            <col />
            <col className="ga-goal-table__group" />
            {editable && <col className="ga-goal-table__group" />}
          </colgroup>
          <thead>
            <tr>
              <th>Bước</th>
              <th>Hoạt động của cô</th>
              <th>Hoạt động của trẻ</th>
              <th>Ghi chú</th>
              {editable && <th className="cell--actions">Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={editable ? 5 : 4}>
                  <div className="ga-goal-table__pad muted">Chưa có dòng nào</div>
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className={editable ? 'ga-cell-editable' : ''}>
                  <LimitedCell
                    editable={editable}
                    max={NAME_MAX}
                    value={r.title}
                    label={`${label} – tên bước ${i + 1}`}
                    placeholder="Tên bước"
                    onChange={(v) => set(i, 'title', v)}
                  />
                </td>
                {STEP_FIELDS.map(([f, name]) => (
                  <td key={f} className={editable ? 'ga-cell-editable' : ''}>
                    <LimitedCell
                      editable={editable}
                      value={r[f]}
                      label={`${label} – ${name} dòng ${i + 1}`}
                      onChange={(v) => set(i, f, v)}
                    />
                  </td>
                ))}
                {editable && (
                  <td className="cell--actions">
                    <div className="row gap-1 ga-goal-table__pad">
                      <button
                        type="button"
                        className="icon-btn"
                        disabled={i === 0}
                        aria-label={`Đưa dòng ${i + 1} lên`}
                        title="Lên"
                        onClick={() => move(i, i - 1)}
                      >
                        <ArrowUp size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        disabled={i === rows.length - 1}
                        aria-label={`Đưa dòng ${i + 1} xuống`}
                        title="Xuống"
                        onClick={() => move(i, i + 1)}
                      >
                        <ArrowDown size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        aria-label={`Xóa dòng ${i + 1}`}
                        title="Xóa dòng"
                        onClick={() => remove(i)}
                      >
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <div className="row">
          <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => onChange([...rows, emptyRow()])}>
            <Plus size={16} aria-hidden /> Thêm dòng
          </button>
        </div>
      )}
    </>
  );
}

export function DayTab({
  draft,
  index,
  editable,
  update,
  goals = [],
  assessTo = null,
  reuse = [],
  flagOf = () => null,
  offLabel = null,
  emptySections = [],
}) {
  const [aiBusy, setAiBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(null);
  const d = draft.days[index];
  const hoc = draft.grid.hoc?.days?.[index] || {};
  const dayGoalIds = dayGoalsOf(draft)[index];
  const dayGoals = dayGoalIds.map((id) => goals.find((g) => g.id === id)).filter(Boolean);
  // MT trong ngày đổi / bị bỏ ở kế hoạch năm mới (BE:EDU-26): nêu bằng chữ, sửa ở ô của kế hoạch tuần
  const dayFlags = [...new Set(dayGoalIds)].map((id) => flagOf(id)).filter(Boolean);
  const setSec = (key, field, v) => update((x) => ((x.days[index].sections[key][field] = v), x));
  // Lấy từ kế hoạch tuần: điền ô trống và ô còn nguyên chữ của lần lấy trước (pulled); ô cô đã sửa giữ nguyên (FR-006)
  const fromWeek = dayDraftFromWeek(draft, index, goals);
  const pulled = d.pulled || {};
  const fields = DAY_SECTIONS.flatMap((s) => {
    const sec = d.sections[s.key];
    const fw = fromWeek[s.key];
    const rowsBlank = !(sec.rows || []).some((r) => r.teacher?.trim() || r.child?.trim() || r.note?.trim());
    return [
      ...['aims', 'prep'].map((f) => ({
        key: `${s.key}.${f}`,
        value: fw[f],
        ok: !!fw[f] && (!sec[f]?.trim() || sec[f] === pulled[`${s.key}.${f}`]) && sec[f] !== fw[f],
        set: (x) => (x.days[index].sections[s.key][f] = fw[f]),
      })),
      {
        key: `${s.key}.rows`,
        value: rowsSig(fw.rows),
        ok: fw.rows.length > 0 && (rowsBlank || rowsSig(sec.rows) === pulled[`${s.key}.rows`]) && rowsSig(sec.rows) !== rowsSig(fw.rows),
        set: (x) => (x.days[index].sections[s.key].rows = rowsFromDraft(fw.rows)),
      },
    ];
  });
  const fills = fields.filter((f) => f.ok);
  const fillFromWeek = () =>
    update((x) => {
      fills.forEach((f) => f.set(x));
      x.days[index].pulled = { ...pulled, ...Object.fromEntries(fills.map((f) => [f.key, f.value])) };
      return x;
    });
  // AI gợi ý tiến trình giờ học: a/b/c của API vào 3 dòng đầu của mục học, chỉ ô trống; ghi lại để cô Giữ / Bỏ
  const aiSteps = async () => {
    setAiBusy(true);
    try {
      const topics = String(hoc.topic || '')
        .split('\n')
        .map((l) => l.replace(/^[\s\-–•+*]+/, '').trim())
        .filter(Boolean);
      const res = await suggestLessonSteps({ subject: hoc.subject || '', topics, goals: dayGoals.map((g) => g.text) });
      update((x) => {
        const rows = x.days[index].sections.hoc.rows;
        const filled = [];
        ['a', 'b', 'c'].forEach((p, i) => {
          if (!rows[i]) rows.push(emptyRow(HOC_SUGGESTED_ROWS[i]));
          ['teacher', 'child'].forEach((f) => {
            const v = res?.[p]?.[f];
            if (v && !rows[i][f]?.trim()) {
              rows[i][f] = v;
              filled.push({ id: rows[i].id, f, v });
            }
          });
        });
        if (filled.length) x.days[index].aiSteps = filled;
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
      if (!keep)
        (day.aiSteps || []).forEach(({ id, f, v }) => {
          const r = day.sections.hoc.rows.find((y) => y.id === id);
          if (r && r[f] === v) r[f] = '';
        });
      delete day.aiSteps;
      return x;
    });
  const missing = DAY_SECTIONS.filter((s) => emptySections.includes(s.key));
  return (
    <>
      <div className="section-title center">{longDay(d.date, index)}</div>
      {/* BE:EDU-41: ngày trùng đợt nghỉ không bắt buộc soạn */}
      {offLabel && <p className="text-sm text-warning center">Ngày nghỉ: {offLabel}</p>}
      {(editable || assessTo) && (
        <div className="row row--wrap gap-2">
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
              title={fills.length ? undefined : 'Kế hoạch tuần chưa có gì mới để lấy'}
              onClick={fillFromWeek}
            >
              Lấy từ kế hoạch tuần
            </button>
          )}
          {editable && reuse.length > 0 && (
            <button
              type="button"
              className="btn btn--outline-primary btn--sm"
              onClick={() => update((x) => copyLessonSteps(x, index, reuse[0].rows))}
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
          <span className="text-sm">Tiến trình giờ học do AI gợi ý, cô xem và sửa lại.</span>
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
      {missing.length > 0 && (
        <p className="field__error" role="alert">
          Chưa có nội dung: {missing.map((s) => s.label.replace(/^\d+\.\s*/, '')).join(', ')}.
        </p>
      )}
      {dayFlags.map((f) => (
        <p key={f.ref} className="field__error">
          {f.label}: {f.message}
        </p>
      ))}
      <div className="section-title">I. Giáo án</div>
      {DAY_SECTIONS.map((s) => {
        const sec = d.sections[s.key];
        const fw = fromWeek[s.key];
        return (
          <FoldSection key={s.key} title={`${s.label}${fw.name ? `: ${fw.name}` : ''}`}>
            {missing.some((m) => m.key === s.key) && <p className="field__error">Mục này chưa có nội dung.</p>}
            {fw.goals.length > 0 && (
              <div className="ga-cell-text">
                {fw.goals.map((g) => (
                  <div key={g.id}>
                    <span className="ga-goal-code">MT{g.no}</span> {g.text}
                  </div>
                ))}
              </div>
            )}
            <LabelTable
              editable={editable}
              rows={[
                {
                  label: 'a) Mục đích, yêu cầu',
                  cell: (
                    <LimitedCell
                      editable={editable}
                      value={sec.aims}
                      label={`${s.label} – mục đích, yêu cầu`}
                      onChange={(v) => setSec(s.key, 'aims', v)}
                    />
                  ),
                },
                {
                  label: 'b) Chuẩn bị',
                  cell: (
                    <LimitedCell
                      editable={editable}
                      value={sec.prep}
                      label={`${s.label} – chuẩn bị`}
                      onChange={(v) => setSec(s.key, 'prep', v)}
                    />
                  ),
                },
              ]}
            />
            <div className="fw-600">c) Tiến hành</div>
            <StepRows
              rows={sec.rows}
              editable={editable}
              label={s.label}
              onChange={(rows) => setSec(s.key, 'rows', rows)}
              onAskDelete={(name, run) => setAskDelete({ name, run })}
            />
          </FoldSection>
        );
      })}
      <FoldSection title="II. Đánh giá trẻ trên ngày">
        <LabelTable
          editable={editable}
          rows={DAY_REVIEW.map((r) => ({
            label: r.label,
            cell: (
              <LimitedCell
                editable={editable}
                value={d.review?.[r.key]}
                label={r.label}
                onChange={(v) => update((x) => (((x.days[index].review ||= {})[r.key] = v), x))}
              />
            ),
          }))}
        />
      </FoldSection>
      <ConfirmationModal
        open={!!askDelete}
        danger
        title="Xóa dòng tiến hành"
        message={askDelete ? `Xóa ${askDelete.name}? Nội dung của dòng này sẽ mất.` : ''}
        confirmLabel="Xóa"
        onConfirm={() => {
          askDelete?.run();
          setAskDelete(null);
        }}
        onClose={() => setAskDelete(null)}
      />
    </>
  );
}
