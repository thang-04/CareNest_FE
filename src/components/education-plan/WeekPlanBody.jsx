import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, Check, Copy, Download, Plus, Sparkles, Trash2 } from '@/components/ui/icons';
import { RowMenu } from '@/components/ui/RowMenu';
import { AiDraftTag } from '@/components/ui/AiDraftTag';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { suggestLessonSteps } from '@/services/education-plan/educationPlanService';
import FloatingPanel from '@/components/education-plan/FloatingPanel';
import { Card } from '@/components/education-plan/eduUi';
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
  droppedFromWeek,
  copyLessonSteps,
  emptyRow,
  newCorner,
  rowsFromDraft,
  rowsSig,
  sectionHasContent,
  SECTION_PARTS,
  partsOff,
  removePart,
  restorePart,
  weekAimsFromGoals,
  ddmm,
  longDay,
  linkTypedActivities,
  pickOf,
  resolveGoals,
  rowCell,
  teachingDayUnlinked,
  weekRows,
} from '@/models/education-plan/classPlan';
import { mtList } from '@/models/education-plan/goalTable';

/**
 * Ô của kế hoạch tuần có gợi ý hoạt động từ kế hoạch chủ đề (lọc theo loại giờ của dòng). Chọn gợi ý thì ghi nội dung
 * vào ô và nhớ MT của hoạt động; vẫn gõ tự do được. MT đã nhớ hiện thành nhãn dưới ô.
 */
