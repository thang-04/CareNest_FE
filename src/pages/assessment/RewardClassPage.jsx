import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Download, History, Save, Send, Sparkle, Undo2 } from '@/components/ui/icons';
import { useToast } from '@/contexts/ToastContext';
import { useRewardList } from '@/hooks/assessment/useAssessment';
import { decideRewardList, reviewRewardList, saveRewardList } from '@/services/assessment/assessmentService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { RewardStatusBadge } from '@/components/assessment/AssessmentBadges';
import { ChildNameCell } from '@/components/assessment/ChildNameCell';
import { REWARD_HISTORY_LABELS, REWARD_NOTE_MAX, REWARD_STATUS as S } from '@/models/assessment/assessmentConstants';
import { formatDate, formatDateTime } from '@/utils/format';
import { downloadCsv } from '@/utils/exportCsv';
import { findDiagnosticTerms, validateDecision } from '@/utils/assessment/assessmentValidation';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

const PROGRAM = 'Hoàn thành chương trình GDMN';

/* PHT: chuyển HT / trả lại; HT: phê duyệt / trả lại. Trả lại bắt buộc nêu lý do. */
const DECISIONS = {
  FORWARD: { title: 'Chuyển Hiệu trưởng phê duyệt?', label: 'Chuyển Hiệu trưởng', negative: false },
  RETURN: { title: 'Trả lại danh sách cho giáo viên?', label: 'Trả lại', negative: true },
  APPROVE: { title: 'Phê duyệt danh sách khen thưởng?', label: 'Phê duyệt', negative: false },
};

const noteError = (note) => {
  const text = (note || '').trim();
  if (text.length > REWARD_NOTE_MAX) return `Tối đa ${REWARD_NOTE_MAX} ký tự.`;
  const terms = findDiagnosticTerms(text);
  return terms.length ? `Không dùng từ mang tính chẩn đoán “${terms[0]}”, hãy mô tả điều cô quan sát được.` : '';
};

const toForm = (detail) =>
  Object.fromEntries((detail?.children || []).map((c) => [c.childId, { titles: c.titles || [], note: c.note || '' }]));

