import { useEffect, useMemo, useState } from 'react';
import { PenLine, Save, Send, Sparkles } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { useDailyAssessmentClasses } from '@/hooks/assessment/useAssessment';
import { AiDraftTag } from '@/components/ui/AiDraftTag';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusPage } from '@/components/ui/StatusPage';
import { SelectField, TextAreaField } from '@/components/form/Field';
import { WeekPicker } from '@/components/form/WeekPicker';
import {
  getWeeklyComments,
  saveWeeklyComment,
  sendWeeklyComments,
  writeWeeklyCommentDrafts,
} from '@/services/assessment/assessmentService';
import {
  boardCounts,
  contentError,
  statusChip,
  WEEKLY_COMMENT_MAX,
  WEEKLY_STATUS,
  weekDataCells,
} from '@/models/assessment/weeklyComments.mjs';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import { formatDateTime, todayInput } from '@/utils/format';
import { mondayOf } from '@/utils/week';
import '@/styles/modules/assessment.css';

/** Nhận xét tuần theo trẻ (BE OBS-29): GV viết nháp từ số liệu tuần, sửa, gửi phụ huynh; BGH, tổ trưởng chỉ xem. */
export default function WeeklyCommentsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const thisWeek = mondayOf(todayInput());
  const { classes, loading: classesLoading, error: classesError } = useDailyAssessmentClasses();
  const [classId, setClassId] = useState('');
  const [weekStart, setWeekStart] = useState(thisWeek);
  const [childId, setChildId] = useState('');
  const [text, setText] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(null);
  const currentClassId = classId || classes[0]?.id || '';
  const {
    data: board,
    loading,
    error,
    reload,
    setData,
  } = useAsync(() => getWeeklyComments({ classId: currentClassId, weekStart }, user), [currentClassId, weekStart, user?.id], {
    enabled: !!currentClassId,
  });
  const rows = useMemo(() => board?.children || [], [board]);
  const row = rows.find((r) => String(r.childId) === String(childId)) || rows[0];
  const counts = boardCounts(rows);
  const editable = !!board?.canEdit && row?.status !== WEEKLY_STATUS.SENT;
  const saved = row?.content || '';

  // Đổi trẻ / tải lại: ô nhập lấy bản trên hệ thống
  useEffect(() => {
    setText(saved);
    setErrors({});
  }, [row?.childId, saved]);

  const run = async (key, fn, success) => {
    setBusy(key);
    setErrors({});
    try {
      const next = await fn();
      setData(next);
      if (next?.aiFallback) toast.warning('AI chưa phản hồi, đã viết nháp theo số liệu tuần.');
      else if (success) toast.success(success);
      return true;
    } catch (err) {
      setErrors({ content: err.details?.content, _form: err.details?.content ? '' : err.message });
      return false;
    } finally {
      setBusy('');
    }
  };
  const base = { classId: currentClassId, weekStart: board?.weekStart || weekStart };
  const draftOne = (overwrite) =>
    run(
      'draft',
      () => writeWeeklyCommentDrafts({ ...base, childId: row.childId, overwrite, ai: !!board?.aiEnabled }, user),
      'Đã viết nháp.',
    );
  const draftAll = () =>
    run(
      'draftAll',
      () => writeWeeklyCommentDrafts({ ...base, ai: !!board?.aiEnabled }, user),
      'Đã viết nháp cho các trẻ chưa có nhận xét.',
    );
  const save = () => {
    const msg = contentError(text);
    if (msg) return setErrors({ content: msg });
    return run('save', () => saveWeeklyComment({ ...base, childId: row.childId, content: text }, user), 'Đã lưu nháp.');
  };
  const askSend = () => {
    const msg = contentError(text, { sending: true });
    if (msg) return setErrors({ content: msg });
    return setConfirm('one');
  };
  const doSend = async () => {
    const one = confirm === 'one';
    const ok = await run(
      'send',
      () => sendWeeklyComments(one ? { ...base, childId: row.childId, content: text } : base, user),
      one ? 'Đã gửi nhận xét cho phụ huynh.' : 'Đã gửi các nhận xét cho phụ huynh.',
    );
    if (ok || !one) setConfirm(null);
  };
  const aiLabel = board?.aiEnabled ? 'AI viết nháp' : 'Viết nháp';

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.weeklyComments)} />
      <h1 className="page__title">Nhận xét tuần</h1>
      {classesError ? (
        <ErrorState error={classesError} />
      ) : !classesLoading && classes.length === 0 ? (
        <StatusPage kind="403" title="Bạn chưa được phân công lớp" description="Chỉ giáo viên của lớp mới viết nhận xét tuần." />
      ) : (
        <div className="card">
          <div className="filter-bar wc-bar">
            {classes.length > 1 ? (
              <SelectField
                aria-label="Lớp"
                value={currentClassId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setChildId('');
                }}
                options={classes.map((c) => ({ value: c.id, label: c.name }))}
              />
            ) : (
              <span className="fw-600">{classes[0]?.name}</span>
            )}
            <WeekPicker
              value={weekStart}
              thisWeek={thisWeek}
              onChange={(w) => {
                setWeekStart(w);
                setChildId('');
              }}
            />
            <div className="spacer" />
            {board && (
              <span className="text-sm muted">
                Đã gửi {counts.sent}/{counts.total}
              </span>
            )}
            {board?.canEdit && (
              <>
                <Button icon={board.aiEnabled ? Sparkles : PenLine} loading={busy === 'draftAll'} disabled={!!busy} onClick={draftAll}>
                  {aiLabel} cả lớp
                </Button>
                <Button variant="primary" icon={Send} disabled={!!busy || !counts.ready} onClick={() => setConfirm('all')}>
                  Gửi cả lớp ({counts.ready})
                </Button>
              </>
            )}
          </div>
          {errors._form && (
            <p className="field__error" role="alert">
              {errors._form}
            </p>
          )}
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : loading || classesLoading || !board ? (
            <Spinner deferred />
          ) : rows.length === 0 ? (
            <EmptyState title="Lớp chưa có trẻ trong tuần này" />
          ) : (
            <div className="wc-layout">
              <nav className="wc-children" aria-label="Danh sách trẻ">
                {rows.map((r) => {
                  const chip = statusChip(r);
                  const active = r.childId === row.childId;
                  return (
                    <Button
                      key={r.childId}
                      variant="ghost"
                      className={`wc-child ${active ? 'is-active' : ''}`}
                      aria-current={active || undefined}
                      onClick={() => setChildId(r.childId)}
                    >
                      <span className="wc-child__name">{r.fullName}</span>
                      <StatusBadge tone={chip.tone} label={chip.label} size="sm" />
                    </Button>
                  );
                })}
              </nav>
              <section className="wc-panel" aria-label={`Nhận xét tuần của ${row.fullName}`}>
                <div className="wc-panel__head">
                  <h2 className="section-title">{row.fullName}</h2>
                  {row.status === WEEKLY_STATUS.SENT ? (
                    <StatusBadge tone="green" label={`Đã gửi · ${formatDateTime(row.sentAt)}`} />
                  ) : (
                    row.draftSource === 'AI' && <AiDraftTag />
                  )}
                </div>
                <div className="wc-cells">
                  {weekDataCells(row.data).map((c) => (
                    <div key={c.key} className="wc-cell">
                      <span className="text-sm muted">{c.label}</span>
                      <span className="fw-600">{c.value}</span>
                    </div>
                  ))}
                </div>
                {row.data?.unmetGoals?.length > 0 && (
                  <div className="wc-unmet">
                    <span className="text-sm fw-600">Mục tiêu chưa đạt</span>
                    <ul className="wc-unmet__list">
                      {row.data.unmetGoals.map((g) => (
                        <li key={g} className="text-sm">
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {editable ? (
                  <>
                    <TextAreaField
                      label="Nhận xét tuần"
                      rows={10}
                      maxLength={WEEKLY_COMMENT_MAX + 200}
                      value={text}
                      error={errors.content}
                      onChange={(e) => {
                        setText(e.target.value);
                        if (errors.content) setErrors((x) => ({ ...x, content: '' }));
                      }}
                    />
                    <div className="row gap-2 sc-end">
                      <Button
                        icon={board.aiEnabled ? Sparkles : PenLine}
                        loading={busy === 'draft'}
                        disabled={!!busy}
                        onClick={() => draftOne(!!text.trim())}
                      >
                        {aiLabel}
                      </Button>
                      <Button icon={Save} loading={busy === 'save'} disabled={!!busy} onClick={save}>
                        Lưu nháp
                      </Button>
                      <Button variant="primary" icon={Send} disabled={!!busy} onClick={askSend}>
                        Gửi phụ huynh
                      </Button>
                    </div>
                  </>
                ) : row.content ? (
                  <div className="dg-final text-sm wc-text">{row.content}</div>
                ) : (
                  <EmptyState title={row.absentAllWeek ? 'Trẻ nghỉ cả tuần' : 'Chưa có nhận xét tuần'} />
                )}
              </section>
            </div>
          )}
        </div>
      )}
      <ConfirmationModal
        open={!!confirm}
        title={confirm === 'all' ? 'Gửi cả lớp cho phụ huynh?' : 'Gửi nhận xét cho phụ huynh?'}
        message={
          confirm === 'all'
            ? `Gửi ${counts.ready} nhận xét đã viết xong. Đã gửi thì không sửa được nữa.`
            : `Gửi nhận xét tuần của ${row?.fullName || 'trẻ'}. Đã gửi thì không sửa được nữa.`
        }
        confirmLabel="Gửi phụ huynh"
        error={confirm ? errors._form || errors.content : ''}
        onConfirm={doSend}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
