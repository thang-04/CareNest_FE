import { useState } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Field, Modal, Notice } from '@/components/education-plan/eduUi';
import { BLOCKED_TEXT, deadlineLabel } from '@/models/education-plan/deadline.mjs';
import { todayIso } from '@/models/education-plan/classPlan';

/** Nhãn hạn: Gần đến hạn / Quá hạn / Đúng hạn / Ban hành trễ / ngày hạn (spec 003 FR-006). */
export function DeadlineBadge({ doc }) {
  const d = deadlineLabel(doc);
  return d ? <StatusBadge tone={d.tone} label={d.label} /> : null;
}

/** Lý do chưa gửi được (quá hạn, gói học kỳ chưa duyệt) — chỉ hiện cho người soạn khi gói/hồ sơ còn Nháp. */
export function BlockedNotice({ doc, author }) {
  const text = author && doc?.status === 'DRAFT' ? BLOCKED_TEXT[doc.blockedReason] : null;
  return text ? <Notice tone="warn">{text}</Notice> : null;
}

/** HT/PHT mở hạn gói/hồ sơ quá hạn: bắt buộc lý do và hạn mới sau hôm nay (FR-004a). */
export function ExtendDeadlineButton({ doc, onExtend }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [deadline, setDeadline] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!doc?.canExtend) return null;
  const today = todayIso();
  const valid = note.trim() && deadline > today;
  const confirm = async () => {
    setTried(true);
    if (!valid) return;
    setBusy(true);
    const ok = await onExtend({ action: 'extend', note: note.trim(), deadline });
    setBusy(false);
    if (ok) setOpen(false);
  };
  return (
    <>
      <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => setOpen(true)}>
        Mở hạn
      </button>
      {open && (
        <Modal
          title="Mở hạn gửi duyệt"
          onClose={() => !busy && setOpen(false)}
          footer={
            <>
              <button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>
                Hủy
              </button>
              <button type="button" className="btn btn--primary" disabled={busy} onClick={confirm}>
                Mở hạn
              </button>
            </>
          }
        >
          <p>Giáo viên chủ nhiệm được gửi tiếp tới hạn mới. Lịch sử duyệt ghi người mở hạn và lý do.</p>
          <Field label="Hạn mới" required htmlFor="extend-deadline" error={tried && !(deadline > today) ? 'Chọn ngày sau hôm nay' : undefined}>
            <input id="extend-deadline" type="date" className="input" min={today} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
          <Field label="Lý do" required htmlFor="extend-note" error={tried && !note.trim() ? 'Vui lòng ghi lý do' : undefined}>
            <textarea id="extend-note" className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </Modal>
      )}
    </>
  );
}
