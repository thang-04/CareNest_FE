import { useEffect, useState } from 'react';
import { CheckCircle2, Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ErrorState, Spinner } from '@/components/ui/States';
import { confirmClassMonthlyComment, getClassMonthlyComment, saveClassMonthlyComment } from '@/services/assessment/assessmentService';
import { formatDateTime } from '@/utils/format';

/**
 * Nhận xét chung cả lớp của một tháng (BE OBS-26), đặt trên danh sách Đánh giá tháng: GV lớp sửa bản nháp hệ thống viết
 * rồi xác nhận; BGH xem bản đã xác nhận. month = ngày 1 của tháng (yyyy-MM-01).
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
  useEffect(() => setText(data?.content || data?.draft || ''), [data]);

  if (!classId || !month) return null;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <Spinner deferred />;

  const label = `Nhận xét chung của lớp ${data.className} – tháng ${month.slice(5, 7)}/${month.slice(0, 4)}`;
  const run = async (key, fn, message) => {
    setBusy(key);
    try {
      await fn({ classId, month, content: text }, user);
      toast.success(message);
      reload({ silent: true });
    } catch (err) {
      toast.error(err, 'Chưa lưu được nhận xét chung');
    } finally {
      setBusy('');
      setConfirmOpen(false);
    }
  };

  return (
    <div className="card mb-16">
      <div className="card__header">
        <div className="card__title">{label}</div>
        {data.status === 'CONFIRMED' && (
          <span className="chip chip--green">Đã xác nhận{data.confirmedAt ? ` · ${formatDateTime(data.confirmedAt)}` : ''}</span>
        )}
      </div>
      <div className="card__body">
        {data.status === 'NOT_READY' ? (
          <p className="muted">Tháng chưa kết thúc: nhận xét chung của lớp viết sau khi hết tháng.</p>
        ) : data.canEdit ? (
          <>
            <textarea
              className="textarea"
              rows={5}
              maxLength={3000}
              aria-label={label}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="row gap-2 mt-12 sc-end">
              <button className="btn" onClick={() => run('save', saveClassMonthlyComment, 'Đã lưu nhận xét chung.')} disabled={!!busy}>
                {busy === 'save' ? <Spinner small /> : <Save size={16} />} Lưu
              </button>
              <button className="btn btn--primary" onClick={() => setConfirmOpen(true)} disabled={!!busy}>
                <CheckCircle2 size={16} /> Xác nhận
              </button>
            </div>
          </>
        ) : data.content ? (
          <div className="dg-final text-sm">{data.content}</div>
        ) : (
          <p className="muted">Giáo viên chưa xác nhận nhận xét chung của lớp tháng này.</p>
        )}
      </div>
      <ConfirmationModal
        open={confirmOpen}
        title="Xác nhận nhận xét chung của lớp?"
        message="Ban giám hiệu xem được nhận xét sau khi xác nhận. Đã xác nhận thì không sửa được."
        confirmLabel="Xác nhận"
        onConfirm={() => run('confirm', confirmClassMonthlyComment, 'Đã xác nhận nhận xét chung của lớp.')}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
