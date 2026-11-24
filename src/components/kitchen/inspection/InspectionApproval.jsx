import { useState } from 'react';
import { SelectField, TextAreaField } from '@/components/form/Field';
import { Button } from '@/components/ui/Button';
import { LockNote } from '@/components/ui/LockNote';
import { Modal } from '@/components/ui/Modal';
import { ErrorState } from '@/components/ui/States';
import { createStatusBadge } from '@/components/ui/StatusBadge';
import { CheckCircle2, Clock, Hourglass, Lock, Unlock, XCircle } from '@/components/ui/icons';
import { useToast } from '@/contexts/ToastContext';
import { useInspectionApprovalQueue } from '@/hooks/kitchen/useInspectionDay';
import {
  APPROVAL_HOUR_OPTIONS,
  APPROVAL_STATUS_LABELS,
  APPROVAL_TEXT_MAX,
  INSPECTION_TAB_LABELS,
} from '@/models/kitchen/inspectionConstants';
import { formatDate, formatDateTime } from '@/utils/format';
import { approvalNotice, isApprovalTextValid } from '@/utils/kitchen/inspectionApproval';

/*
 * Mở ghi mẫu của ngày đã qua cần Hiệu trưởng duyệt (INS-05): nhãn trạng thái, dòng nhắc, hộp gửi yêu cầu / tự mở, hộp duyệt - từ chối
 * - thu hồi và hàng chờ của Hiệu trưởng. Mọi quyết định (ngày nào khóa, ai được gửi, hạn mở) do BE trả; ở đây chỉ hiển thị và gửi.
 */

// Chờ duyệt = vàng (purple ở web), đang mở = xanh, bị từ chối / thu hồi = đỏ, hết hạn = cam, đã ký xong = xám (DESIGN §3.2)
export const ApprovalStatusBadge = createStatusBadge(
  {
    PENDING: ['purple', Hourglass],
    APPROVED: ['green', Unlock],
    REJECTED: ['red', XCircle],
    REVOKED: ['red', XCircle],
    CONSUMED: ['gray', CheckCircle2],
    EXPIRED: ['orange', Clock],
  },
  APPROVAL_STATUS_LABELS,
);

/** Dòng nhắc trạng thái mở ghi của một mẫu; không hiện gì khi không có gì cần nói (ngày hôm nay). */
export function ApprovalNotice({ approval, className }) {
  const notice = approvalNotice(approval);
  return notice ? (
    <LockNote kind={notice.kind} className={className}>
      {notice.text}
    </LockNote>
  ) : null;
}

const hoursOf = (value) => (value ? Number(value) : undefined);

/**
 * Hộp nhập lý do rồi gửi yêu cầu mở mẫu ngày cũ. `selfOpen` (Hiệu trưởng): mở ngay, chọn hạn mở, lý do ghi vào lịch sử;
 * PHT: gửi chờ Hiệu trưởng duyệt, hạn do Hiệu trưởng chọn khi duyệt. `onConfirm({ reason, validHours })` trả true khi xong.
 */
export function ApprovalRequestDialog({ tab, date, selfOpen, busy, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState('48');
  const [error, setError] = useState('');
  const confirm = async () => {
    if (!isApprovalTextValid(reason)) {
      setError('Nhập lý do, ít nhất 3 ký tự.');
      return;
    }
    if (await onConfirm({ reason: reason.trim(), validHours: selfOpen ? hoursOf(hours) : undefined })) onClose();
  };
  return (
    <Modal
      open
      size="sm"
      title={selfOpen ? 'Mở mẫu để sửa' : 'Yêu cầu Hiệu trưởng mở mẫu'}
      onClose={busy ? undefined : onClose}
      closeOnBackdrop={false}
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            Hủy
          </Button>
          <Button variant="primary" icon={Unlock} loading={busy} onClick={confirm}>
            {selfOpen ? 'Mở để sửa' : 'Gửi yêu cầu'}
          </Button>
        </>
      }
    >
      <div className="kr-reopen">
        <p className="kr-reopen__ctx">
          <b>{INSPECTION_TAB_LABELS[tab]}</b> · Ngày {formatDate(date)}
        </p>
        <div className="alert alert--warning kr-reopen__alert" role="note">
          <Lock size={18} />
          <div>
            <b>Ngày đã qua nên cần Hiệu trưởng cho phép:</b>
            <ul>
              <li>
                {selfOpen
                  ? 'Quyền mở chỉ cho mẫu này, ngày này, trong thời hạn bạn chọn.'
                  : 'Chỉ mở đúng mẫu này, ngày này, sau khi Hiệu trưởng duyệt.'}
              </li>
              <li>Ký xong thì quyền mở tự đóng; muốn sửa lại lần nữa phải xin mở lại.</li>
              {selfOpen && <li>Lý do và người mở được ghi lại.</li>}
            </ul>
          </div>
        </div>
        <TextAreaField
          label={selfOpen ? 'Lý do mở' : 'Lý do xin mở'}
          required
          rows={3}
          maxLength={APPROVAL_TEXT_MAX}
          value={reason}
          error={error}
          hint="Ghi rõ vì sao cần sửa, ví dụ: quên ghi lưu mẫu bữa trưa ngày hôm trước."
          autoFocus
          onChange={(e) => {
            setReason(e.target.value);
            setError('');
          }}
        />
        {selfOpen && (
          <SelectField label="Mở trong" value={hours} options={APPROVAL_HOUR_OPTIONS} onChange={(e) => setHours(e.target.value)} />
        )}
      </div>
    </Modal>
  );
}

