import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChildAvatar } from '@/components/ChildAvatar';
import { CheckCheck, ClipboardCheck, Flag, Info, Lock, Save, UserX } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useAssessmentClasses, useDailySheet } from '@/hooks/assessment/useAssessment';
import { saveDailyAssessments } from '@/services/assessment/assessmentService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, SkeletonRows, Spinner } from '@/components/ui/States';
import { BehaviorsCell, CellPopover, GoalChips, HealthCell, MealsCell } from '@/components/assessment/DailyAssessmentCells';
import { EMOTION, EMOTION_LABELS } from '@/models/assessment/assessmentConstants';
import { EATING, NAP, NAP_LABELS, PARTICIPATION, PARTICIPATION_LABELS } from '@/models/assessment/dailyObservationOptions';
import { formatDate, formatDateTime } from '@/utils/format';
import { addDays, isSchoolDay, todayIso, unlockDeadline } from '@/utils/assessment/assessmentPeriods';
import { validateDailyEntry, hasErrors } from '@/utils/assessment/assessmentValidation';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

const lastSchoolDay = () => {
  let d = todayIso();
  while (!isSchoolDay(d)) d = addDays(d, -1);
  return d;
};

/** Giá trị đang nhập của một trẻ: nhóm ngày (sức khỏe, ăn ngủ, cảm xúc – hành vi) + hoạt động đang chọn. */
const fromRow = (r, mealSessions) => {
  const o = r.observation;
  const a = r.assessment;
  return {
    // Ô Sức khỏe: theo khám sức khỏe mới nhất khi cô chưa sửa (server tính sẵn)
    healthSigns: r.health?.signs || [],
    healthNote: r.health?.note || '',
    healthOverridden: !!r.health?.overridden,
    // Bữa cô đã tắt "Tham gia ăn" khi điểm danh luôn là Không ăn
    meals: Object.fromEntries(mealSessions.map((m) => [m, r.skippedMeals?.includes(m) ? EATING.KHONG_AN : o?.meals?.[m] || EATING.AN_HET])),
    nap: o?.nap || NAP.NGU_TOT,
    emotion: o?.emotion || a?.emotion || EMOTION.HAPPY,
    behaviors: o?.behaviors || [],
    behaviorNote: o?.behaviorNote || '',
    participation: a?.participation || PARTICIPATION.BINH_THUONG,
    criteriaMet: a?.criteriaMet || [],
    criteriaNotMet: a?.criteriaNotMet || [],
    flag: !!a?.flag,
    comment: a?.comment || '',
  };
};

const COLS = 10;
// Ô khác giá trị mặc định được tô nhẹ để giáo viên thấy ngay ngoại lệ
const tint = (tone) => (tone ? `dg-cell--${tone}` : '');

