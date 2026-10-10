import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCheck, ClipboardCheck, Flag, Info, Lock, PencilLine, Save, UserX } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useAssessmentClasses, useDailySheet } from '@/hooks/assessment/useAssessment';
import { saveDailyAssessments } from '@/services/assessment/assessmentService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, SkeletonRows, Spinner } from '@/components/ui/States';
import { ABSENCE_LABELS, EMOTION, EMOTION_LABELS, HEALTH_STATUS, HEALTH_STATUS_LABELS } from '@/models/assessment/assessmentConstants';
import { formatDate, formatDateTime } from '@/utils/format';
import { addDays, isSchoolDay, todayIso } from '@/utils/assessment/assessmentPeriods';
import { validateDailyEntry, hasErrors } from '@/utils/assessment/assessmentValidation';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

const lastSchoolDay = () => {
  let d = todayIso();
  while (!isSchoolDay(d)) d = addDays(d, -1);
  return d;
};

const fromAssessment = (a) =>
  a
    ? { healthStatus: a.healthStatus, emotion: a.emotion, criteriaMet: a.criteriaMet, flag: a.flag, comment: a.comment || '' }
    : { healthStatus: HEALTH_STATUS.GOOD, emotion: EMOTION.HAPPY, criteriaMet: [], flag: false, comment: '' };