const DECISIONS = {
  approve: { title: 'Duyệt yêu cầu mở mẫu', confirm: 'Duyệt', noteLabel: 'Ghi chú (không bắt buộc)', required: false, danger: false },
  reject: { title: 'Từ chối yêu cầu mở mẫu', confirm: 'Từ chối', noteLabel: 'Lý do từ chối', required: true, danger: true },
  revoke: { title: 'Thu hồi quyền mở mẫu', confirm: 'Thu hồi', noteLabel: 'Lý do thu hồi', required: true, danger: true },
};

/**
 * Hiệu trưởng duyệt, từ chối hoặc thu hồi. `context` = { tab, date, requestedByName, reason } chỉ để nhắc đang xử lý yêu cầu nào.
 * Duyệt chọn hạn mở; từ chối và thu hồi bắt buộc ghi lý do. `onConfirm({ note, validHours })` trả true khi xong.
 */
export function ApprovalDecisionDialog({ mode, context, busy, onConfirm, onClose }) {
  const spec = DECISIONS[mode];
  const [note, setNote] = useState('');
  const [hours, setHours] = useState('48');
  const [error, setError] = useState('');
  const confirm = async () => {
    if (spec.required && !isApprovalTextValid(note)) {
      setError('Nhập lý do, ít nhất 3 ký tự.');
      return;
    }
    if (await onConfirm({ note: note.trim(), validHours: mode === 'approve' ? hoursOf(hours) : undefined })) onClose();
  };
  return (
    <Modal
      open
      size="sm"
      title={spec.title}
      onClose={busy ? undefined : onClose}
      closeOnBackdrop={false}
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            Hủy
          </Button>
          <Button variant={spec.danger ? 'danger' : 'primary'} loading={busy} onClick={confirm}>
            {spec.confirm}
          </Button>
        </>
      }
    >
      <div className="kr-reopen">
        <p className="kr-reopen__ctx">
          <b>{INSPECTION_TAB_LABELS[context.tab]}</b> · Ngày {formatDate(context.date)}
          {context.requestedByName && ` · ${context.requestedByName} xin mở`}
          {context.reason && <span className="muted"> — {context.reason}</span>}
        </p>
        {mode === 'approve' && (
          <SelectField label="Mở trong" value={hours} options={APPROVAL_HOUR_OPTIONS} onChange={(e) => setHours(e.target.value)} />
        )}
        <TextAreaField
          label={spec.noteLabel}
          required={spec.required}
          rows={3}
          maxLength={APPROVAL_TEXT_MAX}
          value={note}
          error={error}
          autoFocus={mode !== 'approve'}
          onChange={(e) => {
            setNote(e.target.value);
            setError('');
          }}
        />
      </div>
    </Modal>
  );
}

/**
 * Hàng chờ yêu cầu mở mẫu ngày cũ của Hiệu trưởng (mọi điểm trường). Không hiện gì khi không có yêu cầu nào chờ.
 * `campusNameOf(campusId)` đổi mã điểm trường ra tên; `onOpenDay(item)` đưa trang tới đúng điểm trường, ngày; `onDecided` để trang
 * nạp lại trạng thái các mẫu sau khi xử lý.
 */
export function InspectionApprovalQueue({ campusNameOf, onOpenDay, onDecided }) {
  const toast = useToast();
  const queue = useInspectionApprovalQueue(true);
  const [deciding, setDeciding] = useState(null);
  const [busy, setBusy] = useState(false);

  const decide = async ({ note, validHours }) => {
    setBusy(true);
    try {
      await queue.decide(deciding.item.id, deciding.mode, { note, validHours });
      await queue.reload({ silent: true });
      await onDecided();
      toast.success(deciding.mode === 'approve' ? 'Đã duyệt, PHT ghi được mẫu này.' : 'Đã từ chối yêu cầu.');
      return true;
    } catch (err) {
      toast.error(err, 'Chưa xử lý được yêu cầu');
      // 409: yêu cầu đã được xử lý hoặc đổi trạng thái ở nơi khác ⇒ nạp lại hàng chờ cho đúng
      await queue.reload({ silent: true });
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (queue.error) return <ErrorState error={queue.error} onRetry={queue.reload} />;
  if (!queue.data?.length) return null;
  return (
    <section className="card" aria-label="Yêu cầu mở mẫu chờ duyệt">
      <div className="card__body kr-approvals">
        <h2 className="card__title">Yêu cầu mở mẫu chờ duyệt ({queue.data.length})</h2>
        {queue.data.map((item) => (
          <div key={item.id} className="kr-approval">
            <div className="kr-approval__main">
              <div>
                <b>{INSPECTION_TAB_LABELS[item.tab]}</b> · Ngày {formatDate(item.date)} · {campusNameOf(item.campusId)}
              </div>
              <div className="text-sm muted">
                {item.requestedByName} gửi lúc {formatDateTime(item.requestedAt)} — {item.reason}
              </div>
            </div>
            <div className="kr-approval__actions">
              <Button size="sm" onClick={() => onOpenDay(item)}>
                Xem ngày
              </Button>
              <Button size="sm" variant="primary" onClick={() => setDeciding({ item, mode: 'approve' })}>
                Duyệt
              </Button>
              <Button size="sm" onClick={() => setDeciding({ item, mode: 'reject' })}>
                Từ chối
              </Button>
            </div>
          </div>
        ))}
      </div>
      {deciding && (
        <ApprovalDecisionDialog
          mode={deciding.mode}
          context={deciding.item}
          busy={busy}
          onConfirm={decide}
          onClose={() => setDeciding(null)}
        />
      )}
    </section>
  );
}