/** #52 Daily Assessment (UC 4.4, GBR-OBS-01..05) – teacher / team leader of the class. */
export default function DailyAssessmentPage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const { classes, loading: classesLoading, error: classesError } = useAssessmentClasses();
  const [search] = useSearchParams();
  const [classId, setClassId] = useState(search.get('classId') || '');
  const [date, setDate] = useState(() => search.get('date') || lastSchoolDay());
  const [activity, setActivity] = useState('Hoạt động học');
  const currentClassId = classId || classes[0]?.id || '';
  const params = useMemo(() => ({ classId: currentClassId, date, activity }), [currentClassId, date, activity]);
  const { sheet, loading, error, reload } = useDailySheet(params);

  const [drafts, setDrafts] = useState({});
  const [dirty, setDirty] = useState(new Set());
  const [rowErrors, setRowErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // A new sheet (class / date / activity changed or saved) resets the local edits.
  useEffect(() => {
    if (!sheet) return;
    setDrafts(Object.fromEntries(sheet.rows.map((r) => [r.child.id, fromRow(r, sheet.mealSessions)])));
    setDirty(new Set());
    setRowErrors({});
  }, [sheet]);

  const resetEdits = () => {
    setDirty(new Set());
    setRowErrors({});
  };

  const rowState = (r) => {
    if (!r.present) return 'absent';
    if (r.assessment && r.assessment.recordedBy !== user.id) return 'other';
    if (sheet.locked) return 'locked';
    return 'editable';
  };

  const update = (childId, patch) => {
    setDrafts((prev) => ({ ...prev, [childId]: { ...prev[childId], ...patch } }));
    setDirty((prev) => new Set(prev).add(childId));
    setRowErrors((prev) => {
      if (!prev[childId]) return prev;
      const next = { ...prev };
      delete next[childId];
      return next;
    });
  };

  /** Đặt kết quả một mục tiêu cho nhiều trẻ (Cả lớp đạt, hoặc các trẻ đang chọn); trả số trẻ đã đặt. */
  const setGoalFor = (ids, goalId, met) => {
    const editable = ids.filter((childId) => rowState(sheet.rows.find((r) => r.child.id === childId)) === 'editable');
    setDrafts((prev) => {
      const next = { ...prev };
      editable.forEach((childId) => {
        const d = next[childId];
        const criteriaMet = d.criteriaMet.filter((x) => x !== goalId);
        const criteriaNotMet = d.criteriaNotMet.filter((x) => x !== goalId);
        next[childId] = {
          ...d,
          criteriaMet: met ? [...criteriaMet, goalId] : criteriaMet,
          criteriaNotMet: met ? criteriaNotMet : [...criteriaNotMet, goalId],
        };
      });
      return next;
    });
    setDirty((prev) => new Set([...prev, ...editable]));
    return editable.length;
  };

  const markAllPresent = () => {
    const ids = sheet.rows.filter((r) => r.present && !r.assessment).map((r) => r.child.id);
    setDirty((prev) => new Set([...prev, ...ids]));
  };

  const save = async () => {
    const entries = [...dirty].map((childId) => ({ childId, ...drafts[childId] }));
    const local = {};
    entries.forEach((e) => {
      const errors = validateDailyEntry(e);
      if (hasErrors(errors)) local[e.childId] = errors;
    });
    if (hasErrors(local)) {
      setRowErrors(local);
      toast.error('Một số dòng chưa hợp lệ. Kiểm tra các dòng được đánh dấu.', 'Chưa lưu được');
      return;
    }
    setSaving(true);
    try {
      const res = await saveDailyAssessments({ classId: currentClassId, date, activity: sheet.activity, entries }, user);
      toast.success(`Đã lưu ${res.saved} đánh giá. Phụ huynh của trẻ đã được thông báo.`);
      reload({ silent: true });
    } catch (err) {
      if (err.details) setRowErrors(err.details);
      toast.error(err.message, 'Không lưu được đánh giá');
    } finally {
      setSaving(false);
    }
  };

  const assessedCount = sheet?.rows.filter((r) => r.assessment).length || 0;
  const presentRows = sheet?.rows.filter((r) => r.present) || [];
  const presentCount = presentRows.length;
  const presentIds = presentRows.map((r) => r.child.id);
  const criteria = sheet?.criteria || [];
  const absentRows = sheet?.rows.filter((r) => r.attendanceStatus && !r.present) || [];
  const unmarkedRows = sheet?.attendanceTaken ? sheet.rows.filter((r) => !r.attendanceStatus) : [];
  // Chỉ có dòng vắng do phụ huynh báo nghỉ, chưa ai được điểm danh Có mặt: coi như lớp chưa điểm danh
  const attendanceTaken = !!sheet?.attendanceTaken && (presentCount > 0 || unmarkedRows.length === 0);
  // Tên trẻ vắng gọn một dòng: 3 tên đầu rồi "+n"
  const namesOf = (list) =>
    list
      .slice(0, 3)
      .map((r) => r.child.fullName)
      .join(', ') + (list.length > 3 ? ` +${list.length - 3}` : '');

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.daily)} />
      <div className="page__head">
        <h1 className="page__title">Đánh giá hằng ngày</h1>
      </div>

      {classesError ? (
        <ErrorState error={classesError} />
      ) : !classesLoading && classes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Lock}
            title="Bạn chưa được phân công lớp"
            description="Chỉ giáo viên của lớp mới ghi nhận đánh giá hằng ngày."
          />
        </div>
      ) : (
        <div className="card">
          <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
            <div className="field" style={{ margin: 0 }}>
              <label className="field__label" htmlFor="dg-class">
                Lớp
              </label>
              <select
                id="dg-class"
                className="select"
                value={currentClassId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  resetEdits();
                }}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label className="field__label" htmlFor="dg-date">
                Ngày
              </label>
              <input
                id="dg-date"
                type="date"
                className="input"
                value={date}
                max={todayIso()}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
            </div>
            <div className="field" style={{ margin: 0, minWidth: 240 }}>
              <label className="field__label" htmlFor="dg-activity">
                Hoạt động trong thời khóa biểu
              </label>
              <select id="dg-activity" className="select" value={sheet?.activity || activity} onChange={(e) => setActivity(e.target.value)}>
                {(sheet?.activities || [activity]).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="spacer" />
            {sheet && (
              <div className="text-sm text-2" style={{ alignSelf: 'center' }}>
                Đã đánh giá <b>{assessedCount}</b>/{presentCount} trẻ có mặt
              </div>
            )}
          </div>

          {/* Khóa sau 23:59:59 của chính ngày đó; quên thì PHT điểm trường / Hiệu trưởng mở lại */}
          {sheet && sheet.locked && (
            <div className="alert alert--warning" style={{ margin: '0 16px 12px' }}>
              <Lock size={18} />
              <div>
                Ngày {formatDate(date)} đã khóa. Nếu cần đánh giá bổ sung, gửi mail cho Phó hiệu trưởng điểm trường hoặc Hiệu trưởng để mở
                lại ngày này.
              </div>
            </div>
          )}
          {sheet?.unlock && (
            <div className="alert alert--info" style={{ margin: '0 16px 12px' }}>
              <Lock size={18} />
              <div>
                Ngày {formatDate(date)} đã được {sheet.unlock.unlockedByName} mở lại, đánh giá được đến{' '}
                <strong>{formatDateTime(unlockDeadline(sheet.unlock.validUntil))}</strong>.
              </div>
            </div>
          )}
          {sheet?.plan && attendanceTaken && (
            <div className="alert alert--info" style={{ margin: '0 16px 12px' }}>
              <Info size={18} />
              <div className="dg-plan">
                <div>
                  Theo giáo án <span className="fw-600">{sheet.plan.code}</span>
                  {sheet.plan.topic && ` · ${sheet.plan.topic}`}
                </div>
                {criteria.length === 0 ? (
                  <div className="text-sm">Giờ sinh hoạt này chưa chọn mục tiêu trong giáo án; chỉ ghi mức tham gia.</div>
                ) : (
                  criteria.map((c) => (
                    <div key={c.id} className="text-sm">
                      <span className="fw-600">{c.name}</span>: {c.description}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {/* Chỉ đánh giá trẻ đã điểm danh Có mặt: trẻ vắng / chưa điểm danh chỉ nêu tên ở một dòng */}
          {sheet && attendanceTaken && (absentRows.length > 0 || unmarkedRows.length > 0) && (
            <p className="muted text-sm dg-absent-line">
              <UserX size={14} /> {absentRows.length > 0 && `Vắng ${absentRows.length} trẻ: ${namesOf(absentRows)}`}
              {absentRows.length > 0 && unmarkedRows.length > 0 && ' · '}
              {unmarkedRows.length > 0 && `${unmarkedRows.length} trẻ chưa điểm danh: ${namesOf(unmarkedRows)}`}
            </p>
          )}

          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : (
            <div className="table-wrap dg-sheet-wrap">
              <table className="table dg-sheet">
                <thead>
                  <tr className="dg-head-cols">
                    <th className="dg-col-child dg-sticky-col">Trẻ</th>
                    <th>Sức khỏe</th>
                    <th>Ăn</th>
                    <th>Ngủ trưa</th>
                    <th>Cảm xúc</th>
                    <th>Hành vi</th>
                    <th>Tham gia</th>
                    <th className="dg-col-goals">
                      <span className="dg-head-goal">
                        Kiến thức, kỹ năng
                        {sheet?.plan && criteria.length > 0 && presentCount > 0 && (
                          <CellPopover label="Cả lớp đạt" icon={<CheckCheck size={14} />} minWidth={260}>
                            <div className="dg-pop__title">Đánh dấu mọi trẻ có mặt đạt (bấm Lưu để ghi nhận)</div>
                            {criteria.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                className="btn btn--sm dg-pop__action"
                                onClick={() => {
                                  const n = setGoalFor(presentIds, c.id, true);
                                  toast.success(`Đã đánh dấu ${n} trẻ đạt ${c.name}. Bấm Lưu để ghi nhận.`);
                                }}
                              >
                                <CheckCheck size={14} /> {c.name} – cả lớp đạt
                              </button>
                            ))}
                          </CellPopover>
                        )}
                      </span>
                    </th>
                    <th className="center">Cờ</th>
                    <th className="dg-col-note">Nhận xét</th>
                  </tr>
                </thead>
                <tbody>
                  {loading || classesLoading || !sheet ? (
                    <SkeletonRows rows={5} cols={COLS} />
                  ) : sheet.rows.length === 0 ? (
                    <tr>
                      <td colSpan={COLS}>
                        <EmptyState title="Lớp chưa có trẻ" description="Trẻ được xếp vào lớp sẽ hiển thị tại đây." />
                      </td>
                    </tr>
                  ) : !attendanceTaken ? (
                    <tr>
                      <td colSpan={COLS}>
                        <EmptyState
                          icon={UserX}
                          title={`Lớp chưa điểm danh ngày ${formatDate(sheet.date)}`}
                          description="Điểm danh trước, chỉ trẻ có mặt mới được đánh giá."
                          action={
                            <Link className="btn btn--primary" to={`/attendance?classId=${sheet.cls.id}&date=${sheet.date}`}>
                              Điểm danh ngay
                            </Link>
                          }
                        />
                      </td>
                    </tr>
                  ) : presentRows.length === 0 ? (
                    <tr>
                      <td colSpan={COLS}>
                        <EmptyState icon={UserX} title="Không có trẻ có mặt" description="Cả lớp vắng hoặc chưa điểm danh ngày này." />
                      </td>
                    </tr>
                  ) : (
                    presentRows.map((r) => {
                      const id = r.child.id;
                      const state = rowState(r);
                      const d = drafts[id] || fromRow(r, sheet.mealSessions);
                      const disabled = state !== 'editable';
                      const errs = rowErrors[id] || {};
                      const firstError = Object.values(errs)[0];
                      const name = r.child.fullName;
                      // Viền trái của dòng: lỗi / chưa lưu / đã ghi nhận / chưa đánh giá
                      const status = rowErrors[id]
                        ? ['error', 'Có lỗi, xem dòng chữ đỏ']
                        : dirty.has(id)
                          ? ['dirty', 'Đã thay đổi, chưa lưu']
                          : r.assessment
                            ? ['saved', `Đã ghi nhận ${formatDateTime(r.assessment.updatedAt || r.assessment.recordedAt)}`]
                            : ['new', 'Chưa đánh giá'];
                      return (
                        <tr key={id} className={`dg-row dg-row--${status[0]}`} title={status[1]}>
                          <td className="dg-col-child dg-sticky-col">
                            <div className="dg-child">
                              <ChildAvatar child={r.child} size="sm" />
                              <div className="dg-child__info">
                                <Link to={`/assessment/children/${id}`} className="fw-600">
                                  {name}
                                </Link>
                                <div className="muted text-xs">
                                  {r.child.code}
                                  {r.assessment?.corrections?.length > 0 && ` · ${r.assessment.corrections.length} lần điều chỉnh`}
                                </div>
                                {state === 'other' && (
                                  <div className="muted text-xs">
                                    Do {md.userById(r.assessment.recordedBy)?.fullName || 'giáo viên khác'} ghi nhận
                                  </div>
                                )}
                                {firstError && <div className="field__error">{firstError}</div>}
                              </div>
                            </div>
                          </td>
                          <td className={`dg-col-health ${tint(d.healthSigns.length ? 'bad' : '')}`}>
                            <HealthCell
                              health={r.health}
                              draft={d}
                              name={name}
                              disabled={disabled}
                              onChange={(patch) => update(id, patch)}
                            />
                          </td>
                          <td className="dg-col-meals">
                            <MealsCell
                              draft={d}
                              row={r}
                              sessions={sheet.mealSessions}
                              name={name}
                              disabled={disabled}
                              onChange={(patch) => update(id, patch)}
                            />
                          </td>
                          <td className={`dg-col-nap ${tint(d.nap === NAP.KHONG_NGU ? 'bad' : d.nap !== NAP.NGU_TOT ? 'warn' : '')}`}>
                            <select
                              className="select dg-select"
                              value={d.nap}
                              disabled={disabled}
                              onChange={(e) => update(id, { nap: e.target.value })}
                              aria-label={`Ngủ trưa của ${name}`}
                            >
                              {Object.entries(NAP_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className={`${tint(d.emotion === EMOTION.SAD || d.emotion === EMOTION.UPSET ? 'warn' : '')}`}>
                            <select
                              className="select dg-select"
                              value={d.emotion}
                              disabled={disabled}
                              onChange={(e) => update(id, { emotion: e.target.value })}
                              aria-label={`Cảm xúc của ${name}`}
                            >
                              {Object.entries(EMOTION_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <BehaviorsCell draft={d} name={name} disabled={disabled} onChange={(patch) => update(id, patch)} />
                          </td>
                          <td className={tint(sheet.plan && d.participation === PARTICIPATION.CHUA_TICH_CUC ? 'warn' : '')}>
                            {sheet.plan ? (
                              <select
                                className="select dg-select"
                                value={d.participation}
                                disabled={disabled}
                                onChange={(e) => update(id, { participation: e.target.value })}
                                aria-label={`Mức tham gia hoạt động của ${name}`}
                              >
                                {Object.entries(PARTICIPATION_LABELS).map(([k, v]) => (
                                  <option key={k} value={k}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="muted text-xs">—</span>
                            )}
                          </td>
                          <td className="dg-col-goals">
                            {!sheet.plan ? (
                              <span className="muted text-xs dg-locked">
                                <Lock size={12} /> Chưa có giáo án duyệt
                              </span>
                            ) : criteria.length === 0 ? (
                              <span className="muted text-xs">Giờ này chưa có mục tiêu</span>
                            ) : (
                              <GoalChips
                                criteria={criteria}
                                draft={d}
                                disabled={disabled}
                                name={name}
                                onChange={(patch) => update(id, patch)}
                              />
                            )}
                          </td>
                          <td className="center">
                            <button
                              type="button"
                              className={`dg-flag ${d.flag ? 'dg-flag--on' : ''}`}
                              aria-pressed={d.flag}
                              aria-label={`Cờ bé ngoan cho ${name}`}
                              title={d.flag ? 'Bỏ cờ bé ngoan' : 'Cắm cờ bé ngoan'}
                              disabled={disabled}
                              onClick={() => update(id, { flag: !d.flag })}
                            >
                              <Flag size={16} />
                            </button>
                          </td>
                          <td className="dg-col-note">
                            <input
                              className={`input dg-input dg-note ${errs.comment ? 'input--error' : ''}`}
                              value={d.comment}
                              maxLength={500}
                              disabled={disabled}
                              placeholder="Tùy chọn"
                              onChange={(e) => update(id, { comment: e.target.value })}
                              aria-label={`Nhận xét hoạt động cho ${name}`}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
          {sheet && presentCount > 0 && (
            <div className="dg-legend text-xs text-2">
              <span>
                Mục tiêu: 1 lần <span className="chip chip--green">Đạt</span> · 2 lần <span className="chip chip--red">Chưa đạt</span> · 3
                lần bỏ chọn
              </span>
              <span className="dg-child">
                <Flag size={12} /> Phiếu bé ngoan tuần: ≥ 4 ngày có mặt, ≥ 3 cờ
              </span>
              <span>Ô vàng / đỏ: khác mặc định</span>
            </div>
          )}
        </div>
      )}

      {sheet && presentCount > 0 && !sheet.locked && (
        <div className="page-actions">
          <button className="btn" onClick={markAllPresent} disabled={saving || presentCount === 0}>
            <ClipboardCheck size={16} /> Ghi nhận cả lớp với giá trị mặc định
          </button>
          <div className="row" style={{ gap: 8 }}>
            {dirty.size > 0 && (
              <button className="btn" onClick={() => reload()} disabled={saving}>
                Hủy thay đổi
              </button>
            )}
            <button className="btn btn--primary" onClick={save} disabled={saving || dirty.size === 0}>
              {saving ? <Spinner small /> : <Save size={16} />} Lưu đánh giá{dirty.size ? ` (${dirty.size})` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