/** #52 Daily Assessment (UC 4.4, GBR-OBS-01..05) – teacher / team leader of the class. */
export default function DailyAssessmentPage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const { classes, loading: classesLoading, error: classesError } = useAssessmentClasses();
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(lastSchoolDay);
  const [activity, setActivity] = useState('Hoạt động học');
  const currentClassId = classId || classes[0]?.id || '';
  const params = useMemo(() => ({ classId: currentClassId, date, activity }), [currentClassId, date, activity]);
  const { sheet, loading, error, reload } = useDailySheet(params);

  const [drafts, setDrafts] = useState({});
  const [dirty, setDirty] = useState(new Set());
  const [rowErrors, setRowErrors] = useState({});
  const [unlocked, setUnlocked] = useState(new Set());
  const [reasonFor, setReasonFor] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [saving, setSaving] = useState(false);

  // A new sheet (class / date / activity changed or saved) resets the local edits.
  useEffect(() => {
    if (!sheet) return;
    setDrafts(Object.fromEntries(sheet.rows.map((r) => [r.child.id, fromAssessment(r.assessment)])));
    setDirty(new Set());
    setRowErrors({});
    setUnlocked(new Set());
  }, [sheet]);

  const resetEdits = () => {
    setDirty(new Set());
    setRowErrors({});
  };

  const rowState = (r) => {
    if (!r.present) return 'absent';
    if (r.assessment && r.assessment.recordedBy !== user.id) return 'other';
    if (r.assessment && sheet.locked && !unlocked.has(r.child.id)) return 'locked';
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

  const toggleCriterion = (childId, id) => {
    const list = drafts[childId]?.criteriaMet || [];
    update(childId, { criteriaMet: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] });
  };

  const markAllPresent = () => {
    const ids = sheet.rows.filter((r) => r.present && !r.assessment).map((r) => r.child.id);
    setDirty((prev) => new Set([...prev, ...ids]));
  };

  const openCorrection = (childId) => {
    setReasonFor(childId);
    setReason(drafts[childId]?.correctionReason || '');
    setReasonError('');
  };

  const confirmCorrection = () => {
    if (!reason.trim()) {
      setReasonError('Nhập lý do điều chỉnh.');
      return;
    }
    update(reasonFor, { correctionReason: reason.trim() });
    setUnlocked((prev) => new Set(prev).add(reasonFor));
    setReasonFor(null);
  };

  const save = async () => {
    const entries = [...dirty].map((childId) => ({ childId, ...drafts[childId] }));
    const local = {};
    entries.forEach((e) => {
      const row = sheet.rows.find((r) => r.child.id === e.childId);
      const errors = validateDailyEntry(e, { locked: sheet.locked && !!row?.assessment });
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
  const presentCount = sheet?.rows.filter((r) => r.present).length || 0;

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.daily)} />
      <div className="page__head">
        <h1 className="page__title">Đánh giá hằng ngày</h1>
      </div>
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Sau mỗi hoạt động, chọn mã YCCĐ trẻ đạt (lấy từ giáo án ngày đã duyệt) và cắm cờ bé ngoan theo nhận định của bạn; nhận xét là tùy
          chọn. Chỉ đánh giá trẻ có mặt. Bạn sửa được đánh giá của mình đến hết ngày học tiếp theo; sau đó cần ghi lý do điều chỉnh.
        </div>
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

          {sheet && sheet.locked && (
            <div className="alert alert--warning" style={{ margin: '0 16px 12px' }}>
              <Lock size={18} />
              <div>Đánh giá ngày {formatDate(date)} đã khóa. Bấm “Điều chỉnh” ở từng dòng và ghi lý do nếu cần sửa.</div>
            </div>
          )}
          {sheet && !sheet.plan && (
            <div className="alert alert--warning" style={{ margin: '0 16px 12px' }}>
              <ClipboardCheck size={18} />
              <div>
                Ngày {formatDate(date)} lớp chưa có giáo án ngày được duyệt nên chưa có YCCĐ để chấm. Bạn vẫn ghi được sức khỏe, cảm xúc, cờ
                bé ngoan và nhận xét.
              </div>
            </div>
          )}
          {sheet?.plan && (
            <div className="alert alert--info" style={{ margin: '0 16px 12px' }}>
              <Info size={18} />
              <div>
                <div>
                  Theo giáo án <span className="fw-600">{sheet.plan.code}</span>
                  {sheet.plan.topic && ` · ${sheet.plan.topic}`}
                </div>
                {sheet.criteria.length === 0 ? (
                  <div className="text-sm">Giờ sinh hoạt này chưa gắn mã YCCĐ trong giáo án.</div>
                ) : (
                  sheet.criteria.map((c) => (
                    <div key={c.id} className="text-sm">
                      <span className="fw-600">{c.name}</span>: {c.description}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          {sheet && !sheet.attendanceTaken && (
            <div className="alert alert--warning" style={{ margin: '0 16px 12px' }}>
              <UserX size={18} />
              <div>Lớp chưa điểm danh ngày này. Hãy điểm danh trước để hệ thống loại trừ trẻ vắng.</div>
            </div>
          )}

          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : (
            <div className="table-wrap" style={{ border: 'none', borderTop: '1px solid var(--border)', borderRadius: 0 }}>
              <table className="table dg-sheet">
                <thead>
                  <tr>
                    <th>Trẻ</th>
                    <th>Sức khỏe</th>
                    <th>Cảm xúc</th>
                    <th>YCCĐ đạt</th>
                    <th className="center">Cờ bé ngoan</th>
                    <th>Nhận xét</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {loading || classesLoading || !sheet ? (
                    <SkeletonRows rows={5} cols={7} />
                  ) : sheet.rows.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState title="Lớp chưa có trẻ" description="Trẻ được xếp vào lớp sẽ hiển thị tại đây." />
                      </td>
                    </tr>
                  ) : (
                    sheet.rows.map((r) => {
                      const id = r.child.id;
                      const state = rowState(r);
                      const d = drafts[id] || fromAssessment(r.assessment);
                      const disabled = state !== 'editable';
                      const errs = rowErrors[id] || {};
                      const cls = [
                        state === 'absent' ? 'dg-row--absent' : '',
                        rowErrors[id] ? 'dg-row--error' : '',
                        dirty.has(id) ? 'dg-row--dirty' : '',
                      ].join(' ');
                      return (
                        <tr key={id} className={cls}>
                          <td style={{ minWidth: 170 }}>
                            <Link to={`/assessment/children/${id}`} className="fw-600">
                              {r.child.fullName}
                            </Link>
                            <div className="muted text-xs">{r.child.code}</div>
                            {errs.childId && <div className="field__error">{errs.childId}</div>}
                          </td>
                          {state === 'absent' ? (
                            <td colSpan={5} className="text-sm">
                              {ABSENCE_LABELS[r.attendanceStatus] || 'Vắng'} – không đánh giá trẻ vắng mặt.
                            </td>
                          ) : (
                            <>
                              <td>
                                <select
                                  className="select"
                                  value={d.healthStatus}
                                  disabled={disabled}
                                  onChange={(e) => update(id, { healthStatus: e.target.value })}
                                  aria-label={`Sức khỏe của ${r.child.fullName}`}
                                >
                                  {Object.entries(HEALTH_STATUS_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                                {errs.healthStatus && <div className="field__error">{errs.healthStatus}</div>}
                              </td>
                              <td>
                                <select
                                  className="select"
                                  value={d.emotion}
                                  disabled={disabled}
                                  onChange={(e) => update(id, { emotion: e.target.value })}
                                  aria-label={`Cảm xúc của ${r.child.fullName}`}
                                >
                                  {Object.entries(EMOTION_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                                {errs.emotion && <div className="field__error">{errs.emotion}</div>}
                              </td>
                              <td>
                                <div className="dg-criteria" role="group" aria-label={`YCCĐ đạt của ${r.child.fullName}`}>
                                  {sheet.criteria.length === 0 && <span className="muted text-xs">Không có YCCĐ</span>}
                                  {sheet.criteria.map((c) => {
                                    const on = d.criteriaMet.includes(c.id);
                                    return (
                                      <button
                                        key={c.id}
                                        type="button"
                                        className={`dg-crit ${on ? 'dg-crit--on' : ''}`}
                                        aria-pressed={on}
                                        title={`${c.domain}: ${c.description}`}
                                        disabled={disabled}
                                        onClick={() => toggleCriterion(id, c.id)}
                                      >
                                        {on && <CheckCheck size={12} />}
                                        {c.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>
                              <td className="center">
                                <button
                                  type="button"
                                  className={`dg-flag ${d.flag ? 'dg-flag--on' : ''}`}
                                  aria-pressed={d.flag}
                                  aria-label={`Cờ bé ngoan cho ${r.child.fullName}`}
                                  title={d.flag ? 'Bỏ cờ bé ngoan' : 'Cắm cờ bé ngoan'}
                                  disabled={disabled}
                                  onClick={() => update(id, { flag: !d.flag })}
                                >
                                  <Flag size={18} />
                                </button>
                              </td>
                              <td style={{ minWidth: 200 }}>
                                <input
                                  className={`input ${errs.comment ? 'input--error' : ''}`}
                                  value={d.comment}
                                  maxLength={500}
                                  disabled={disabled}
                                  placeholder="Tùy chọn"
                                  onChange={(e) => update(id, { comment: e.target.value })}
                                  aria-label={`Nhận xét cho ${r.child.fullName}`}
                                />
                                {(errs.comment || errs.correctionReason) && (
                                  <div className="field__error">{errs.comment || errs.correctionReason}</div>
                                )}
                              </td>
                            </>
                          )}
                          <td className="text-sm" style={{ minWidth: 150 }}>
                            {state === 'absent' ? (
                              <span className="chip chip--gray">Vắng</span>
                            ) : dirty.has(id) ? (
                              <span className="chip chip--blue">Chưa lưu</span>
                            ) : r.assessment ? (
                              <span className="chip chip--green">Đã ghi nhận</span>
                            ) : (
                              <span className="chip chip--orange">Chưa đánh giá</span>
                            )}
                            {state === 'other' && (
                              <div className="muted text-xs mt-8">
                                Do {md.userById(r.assessment.recordedBy)?.fullName || 'giáo viên khác'} ghi nhận
                              </div>
                            )}
                            {r.assessment && state !== 'other' && (
                              <div className="muted text-xs mt-8">
                                {formatDateTime(r.assessment.updatedAt || r.assessment.recordedAt)}
                                {r.assessment.corrections?.length > 0 && ` · ${r.assessment.corrections.length} lần điều chỉnh`}
                              </div>
                            )}
                            {state === 'locked' && (
                              <button className="btn btn--sm mt-8" onClick={() => openCorrection(id)}>
                                <PencilLine size={14} /> Điều chỉnh
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
          {sheet && sheet.rows.length > 0 && (
            <div className="dg-legend">
              <span className="text-sm text-2">
                <span className="chip chip--green">Mã YCCĐ</span> đã chọn = trẻ đạt yêu cầu
              </span>
              <span className="text-sm text-2 row" style={{ gap: 4 }}>
                <Flag size={14} /> Cờ bé ngoan được tính cho phiếu bé ngoan tuần (≥ 4 ngày có mặt và ≥ 3 cờ)
              </span>
            </div>
          )}
        </div>
      )}

      {sheet && sheet.rows.length > 0 && (
        <div className="page-actions">
          <button className="btn" onClick={markAllPresent} disabled={saving}>
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

      <Modal
        open={!!reasonFor}
        title="Điều chỉnh đánh giá đã khóa"
        onClose={() => setReasonFor(null)}
        footer={
          <>
            <button className="btn" onClick={() => setReasonFor(null)}>
              Quay lại
            </button>
            <button className="btn btn--primary" onClick={confirmCorrection}>
              <PencilLine size={16} /> Mở điều chỉnh
            </button>
          </>
        }
      >
        <p className="mb-12">Đánh giá đã quá hạn sửa (hết ngày học tiếp theo). Lý do điều chỉnh sẽ được lưu cùng bản ghi.</p>
        <div className="field">
          <label className="field__label" htmlFor="dg-reason">
            Lý do điều chỉnh<span className="req">*</span>
          </label>
          <textarea
            id="dg-reason"
            className={`textarea ${reasonError ? 'textarea--error' : ''}`}
            rows={3}
            value={reason}
            maxLength={300}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError('');
            }}
          />
          {reasonError && <span className="field__error">{reasonError}</span>}
        </div>
      </Modal>
    </div>
  );
}
