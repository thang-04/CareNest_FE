import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { useDraftBackup } from '@/hooks/assessment/useDraftBackup';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { VersionHistory } from '@/components/assessment/VersionHistory';
import { docLines } from '@/models/assessment/draftHistory.mjs';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/States';
import { confirmClassMonthlyComment, getClassMonthlyComment, saveClassMonthlyComment } from '@/services/assessment/assessmentService';
import { formatDateTime } from '@/utils/format';
import { inlineErrors } from '@/utils/assessment/assessmentValidation';

/**
 * Nhận xét chung cả lớp của một tháng (BE OBS-26), đặt trên danh sách Đánh giá tháng: GV lớp sửa bản nháp hệ thống viết
 * rồi xác nhận; BGH xem bản đã xác nhận. month = ngày 1 của tháng (yyyy-MM-01). Đang soạn: giữ ẩn trên máy và Lịch sử
 * phiên bản như kế hoạch giáo dục; rời màn khi chưa lưu thì hỏi.
 */
export function ClassMonthlyCommentCard({ classId, month }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => getClassMonthlyComment({ classId, month }, user), [classId, month, user?.id], {
    enabled: !!classId && !!month,
  });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const savedText = data ? data.content || data.draft || '' : null;
  // Bản trên hệ thống mà ô nhập đang dựa vào: chỉ so "đã sửa" sau khi đã nạp (không hỏi lưu khi vừa mở màn)
  const [loadedFrom, setLoadedFrom] = useState(null);
  useEffect(() => {
    setText(savedText || '');
    setLoadedFrom(savedText);
    setErrors({});
  }, [savedText]);
  const editable = !!data?.canEdit;
  const unsaved = editable && savedText != null && loadedFrom === savedText && text !== savedText;
  const backup = useDraftBackup({
    userId: user?.id,
    docKey: classId && month ? `class-monthly-comment:${classId}:${month}` : null,
    doc: text,
    saved: savedText,
    base: data ? `${data.status}|${data.updatedAt || ''}` : null,
    enabled: editable,
  });
  const saveRef = useRef(null);
  const guard = useLeaveGuard({ when: unsaved, onSave: () => saveRef.current?.() ?? false });

  if (!classId || !month) return null;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Spinner deferred />;

  const label = `Nhận xét chung của lớp ${data.className} – tháng ${month.slice(5, 7)}/${month.slice(0, 4)}`;
  const run = async (key, fn, message) => {
    setBusy(key);
    setErrors({});
    try {
      await fn({ classId, month, content: text }, user);
      backup.clear();
      toast.success(message);
      reload({ silent: true });
      return true;
    } catch (err) {
      setErrors(inlineErrors(err, ['content']));
      return false;
    } finally {
      setBusy('');
      setConfirmOpen(false);
    }
  };
  saveRef.current = () => run('save', saveClassMonthlyComment, 'Đã lưu nhận xét chung.');

  return (
    <div className="card mb-16">
      <div className="card__header">
        <div className="card__title">{label}</div>
        {data.canEdit && (
          <VersionHistory
            drafts={backup.drafts}
            saved={savedText}
            current={text}
            unsaved={unsaved}
            linesOf={docLines}
            onUse={(entry, doc) => {
              setText(doc);
              if (entry) backup.used(entry);
            }}
          />
        )}
        {data.status === 'CONFIRMED' && (
          <span className="chip chip--green">Đã xác nhận{data.confirmedAt ? ` · ${formatDateTime(data.confirmedAt)}` : ''}</span>
        )}
      </div>
      <div className="card__body">
        {data.status === 'NOT_READY' ? (
          <p className="muted">Tháng chưa kết thúc: nhận xét chung của lớp viết sau khi hết tháng.</p>
        ) : data.canEdit ? (
          <>
            {errors._form && (
              <div className="alert alert--danger mb-12" role="alert">
                {errors._form}
              </div>
            )}
            <textarea
              className={`textarea ${errors.content ? 'input--error' : ''}`}
              rows={5}
              maxLength={3000}
              aria-label={label}
              aria-invalid={!!errors.content}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setErrors({});
              }}
            />
            {errors.content && <p className="field__error">{errors.content}</p>}
            <div className="row gap-2 mt-12 sc-end">
              <button className="btn" onClick={() => run('save', saveClassMonthlyComment, 'Đã lưu nhận xét chung.')} disabled={!!busy}>
                {busy === 'save' ? <Spinner small /> : <Save size={16} />} Lưu
              </button>
              <button className="btn btn--primary" onClick={() => setConfirmOpen(true)} disabled={!!busy}>
                <CheckCircle2 size={16} /> Xác nhận nhận xét
              </button>
            </div>
          </>
        ) : data.content ? (
          <div className="dg-final text-sm">{data.content}</div>
        ) : (
          <EmptyState
            title="Chưa có nhận xét chung tháng này"
            description="Hiện ở đây sau khi giáo viên xác nhận nhận xét chung của lớp."
          />
        )}
      </div>
      <ConfirmationModal
        open={confirmOpen}
        title="Xác nhận nhận xét chung của lớp?"
        message="Ban giám hiệu xem được nhận xét sau khi xác nhận. Đã xác nhận thì không sửa được."
        confirmLabel="Xác nhận nhận xét"
        onConfirm={() => run('confirm', confirmClassMonthlyComment, 'Đã xác nhận nhận xét chung của lớp.')}
        onClose={() => setConfirmOpen(false)}
      />
      <LeaveConfirmModal
        {...guard.modal}
        canSave
        message="Nhận xét chung của lớp có chỉnh sửa chưa lưu."
        onDiscard={() => {
          backup.clear({ pause: true });
          guard.modal.onDiscard();
        }}
      />
    </div>
  );
}
