import { useState } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Field, Modal, Notice } from '@/components/education-plan/eduUi';
import { usePolling } from '@/hooks/usePolling';
import { BLOCKED_TEXT, deadlineLabel, deadlineToday } from '@/models/education-plan/deadline.mjs';
import { todayIso } from '@/models/education-plan/classPlan';
import { useDevClockMarks } from '@/hooks/useDevClockMarks';
import { dayEndAt } from '@/utils/devClock';

/** Nhãn hạn (spec 005 FR-020): luôn kèm "Hạn:", đặt ở chỗ riêng, không gộp với trạng thái duyệt. */
export function DeadlineBadge({ doc }) {
  const [today, setToday] = useState(deadlineToday);
  usePolling(() => setToday(deadlineToday()), { interval: 15000, enabled: doc?.deadlineState === 'NEAR' });
  const d = deadlineLabel(doc, today);
  const due = doc?.extendedTo || doc?.deadline;
  useDevClockMarks(due ? [{ label: `Hạn kế hoạch ${due.split('-').reverse().join('/')}`, at: dayEndAt(due) }] : []);
  return d ? <StatusBadge tone={d.tone} label={d.label} /> : null;
}

/** Lý do chưa gửi được (quá hạn, kế hoạch giáo dục chủ đề chưa duyệt) — chỉ hiện cho người soạn khi gói/hồ sơ còn Nháp. */
export function BlockedNotice({ doc, author }) {
  const text = author && doc?.status === 'DRAFT' ? BLOCKED_TEXT[doc.blockedReason] : null;
  return text ? <Notice>{text}</Notice> : null;
}

/** Hộp mở hạn (spec 005 FR-021a, chỉ ở màn Kế hoạch quá hạn): lý do bắt buộc, hạn mới sau hôm nay, dùng chung cho các dòng đã chọn. */
export function ExtendDeadlineModal({ title = 'Mở hạn', confirmLabel = 'Mở hạn', onClose, onConfirm }) {
  const [note, setNote] = useState('');
  const [deadline, setDeadline] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const today = todayIso();
  const valid = note.trim() && deadline > today;
  const confirm = async () => {
    setTried(true);
    if (!valid) return;
    setBusy(true);
    await onConfirm({ note: note.trim(), deadline });
    setBusy(false);
  };
  return (
    <Modal
      title={title}
      onClose={() => !busy && onClose()}
      footer={
        <>
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="btn btn--primary" disabled={busy} onClick={confirm}>
            {busy ? 'Đang xử lý…' : confirmLabel}
          </button>
        </>
      }
    >
      <Field label="Hạn mới" required htmlFor="extend-deadline" error={tried && !(deadline > today) ? 'Chọn ngày sau hôm nay' : undefined}>
        <input
          id="extend-deadline"
          type="date"
          className="input"
          min={today}
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </Field>
      <Field label="Lý do" required htmlFor="extend-note" error={tried && !note.trim() ? 'Vui lòng ghi lý do' : undefined}>
        <textarea id="extend-note" className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}