/** Danh sách đề xuất khen thưởng cuối năm của một lớp: GV chọn danh hiệu từng trẻ (có gợi ý), PHT xem xét, HT phê duyệt. */
export default function RewardClassPage() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { detail: d, loading, error, reload } = useRewardList(classId);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [listError, setListError] = useState('');
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState('');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [decision, setDecision] = useState(null);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');

  useEffect(() => {
    setForm(toForm(d));
    setErrors({});
    setListError('');
  }, [d]);

  const awarded = useMemo(() => Object.values(form).filter((f) => f.titles.length > 0).length, [form]);

  const crumbs = <Breadcrumb items={assessmentCrumbs(SECTIONS.rewards, d ? `Lớp ${d.className}` : 'Danh sách lớp')} />;
  if (loading && !d)
    return (
      <div className="page">
        {crumbs}
        <LoadingState />
      </div>
    );
  if (error)
    return (
      <div className="page">
        {crumbs}
        {[403, 404].includes(error.status) ? (
          <StatusPage
            kind={String(error.status)}
            title="Không xem được danh sách khen thưởng"
            description="Lớp không tồn tại hoặc nằm ngoài phạm vi của bạn."
          />
        ) : (
          <ErrorState error={error} onRetry={reload} />
        )}
      </div>
    );

  const edit = d.canEdit;
  const status = d.status || 'NONE';
  const toggle = (childId, title) => {
    setForm((f) => {
      const cur = f[childId] || { titles: [], note: '' };
      const titles = cur.titles.includes(title) ? cur.titles.filter((t) => t !== title) : [...cur.titles, title];
      return { ...f, [childId]: { ...cur, titles } };
    });
    setListError('');
  };
  const setNote = (childId, note) => {
    setForm((f) => ({ ...f, [childId]: { ...(f[childId] || { titles: [] }), note } }));
    setErrors((e) => ({ ...e, [childId]: noteError(note) }));
  };
  const applySuggested = () => {
    setForm((f) =>
      Object.fromEntries(
        d.children.map((c) => {
          const cur = f[c.childId] || { titles: [], note: '' };
          return [c.childId, { ...cur, titles: [...new Set([...cur.titles, ...(c.suggested || [])])] }];
        }),
      ),
    );
    setListError('');
  };

  const items = () =>
    d.children
      .map((c) => ({
        childId: c.childId,
        titles: d.titleOptions.filter((t) => form[c.childId]?.titles.includes(t)),
        note: form[c.childId]?.note.trim() || null,
      }))
      .filter((i) => i.titles.length > 0);

  const check = (send) => {
    const e = Object.fromEntries(d.children.map((c) => [c.childId, noteError(form[c.childId]?.note)]).filter(([, m]) => m));
    setErrors(e);
    if (Object.keys(e).length) {
      setListError('Có ghi chú chưa hợp lệ, xem các ô báo đỏ.');
      return false;
    }
    if (send && items().length === 0) {
      setListError('Chọn danh hiệu cho ít nhất một trẻ trước khi gửi.');
      return false;
    }
    setListError('');
    return true;
  };

  const save = async (send) => {
    if (!check(send)) {
      setSubmitOpen(false);
      return;
    }
    setBusy(send ? 'send' : 'save');
    try {
      await saveRewardList(d.classId, items(), { submit: send });
      toast.success(send ? 'Đã gửi danh sách khen thưởng cho Phó hiệu trưởng.' : 'Đã lưu danh sách.');
      reload({ silent: true });
    } catch (err) {
      setListError(err.message);
      toast.error(err, 'Không lưu được danh sách');
    } finally {
      setBusy('');
      setSubmitOpen(false);
    }
  };

  const doDecide = async () => {
    const cfg = DECISIONS[decision];
    const e = validateDecision({ negative: cfg.negative, comment });
    if (e.comment) {
      setCommentError(e.comment);
      return;
    }
    try {
      if (d.canReview) await reviewRewardList(d.listId, { decision, comment });
      else await decideRewardList(d.listId, { decision, comment });
      toast.success('Đã ghi nhận quyết định.');
      setDecision(null);
      reload({ silent: true });
    } catch (err) {
      setCommentError(err.message);
    }
  };

  const exportCsv = () =>
    downloadCsv(
      [
        ['STT', 'Họ tên', 'Ngày sinh', 'Danh hiệu', 'Ghi chú'],
        ...d.children
          .filter((c) => (form[c.childId]?.titles || []).length)
          .map((c, i) => [i + 1, c.fullName, formatDate(c.dateOfBirth), form[c.childId].titles.join('; '), form[c.childId].note || '']),
      ],
      `khen-thuong-${d.className}.csv`,
    );

  const vp = d.vpReview;
  const ht = d.principalDecision;
  const returnedBy = d.status === S.RETURNED ? (ht?.decision === 'RETURN' && (!vp || ht.at > vp.at) ? ht : vp) : null;
  const steps = [
    {
      label: 'Giáo viên lập danh sách',
      sub: d.submittedAt ? formatDateTime(d.submittedAt) : '',
      done: !!d.status && d.status !== S.DRAFT && d.status !== S.RETURNED,
    },
    {
      label: 'Phó hiệu trưởng xem xét',
      sub: vp ? `${vp.byName || ''} · ${formatDateTime(vp.at)}` : '',
      done: [S.PENDING_PRINCIPAL, S.APPROVED].includes(d.status) && vp?.decision === 'FORWARD',
    },
    {
      label: 'Hiệu trưởng phê duyệt',
      sub: ht ? `${ht.byName || ''} · ${formatDateTime(ht.at)}` : '',
      done: d.status === S.APPROVED,
    },
  ];
  const cols = 6;

  return (
    <div className="page">
      {crumbs}
      <div className="page__head">
        <div>
          <h1 className="page__title">Danh sách khen thưởng – Lớp {d.className}</h1>
          <RewardStatusBadge status={status} size="lg" />
        </div>
      </div>

      <div className="card mt-16 dg-card-steps">
        <ProgressSteps steps={steps} />
      </div>

      {returnedBy && (
        <div className="alert alert--danger mt-16">
          <Undo2 size={18} />
          <div>
            {returnedBy.byName || 'Ban giám hiệu'} trả lại ({formatDateTime(returnedBy.at)}): “{returnedBy.comment}”
          </div>
        </div>
      )}

      <div className="card mt-16">
        <div className="card__header">
          <div className="card__title">
            {awarded}/{d.children.length} trẻ được đề xuất
          </div>
          <div className="row gap-2">
            {edit && (
              <button className="btn btn--sm" onClick={applySuggested}>
                <Sparkle size={15} /> Chọn theo gợi ý
              </button>
            )}
            {awarded > 0 && (
              <button className="btn btn--sm" onClick={exportCsv}>
                <Download size={15} /> Xuất CSV
              </button>
            )}
          </div>
        </div>
        {listError && (
          <div className="card__body">
            <span className="field__error" role="alert">
              {listError}
            </span>
          </div>
        )}
        <div className="table-wrap">
          <table className="table table--grid">
            <thead>
              <tr>
                <th>Trẻ</th>
                <th className="num">Chuyên cần</th>
                <th className="num">Phiếu bé ngoan</th>
                <th>Đánh giá cuối năm</th>
                <th>Danh hiệu</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {d.children.length === 0 ? (
                <tr>
                  <td colSpan={cols} className="muted center">
                    Lớp chưa có trẻ.
                  </td>
                </tr>
              ) : (
                d.children.map((c) => {
                  const f = form[c.childId] || { titles: [], note: '' };
                  const shown = open === c.childId;
                  return (
                    <Fragment key={c.childId}>
                      <tr>
                        <td>
                          <ChildNameCell child={{ fullName: c.fullName }} sub={c.dateOfBirth ? formatDate(c.dateOfBirth) : null} />
                        </td>
                        <td className="num nowrap">
                          {c.attendanceRate == null ? '—' : `${c.attendanceRate}%`}
                          <div className="muted text-xs">
                            {c.presentDays}/{c.schoolDays} ngày
                          </div>
                        </td>
                        <td className="num nowrap">
                          {c.weeklyTickets} tuần · {c.monthlyTickets} tháng
                        </td>
                        <td>
                          {c.yearEnd ? (
                            <button
                              className="btn btn--ghost btn--sm"
                              onClick={() => setOpen(shown ? null : c.childId)}
                              aria-expanded={shown}
                            >
                              {shown ? 'Ẩn nội dung' : 'Đã xác nhận · Xem'}
                            </button>
                          ) : (
                            <span className="text-danger text-sm">
                              Chưa xác nhận
                              {edit && (
                                <>
                                  {' '}
                                  · <Link to="/assessment/year-end">Đánh giá cuối năm</Link>
                                </>
                              )}
                            </span>
                          )}
                        </td>
                        <td>
                          {edit ? (
                            <div className="stack gap-1">
                              {d.titleOptions.map((t) => {
                                const disabled = !c.yearEnd || (t === PROGRAM && c.programCompleted !== true);
                                return (
                                  <label key={t} className={`dg-tick ${disabled ? 'muted' : ''}`}>
                                    <input
                                      type="checkbox"
                                      checked={f.titles.includes(t)}
                                      disabled={disabled}
                                      onChange={() => toggle(c.childId, t)}
                                    />
                                    {t}
                                    {c.suggested?.includes(t) && <span className="text-success text-xs"> · gợi ý</span>}
                                  </label>
                                );
                              })}
                            </div>
                          ) : f.titles.length ? (
                            f.titles.join(', ')
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                        <td className="min-w-220">
                          {edit ? (
                            <>
                              <input
                                className={`input ${errors[c.childId] ? 'input--error' : ''}`}
                                value={f.note}
                                maxLength={REWARD_NOTE_MAX}
                                disabled={!f.titles.length}
                                aria-label={`Ghi chú của ${c.fullName}`}
                                onChange={(e) => setNote(c.childId, e.target.value)}
                              />
                              {errors[c.childId] && <span className="field__error">{errors[c.childId]}</span>}
                            </>
                          ) : (
                            f.note || <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                      {shown && (
                        <tr>
                          <td colSpan={cols}>
                            <div className="dg-final text-sm">{c.yearEnd.finalContent}</div>
                            <div className="muted text-xs mt-8">
                              Xác nhận {formatDateTime(c.yearEnd.confirmedAt)}
                              {c.programCompleted != null && ` · ${c.programCompleted ? 'Hoàn thành' : 'Chưa hoàn thành'} chương trình`}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {d.history.length > 0 && (
        <div className="card mt-16">
          <div className="card__header">
            <div className="card__title">
              <History size={18} /> Lịch sử xử lý
            </div>
          </div>
          <div className="card__body">
            <ul className="history-list">
              {[...d.history].reverse().map((h) => (
                <li key={h.id}>
                  <div className="history-list__dot" />
                  <div>
                    <div>
                      <b>{REWARD_HISTORY_LABELS[h.action] || h.action}</b> · {h.userName || '—'}
                    </div>
                    {h.note && <div className="text-2">“{h.note}”</div>}
                    <div className="muted text-xs">{formatDateTime(h.at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="page-actions">
        <button className="btn" onClick={() => navigate('/assessment/rewards')} disabled={!!busy}>
          <ArrowLeft size={16} /> Về danh sách lớp
        </button>
        {edit && (
          <div className="row gap-2">
            <button className="btn" onClick={() => save(false)} disabled={!!busy}>
              {busy === 'save' ? <Spinner small /> : <Save size={16} />} Lưu nháp
            </button>
            <button className="btn btn--primary" disabled={!!busy} onClick={() => check(true) && setSubmitOpen(true)}>
              <Send size={16} /> {d.status === S.RETURNED ? 'Gửi lại danh sách' : 'Gửi danh sách'}
            </button>
          </div>
        )}
        {(d.canReview || d.canDecide) && (
          <div className="row gap-2">
            <button
              className="btn btn--outline-danger"
              onClick={() => {
                setDecision('RETURN');
                setComment('');
                setCommentError('');
              }}
            >
              <Undo2 size={16} /> Trả lại
            </button>
            <button
              className="btn btn--primary"
              onClick={() => {
                setDecision(d.canReview ? 'FORWARD' : 'APPROVE');
                setComment('');
                setCommentError('');
              }}
            >
              {d.canReview ? <Send size={16} /> : <Check size={16} />} {d.canReview ? 'Chuyển Hiệu trưởng' : 'Phê duyệt'}
            </button>
          </div>
        )}
      </div>

      <ConfirmationModal
        open={submitOpen}
        title="Gửi danh sách khen thưởng?"
        message={`${awarded} trẻ được đề xuất. Danh sách gửi Phó hiệu trưởng xem xét, trong lúc chờ duyệt bạn không sửa được.`}
        confirmLabel="Gửi danh sách"
        onConfirm={() => save(true)}
        onClose={() => setSubmitOpen(false)}
      />

      {decision && (
        <ConfirmationModal
          open
          title={DECISIONS[decision].title}
          confirmLabel={DECISIONS[decision].label}
          danger={DECISIONS[decision].negative}
          onConfirm={doDecide}
          onClose={() => setDecision(null)}
        >
          <div className="field mt-12">
            <label className="field__label" htmlFor="rw-decision-comment">
              {DECISIONS[decision].negative ? 'Lý do trả lại' : 'Ý kiến (không bắt buộc)'}
              {DECISIONS[decision].negative && <span className="req">*</span>}
            </label>
            <textarea
              id="rw-decision-comment"
              className={`textarea ${commentError ? 'textarea--error' : ''}`}
              rows={3}
              maxLength={500}
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setCommentError('');
              }}
            />
            {commentError && <span className="field__error">{commentError}</span>}
          </div>
        </ConfirmationModal>
      )}
    </div>
  );
}