function ActivityCell({
  editable,
  suggestions,
  picks,
  text,
  onPick,
  onUnpick,
  flagOf = () => null,
  goalsOfPick = (p) => (p.goalId != null ? [{ id: p.goalId, no: p.goalNo }] : []),
  onCreateCard = null,
  changed = false,
  children,
}) {
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
  const pickedIds = new Set(picks.map((p) => p.cardId ?? p.id));
  return (
    <div ref={ref} className="ga-act-cell" onFocus={() => editable && suggestions.length > 0 && setOpen(true)}>
      {children}
      {/* Nhãn MT và "Chưa gắn MT" cùng một kiểu nút, luôn ở góc trái dưới của ô (Tiền 20/10). Ô có chữ mà chưa gắn MT
          thì không có gì để đánh giá trẻ: bấm để mở gợi ý */}
      {(picks.length > 0 || (editable && text?.trim())) && (
        <div className="ga-act-cell__foot">
          {picks.map((p, i) => {
            // Chip của lượt xếp: MT theo thẻ (FR-019, FR-026); ô đỏ (BE:EDU-26) khi MT đổi / bị bỏ ở kế hoạch năm mới
            const goals = goalsOfPick(p);
            const flag = goals.map((g) => flagOf(g.id)).find(Boolean);
            const cls = `btn ${flag ? 'btn--outline-danger' : goals.length ? 'btn--outline-primary' : 'btn--outline-danger'} btn--sm`;
            const mts = goals.map((g) => `MT${g.no}`).join(', ');
            const label = flag ? `${flag.label} !` : mts || 'Chưa gắn MT';
            const key = `${p.cardId ?? p.id ?? 'typed'}-${i}`;
            return editable ? (
              <button
                key={key}
                type="button"
                className={cls}
                title={flag ? flag.message : `${p.text} (bấm để bỏ khỏi ô)`}
                aria-label={`Bỏ ${label} khỏi ô`}
                onClick={() => onUnpick(p.cardId ?? p.id)}
              >
                {label} ×
              </button>
            ) : (
              <span key={key} className={cls} title={flag ? flag.message : p.text}>
                {label}
              </span>
            );
          })}
          {!picks.length && (
            <button
              type="button"
              className="btn btn--sm btn--outline-danger"
              title="Chọn hoạt động từ gợi ý để ô nhớ MT (dùng cho kế hoạch ngày và đánh giá trẻ)"
              onClick={() => ref.current?.querySelector('.ga-cell-input')?.focus()}
            >
              Chưa gắn MT
            </button>
          )}
          {/* FR-014: hoạt động gõ tay gắn MT bằng cách tạo thẻ, không chọn MT riêng tại ô */}
          {editable && onCreateCard && !picks.length && text?.trim() && (
            <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => onCreateCard(text)}>
              Tạo thẻ từ hoạt động này
            </button>
          )}
        </div>
      )}
      {changed && <div className="text-xs text-warning ga-goal-table__pad">Khác bản theo kỳ</div>}
      {open && (
        <FloatingPanel anchorRef={ref} panelRef={panelRef} minWidth={420}>
          {/* Khung gợi ý (Tiền 21/10, phương án A): nhãn MT xanh dương, loại giờ chữ xám, tên hoạt động; đã chọn nền xanh lá + ✓,
              bấm lại để bỏ chọn */}
          <div className="card ga-sug-panel">
            <div className="text-xs ga-sug-panel__hint">Chọn hoạt động cho ô (hoặc gõ tự do)</div>
            <div className="search-select__list" role="listbox" aria-label="Gợi ý từ kế hoạch chủ đề">
              {suggestions.map((a, i) => {
                const picked = pickedIds.has(a.id);
                const colon = a.text.indexOf(':');
                return (
                  <Fragment key={a.id}>
                    {/* FR-019: thẻ khác loại giờ của dòng (cả thẻ "chưa rõ") ở nhóm "Khác" */}
                    {a.other && !suggestions[i - 1]?.other && <div className="text-xs ga-sug-panel__hint">Khác</div>}
                    <button
                      type="button"
                      role="option"
                      aria-selected={picked}
                      className={`ga-sug ${picked ? 'ga-sug--on' : ''}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => (picked ? onUnpick(a.id) : onPick(a))}
                    >
                      <span className="ga-sug__mt">{a.goalNos?.length ? a.goalNos.map((n) => `MT${n}`).join(', ') : 'Chưa gắn MT'}</span>
                      <span className="ga-sug__body">
                        {colon > 0 && <span className="ga-sug__type">{a.text.slice(0, colon)}</span>}
                        <span className="ga-sug__text">{activityBody(a.text)}</span>
                      </span>
                      {picked && <Check size={16} className="ga-sug__check" aria-hidden />}
                    </button>
                  </Fragment>
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

/** Phần lớn của trang soạn: thẻ thu gọn được. */
function Section({ title, children }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Card title={title} bodyClass="card__body stack" collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)}>
      {children}
    </Card>
  );
}

export function WeekTab({
  draft,
  week,
  editable,
  dayEditable = () => editable,
  update: rawUpdate,
  activities = [],
  cards = [],
  prevWeek = null,
  summary = null,
  goals = [],
  flagOf = () => null,
  onCreateCard = null,
  changedCells = null,
}) {
  const [askDelete, setAskDelete] = useState(null);
  // Mỗi lần sửa bảng tuần: ô gõ tay trùng tên thẻ của kế hoạch chủ đề thì tự nhớ thẻ (một thẻ xếp được nhiều ô — FR-009)
  const update = (fn) =>
    rawUpdate((d) => linkTypedActivities(fn(d), activities, (day) => (typeof day === 'number' ? dayEditable(day) : editable)));
  const goalsOfPick = (p) =>
    resolveGoals(p, cards)
      .map((id) => goals.find((g) => String(g.id) === id))
      .filter(Boolean);
  // Bảng phủ MT mở tuần kèm #cov-day-n: cuộn tới đúng cột ngày (FR-023)
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id.startsWith('cov-day-')) document.getElementById(id)?.scrollIntoView({ block: 'center', inline: 'center' });
  }, []);
  // Bảng góc là nguồn của dòng Góc trong bảng Thứ 2–6 (FR-015b)
  const editCorners = (fn) => rawUpdate((d) => cornersToGrid(fn(d)));
  const setCorner = (id, field, v) => editCorners((d) => ((d.corners.find((c) => c.id === id)[field] = v), d));
  // Thêm góc như bảng kế hoạch năm học: gõ tên ở dòng trống cuối bảng, hoặc Enter ở ô tên góc (Tiền 11/11/2026).
  // Dòng trống giữ sẵn id nên ô đang gõ không mất con trỏ khi thành góc thật
  const cornerTrail = useRef(null);
  const corners0 = draft.corners || [];
  if (!cornerTrail.current || corners0.some((c) => c.id === cornerTrail.current)) cornerTrail.current = newCorner().id;
  const [focusCorner, setFocusCorner] = useState(null);
  useEffect(() => {
    if (!focusCorner) return;
    document.querySelector(`[data-corner-id="${CSS.escape(focusCorner)}"] textarea`)?.focus();
    setFocusCorner(null);
  }, [focusCorner]);
  // Bộ gõ tiếng Việt đang ghép chữ (Telex của Windows…) để trình duyệt chèn "\n" vào ô khi Enter: nhớ Enter thường rồi
  // đổi "\n" đó thành thao tác Enter của bảng ở onChange (cornerInput). Shift+Enter vẫn xuống dòng trong ô nhiều dòng.
  const plainEnter = useRef(false);
  const cornerKeys = (i) => (e) => {
    if (e.key !== 'Enter') {
      plainEnter.current = false;
      return;
    }
    plainEnter.current = !e.shiftKey;
    if (e.shiftKey || e.isComposing || e.nativeEvent?.isComposing) return;
    e.preventDefault();
    plainEnter.current = false;
    cornerEnter(i);
  };
  // fields: giá trị mới nhất của dòng (onChange chưa kịp vào draft) để Enter ngay sau khi gõ vẫn tạo dòng
  const cornerEnter = (i, fields = corners0[i]) => {
    const current = fields;
    if (!current) return;
    if (!['name', 'content', 'aims', 'prep', 'steps'].some((field) => current[field]?.trim())) return;
    const next = corners0[i + 1];
    if (next && !['name', 'content', 'aims', 'prep', 'steps'].some((field) => next[field]?.trim())) {
      setFocusCorner(next.id);
      return;
    }
    const corner = newCorner();
    editCorners((d) => (d.corners.splice(i + 1, 0, corner), d));
    setFocusCorner(corner.id);
  };
  /** onChange của ô bảng góc: bỏ "\n" do Enter qua bộ gõ (tên góc không bao giờ có xuống dòng) rồi xử lý như Enter. */
  const cornerInput = (i, c, field, max) => (v) => {
    const prev = c?.[field] || '';
    let next = v;
    let enter = false;
    if (field === 'name' ? v.includes('\n') : plainEnter.current && v.split('\n').length > prev.split('\n').length) {
      let at = 0;
      while (at < prev.length && v[at] === prev[at]) at += 1;
      next = field === 'name' ? v.replace(/\r?\n/g, '') : v.slice(0, at) + v.slice(at + 1);
      enter = plainEnter.current || field === 'name';
    }
    plainEnter.current = false;
    if (max) next = next.slice(0, max);
    if (c) setCorner(c.id, field, next);
    if (enter) cornerEnter(i, { ...c, [field]: next });
  };
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
      if (!list.some((p) => (p.cardId ?? p.id) === a.id && p.cornerId === id)) list.push(pickOf(a, id));
      const c = d.corners.find((x) => x.id === id);
      if (c && !c.content?.trim()) c.content = activityBody(a.text);
      return cornersToGrid(d);
    });
  const unpickCorner = (id, actId) =>
    rawUpdate((d) => {
      d.picks['goc.all'] = (d.picks?.['goc.all'] || []).filter((p) => !((p.cardId ?? p.id) === actId && p.cornerId === id));
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
      if (list.some((p) => (p.cardId ?? p.id) === a.id)) return d;
      if (d.unlinked?.[key]) d.unlinked[key] = d.unlinked[key].filter((x) => x !== a.id);
      d.picks[key] = [...list, pickOf(a)];
      const g = (d.grid[r.key] ||= rowCell(d, r));
      const body = activityBody(a.text);
      const add = (old, v = body) => (old?.trim() ? `${old}\n${v}` : v);
      if (day === 'all') g.common = add(g.common);
      else if (day === 'extra') g.extra = add(g.extra);
      else if (r.key === 'hoc') {
        // FR-020: thẻ "Môn: đề tài" điền Môn và Đề tài; không có ":" thì chỉ điền Đề tài
        const colon = a.card && !a.card.legacy ? body.indexOf(':') : -1;
        if (colon > 0 && !g.days[day].subject?.trim()) {
          g.days[day].subject = body.slice(0, colon).trim();
          g.days[day].topic = add(g.days[day].topic, body.slice(colon + 1).trim());
        } else g.days[day].topic = add(g.days[day].topic);
      } else g.days[day] = add(g.days[day]);
      return d;
    });
  const unpick = (r, day, id) =>
    rawUpdate((d) => {
      const key = cellKey(r.key, day);
      d.picks = { ...(d.picks || {}), [key]: (d.picks?.[key] || []).filter((p) => (p.cardId ?? p.id) !== id) };
      d.unlinked = { ...(d.unlinked || {}), [key]: [...new Set([...(d.unlinked?.[key] || []), id])] };
      return d;
    });
  // FR-009: một thẻ xếp được nhiều ô, nhiều tuần nên luôn gợi ý đủ thẻ
  const cellProps = (r, day) => ({
    editable: typeof day === 'number' ? dayEditable(day) : editable,
    suggestions: activitiesForRow(activities, r.key),
    picks: draft.picks?.[cellKey(r.key, day)] || [],
    goalsOfPick,
    changed: !!changedCells?.has(cellKey(r.key, day)),
    onCreateCard: onCreateCard && ((text) => onCreateCard(r, day, text)),
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
      <Section title="I. Mục đích yêu cầu">
        {/* Gợi ý ô Kiến thức từ câu MT của các hoạt động đã xếp trong tuần (chỉ khi ô còn trống), cô viết lại thành câu */}
        {editable && !draft.aims.knowledge?.trim() && weekAimsFromGoals(draft, goals, cards) && (
          <div className="row row--wrap gap-2">
            <button
              type="button"
              className="btn btn--outline-primary btn--sm"
              onClick={() => update((d) => ((d.aims.knowledge = weekAimsFromGoals(d, goals, cards)), d))}
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
      </Section>
      <Section title="II. Chuẩn bị">
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
      </Section>
      <Section title="III. Tổ chức hoạt động">
        {editable && prevWeek && (
          <div className="row row--wrap gap-2">
            {editable && prevWeek && (
              <button
                type="button"
                className="btn btn--outline-primary btn--sm"
                title="Chép các dòng cả tuần (Đón trẻ, Trò chuyện, Thể dục sáng, Hoạt động góc, Trả trẻ…) còn trống từ tuần trước"
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
                  <th key={l} id={`cov-day-${i}`} className={`center ${editable ? 'ga-th-editable' : ''}`}>
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
        {/* FR-022: dòng tổng dưới bảng tuần */}
        {summary && (
          <p className="muted text-sm">
            Tuần này: {summary.week.placed} lượt xếp, phủ {summary.week.covered} MT
            {summary.week.unlinked.length > 0 && `, ${summary.week.unlinked.length} ô gõ tay chưa gắn MT`} · Cả chủ đề: phủ{' '}
            {summary.theme.covered}/{summary.theme.total} MT
            {summary.theme.missing.length > 0 && (
              <>
                {' '}
                · còn thiếu{' '}
                {/* Sang tab Bảng phủ MT qua guard của trang (hỏi khi còn thay đổi chưa lưu); điều hướng bằng nút, không đặt liên kết */}
                {summary.onOpenCoverage ? (
                  <button type="button" className="btn btn--sm" onClick={summary.onOpenCoverage}>
                    {mtList(summary.theme.missing.map((g) => g.no))}
                  </button>
                ) : (
                  mtList(summary.theme.missing.map((g) => g.no))
                )}
              </>
            )}
          </p>
        )}
      </Section>
      <Section title="IV. Hoạt động góc">
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
            {/* Bảng chia đều cột; cột Thao tác (3 nút lên / xuống / xóa) cần độ rộng riêng, không bị ép thành chữ dọc */}
            <colgroup>
              <col />
              <col />
              <col />
              <col />
              <col />
              {editable && <col className="ga-col-row-actions" />}
            </colgroup>
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
              {!editable && corners.length === 0 && (
                <tr>
                  <td colSpan={editable ? 6 : 5}>
                    <div className="ga-goal-table__pad muted">Chưa có góc nào</div>
                  </td>
                </tr>
              )}
              {/* Dòng trống cuối nằm chung danh sách với các góc để ô tên đang gõ giữ con trỏ khi thành góc thật */}
              {(editable ? [...corners, { id: cornerTrail.current, trail: true }] : corners).map((c, i) => {
                if (c.trail)
                  return (
                    <tr key={c.id} data-corner-id={c.id}>
                      <td className="ga-cell-editable">
                        <Cell
                          editable
                          value=""
                          label="Tên góc mới"
                          placeholder="Nhập tên góc mới"
                          onChange={(v) => {
                            const name = v.replace(/\r?\n/g, '').slice(0, NAME_MAX);
                            plainEnter.current = false;
                            if (name.trim())
                              editCorners((d) => ((d.corners = [...(d.corners || []), { ...newCorner(), id: c.id, name }]), d));
                          }}
                          onKeyDown={cornerKeys(i)}
                        />
                      </td>
                      <td colSpan={5} />
                    </tr>
                  );
                const picks = (draft.picks?.['goc.all'] || []).filter((p) => p.cornerId === c.id);
                return (
                  <tr key={c.id} data-corner-id={c.id}>
                    <td className={editable ? 'ga-cell-editable' : ''}>
                      <Cell
                        editable={editable}
                        value={c.name}
                        label={`Tên góc ${i + 1}`}
                        placeholder="Tên góc"
                        onChange={cornerInput(i, c, 'name', NAME_MAX)}
                        onKeyDown={cornerKeys(i)}
                      />
                    </td>
                    <td className={editable ? 'ga-cell-editable' : ''}>
                      <ActivityCell
                        editable={editable}
                        suggestions={activitiesForRow(activities, 'goc')}
                        picks={picks}
                        goalsOfPick={goalsOfPick}
                        text={c.content}
                        onPick={(a) => pickCorner(c.id, a)}
                        onUnpick={(id) => unpickCorner(c.id, id)}
                        flagOf={flagOf}
                      >
                        <Cell
                          editable={editable}
                          value={c.content}
                          label={`Nội dung ${c.name || `góc ${i + 1}`}`}
                          onChange={cornerInput(i, c, 'content')}
                          onKeyDown={cornerKeys(i)}
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
                          onChange={cornerInput(i, c, f)}
                          onKeyDown={cornerKeys(i)}
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
      </Section>
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

/**
 * Các dòng Tiến hành của một mục trong bảng chung của phần I: dòng có tên tùy chọn, xóa/đổi thứ tự (FR-003, FR-004).
 * Thêm dòng như bảng kế hoạch năm học: gõ vào dòng trống luôn có ở cuối, hoặc Enter ở ô tên bước (Tiền 11/11/2026).
 */
function StepRows({ rows, editable, label, cols, onChange, onAskDelete, onRemovePart }) {
  // Dòng trống cuối giữ sẵn id: gõ vào thì thành dòng thật cùng id nên ô đang gõ không mất con trỏ
  const trailId = useRef(null);
  if (!trailId.current || rows.some((r) => r.id === trailId.current)) trailId.current = emptyRow().id;
  const [focusTitle, setFocusTitle] = useState(null);
  useEffect(() => {
    if (!focusTitle) return;
    document.querySelector(`textarea[aria-label="${CSS.escape(focusTitle)}"]`)?.focus();
    setFocusTitle(null);
  }, [focusTitle]);
  const set = (i, field, v) => onChange(rows.map((r, n) => (n === i ? { ...r, [field]: v } : r)));
  const addTrailing = (field, v) => onChange([...rows, { ...emptyRow(), id: trailId.current, [field]: v }]);
  const titleKeys = (i) => (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    if (!rows[i].title?.trim() && !sectionHasContent({ rows: [rows[i]] })) return;
    onChange([...rows.slice(0, i + 1), emptyRow(), ...rows.slice(i + 1)]);
    setFocusTitle(`${label} – tên bước ${i + 2}`);
  };
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
      <tr>
        <th scope="col">c) Tiến hành</th>
        <th scope="col">Hoạt động của cô</th>
        <th scope="col">Hoạt động của trẻ</th>
        <th scope="col">Ghi chú</th>
        {editable && (
          <th scope="col" className="cell--actions">
            <button
              type="button"
              className="icon-btn icon-btn--danger"
              aria-label={`Xóa phần Tiến hành – ${label}`}
              title="Xóa phần c)"
              onClick={onRemovePart}
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </th>
        )}
      </tr>
      {!editable && rows.length === 0 && (
        <tr>
          <td colSpan={cols}>
            <div className="ga-goal-table__pad muted">Chưa có dòng nào</div>
          </td>
        </tr>
      )}
      {/* Dòng trống cuối nằm chung danh sách với các dòng thật để giữ nguyên ô đang gõ khi nó thành dòng thật */}
      {(editable ? [...rows, { id: trailId.current, trail: true }] : rows).map((r, i) => (
        <tr key={r.id}>
          <td className={editable ? 'ga-cell-editable' : ''}>
            <LimitedCell
              editable={editable}
              max={NAME_MAX}
              value={r.trail ? '' : r.title}
              label={r.trail ? `${label} – tên bước mới` : `${label} – tên bước ${i + 1}`}
              placeholder={r.trail ? 'Tên bước mới' : 'Tên bước'}
              onChange={(v) => (r.trail ? addTrailing('title', v) : set(i, 'title', v))}
              onKeyDown={r.trail ? undefined : titleKeys(i)}
            />
          </td>
          {STEP_FIELDS.map(([f, name]) => (
            <td key={f} className={editable ? 'ga-cell-editable' : ''}>
              <LimitedCell
                editable={editable}
                value={r.trail ? '' : r[f]}
                label={`${label} – ${name} ${r.trail ? 'dòng mới' : `dòng ${i + 1}`}`}
                onChange={(v) => (r.trail ? addTrailing(f, v) : set(i, f, v))}
              />
            </td>
          ))}
          {editable && r.trail && <td className="cell--actions" />}
          {editable && !r.trail && (
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
    </>
  );
}

export function DayTab({
  draft,
  index,
  editable,
  update,
  goals = [],
  cards = [],
  assessTo = null,
  reuse = [],
  flagOf = () => null,
  offLabel = null,
  emptySections = [],
  // Chỗ đặt menu "Lấy / gợi ý nội dung" ở trái hàng nút của trang (phần tử DOM do trang cấp)
  toolsTarget = null,
}) {
  const [aiBusy, setAiBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(null);
  const d = draft.days[index];
  const hoc = draft.grid.hoc?.days?.[index] || {};
  const dayGoalIds = dayGoalsOf(draft, cards)[index];
  const dayGoals = dayGoalIds.map((id) => goals.find((g) => String(g.id) === id)).filter(Boolean);
  // Hoạt động gõ tay ở ô tuần của ngày: không có MT để đánh giá (FR-010, US6-AS2)
  const typedRows = new Set(teachingDayUnlinked(draft, index).map((u) => u.id.split('/')[1]));
  // MT trong ngày đổi / bị bỏ ở kế hoạch năm mới (BE:EDU-26): nêu bằng chữ, sửa ở ô của kế hoạch tuần
  const dayFlags = [...new Set(dayGoalIds)].map((id) => flagOf(id)).filter(Boolean);
  const setSec = (key, field, v) => update((x) => ((x.days[index].sections[key][field] = v), x));
  const dropPart = (sec, part, name) => {
    const cur = d.sections[sec.key];
    const run = () => update((x) => ((x.days[index].sections[sec.key] = removePart(x.days[index].sections[sec.key], part)), x));
    const filled = part === 'rows' ? sectionHasContent({ rows: cur.rows }) : !!cur[part]?.trim();
    if (filled) setAskDelete({ name: `phần ${name} của ${sec.label}`, run });
    else run();
  };
  // Lấy từ kế hoạch tuần: điền ô trống và ô còn nguyên chữ của lần lấy trước (pulled); ô cô đã sửa giữ nguyên (FR-006)
  const fromWeek = dayDraftFromWeek(draft, index, goals, cards);
  const dropped = droppedFromWeek(d, fromWeek);
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
      x.days[index].basis = Object.fromEntries(DAY_SECTIONS.map((s) => [s.key, fromWeek[s.key].cards]));
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
  const toolsMenu = (
    <RowMenu
      label="Lấy và gợi ý nội dung ngày"
      text={aiBusy ? 'AI đang soạn…' : 'Lấy / gợi ý'}
      icon={<Download size={16} aria-hidden />}
      className="btn btn--sm btn--outline-primary"
      items={[
        { label: 'Lấy từ kế hoạch tuần', icon: Download, onClick: fillFromWeek, disabled: !fills.length },
        ...(reuse.length > 0
          ? [
              {
                label: `Dùng lại bài đã soạn (${ddmm(reuse[0].date)})`,
                icon: Copy,
                onClick: () => update((x) => copyLessonSteps(x, index, reuse[0].rows)),
              },
            ]
          : []),
        ...(hoc.subject || hoc.topic ? [{ label: 'AI gợi ý tiến trình giờ học', icon: Sparkles, onClick: aiSteps, disabled: aiBusy }] : []),
      ]}
    />
  );
  return (
    <>
      {editable && toolsTarget && createPortal(toolsMenu, toolsTarget)}
      <div className="section-title center">{longDay(d.date, index)}</div>
      {/* BE:EDU-41: ngày trùng đợt nghỉ không bắt buộc soạn */}
      {offLabel && <p className="text-sm text-warning center">Ngày nghỉ: {offLabel}</p>}
      {(assessTo || (editable && !toolsTarget)) && (
        <div className="row row--wrap gap-2">
          {assessTo && (
            <Link className="btn btn--outline-primary btn--sm" to={assessTo}>
              Đánh giá trẻ ngày này
            </Link>
          )}
          {/* Gom các nút lấy / gợi ý vào một menu ở trái hàng nút như trang kế hoạch chủ đề (Tiền 13/11/2026) */}
          {editable && !toolsTarget && toolsMenu}
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
      {/* FR-024: MT trong ngày = hợp MT của các hoạt động xếp vào ngày (gồm ô cả tuần, bảng góc) */}
      {dayGoals.length > 0 && (
        <p className="text-sm">
          MT trong ngày: {/* Chữ xanh, cách nhau dấu phẩy như Bảng phủ MT (Tiền 13/11/2026) */}
          {dayGoals.map((g, i) => (
            <Fragment key={g.id}>
              {i > 0 && ', '}
              <span className="ga-goal-code" title={g.text}>
                MT{g.no}
              </span>
            </Fragment>
          ))}
        </p>
      )}
      {dayFlags.map((f) => (
        <p key={f.ref} className="field__error">
          {f.label}: {f.message}
        </p>
      ))}
      <Section title="I. Kế hoạch giáo dục ngày">
        <div className="table-wrap">
          <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
            <colgroup>
              <col className="ga-goal-table__group" />
              <col />
              <col />
              <col className="ga-goal-table__group" />
              {editable && <col className="ga-goal-table__group" />}
            </colgroup>
            <tbody>
              {DAY_SECTIONS.map((s) => {
                const sec = d.sections[s.key];
                const fw = fromWeek[s.key];
                const cols = editable ? 5 : 4;
                const off = partsOff(sec);
                return (
                  <Fragment key={s.key}>
                    <tr>
                      <th scope="colgroup" colSpan={cols} className="cell--fixed">
                        <div className="ga-goal-table__pad">
                          {s.label}
                          {s.key !== 'hoc' && fw.name ? `: ${fw.name}` : ''}
                          {s.key === 'hoc' && fw.main && <div className="ga-cell-text">Hoạt động chính: {fw.main}</div>}
                          {s.key === 'hoc' && fw.combined && <div className="ga-cell-text">Hoạt động kết hợp: {fw.combined}</div>}
                          {missing.some((m) => m.key === s.key) && <p className="field__error">Mục này chưa có nội dung.</p>}
                          {fw.goals.map((g) => (
                            <div key={g.id} className="ga-cell-text">
                              <span className="ga-goal-code">MT{g.no}</span> {g.text}
                            </div>
                          ))}
                          {typedRows.has(s.row) && <p className="text-danger text-sm">Có hoạt động chưa gắn MT</p>}
                          {dropped.includes(s.key) && <p className="text-xs text-warning">Đã đổi ở kế hoạch tuần</p>}
                        </div>
                      </th>
                    </tr>
                    {[
                      ['aims', 'a) Mục đích, yêu cầu', 'mục đích, yêu cầu'],
                      ['prep', 'b) Chuẩn bị', 'chuẩn bị'],
                    ]
                      .filter(([f]) => !off.includes(f))
                      .map(([f, name, aria]) => (
                        <tr key={f}>
                          <td className={editable ? 'cell--fixed' : ''}>
                            <div className="ga-goal-table__pad fw-600">{name}</div>
                          </td>
                          <td colSpan={editable ? cols - 2 : cols - 1} className={editable ? 'ga-cell-editable' : ''}>
                            <LimitedCell
                              editable={editable}
                              value={sec[f]}
                              label={`${s.label} – ${aria}`}
                              onChange={(v) => setSec(s.key, f, v)}
                            />
                          </td>
                          {editable && (
                            <td className="cell--actions">
                              <div className="ga-goal-table__pad">
                                <button
                                  type="button"
                                  className="icon-btn icon-btn--danger"
                                  aria-label={`Xóa phần ${name} – ${s.label}`}
                                  title="Xóa phần này"
                                  onClick={() => dropPart(s, f, name)}
                                >
                                  <Trash2 size={16} aria-hidden />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    {!off.includes('rows') && (
                      <StepRows
                        rows={sec.rows}
                        editable={editable}
                        label={s.label}
                        cols={cols}
                        onChange={(rows) => setSec(s.key, 'rows', rows)}
                        onAskDelete={(name, run) => setAskDelete({ name, run })}
                        onRemovePart={() => dropPart(s, 'rows', 'c) Tiến hành')}
                      />
                    )}
                    {editable && off.length > 0 && (
                      <tr>
                        <td colSpan={cols}>
                          <div className="ga-goal-table__pad row row--wrap gap-2">
                            {SECTION_PARTS.filter((x) => off.includes(x.key)).map((x) => (
                              <button
                                key={x.key}
                                type="button"
                                className="btn btn--sm btn--outline-primary"
                                aria-label={`Thêm lại ${x.label} – ${s.label}`}
                                onClick={() =>
                                  update(
                                    (doc) => ((doc.days[index].sections[s.key] = restorePart(doc.days[index].sections[s.key], x.key)), doc),
                                  )
                                }
                              >
                                <Plus size={16} aria-hidden /> {x.label}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="II. Đánh giá trẻ trên ngày">
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
      </Section>
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
