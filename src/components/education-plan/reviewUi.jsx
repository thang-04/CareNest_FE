import { useState } from 'react';
import { Check, Send, Undo2 } from '@/components/ui/icons';
import { Card, Field, History, Modal, Notice, fmtDateTime } from '@/components/education-plan/eduUi';

/*
 * Một kiểu gửi duyệt / duyệt cho mọi tài liệu kế hoạch giáo dục (kế hoạch năm, chủ đề nhánh, hồ sơ chủ đề gồm kế hoạch
 * chủ đề + giáo án tuần, ngày): nút ở đầu trang → hộp xác nhận có ghi chú (trả lại bắt buộc lý do) → thông báo khi bị
 * trả lại dưới đầu trang → lịch sử xử lý cuối trang. Quyền và bước duyệt do service quyết định; ở đây chỉ hiển thị.
 */

/** Tên ngắn của người duyệt trên nút "Gửi … duyệt". */
export const SIGNER_SHORT = { TEAM_LEADER: 'Tổ trưởng', VICE_PRINCIPAL: 'Phó HT', PRINCIPAL: 'Hiệu trưởng' };

/** Lần trả lại gần nhất trong lịch sử (tone 'err'). */
export const lastRejection = (history) => [...(history || [])].reverse().find((h) => h.tone === 'err') || null;

/**
 * Nút gửi / trả lại / duyệt ở đầu trang và hộp xác nhận.
 * - name: tên tài liệu trong câu hỏi ("kế hoạch năm học", "chủ đề nhánh", "kế hoạch chủ đề").
 * - sendTo: người duyệt đầu tiên (vd. "Phó HT"); approveLabel: "Duyệt" hoặc "Ban hành".
 * - can: { send, reject, approve }; sendBlocked: lý do chưa gửi được (vd. còn thay đổi chưa lưu) để khóa nút.
 * - beforeOpen(action): trả false để không mở hộp (vd. kiểm tra form, nhắc thiếu dữ liệu).
 * - notes: câu giải thích thêm trong hộp theo action; onAct(action, note) trả kết quả (null khi lỗi thì hộp giữ lại).
 */
export function ReviewActions({
  name,
  sendTo,
  approveLabel = 'Duyệt',
  can = {},
  sendBlocked,
  showSend = false,
  sendDisabledReason,
  beforeOpen,
  notes = {},
  onAct,
  size = 'btn--sm',
}) {
  const [action, setAction] = useState(null);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = async (next) => {
    if (beforeOpen && (await beforeOpen(next)) === false) return;
    setNote('');
    setTried(false);
    setAction(next);
  };
  const confirm = async () => {
    setTried(true);
    if (action === 'reject' && !note.trim()) return;
    setBusy(true);
    const res = await onAct(action, note.trim() || undefined);
    setBusy(false);
    if (res) setAction(null);
  };
  const titles = {
    submit: `Gửi ${sendTo} duyệt ${name}`,
    reject: `Trả lại ${name}`,
    approve: `${approveLabel} ${name}`,
  };
  const btn = (cls) => `btn ${cls} ${size}`.trim();

  return (
    <>
      {(can.send || showSend) && (
        <button
          type="button"
          className={btn('btn--primary')}
          disabled={!can.send || !!sendBlocked}
          title={(!can.send ? sendDisabledReason || 'Bạn chưa thể gửi tài liệu này' : sendBlocked) || undefined}
          aria-description={(!can.send ? sendDisabledReason || 'Bạn chưa thể gửi tài liệu này' : sendBlocked) || undefined}
          onClick={() => open('submit')}
        >
          <Send size={16} aria-hidden /> Gửi {sendTo} duyệt
        </button>
      )}
      {can.reject && (
        <button type="button" className={btn('btn--outline-danger')} onClick={() => open('reject')}>
          <Undo2 size={16} aria-hidden /> Trả lại
        </button>
      )}
      {can.approve && (
        <button type="button" className={btn('btn--primary')} onClick={() => open('approve')}>
          <Check size={16} aria-hidden /> {approveLabel}
        </button>
      )}
      {action && (
        <Modal
          title={titles[action]}
          onClose={() => !busy && setAction(null)}
          footer={
            <>
              <button type="button" className="btn" disabled={busy} onClick={() => setAction(null)}>
                Hủy
              </button>
              <button
                type="button"
                className={action === 'reject' ? 'btn btn--outline-danger' : 'btn btn--primary'}
                disabled={busy}
                onClick={confirm}
              >
                {action === 'reject' ? (
                  <Undo2 size={16} aria-hidden />
                ) : action === 'submit' ? (
                  <Send size={16} aria-hidden />
                ) : (
                  <Check size={16} aria-hidden />
                )}{' '}
                {action === 'reject' ? 'Trả lại' : action === 'submit' ? 'Gửi' : approveLabel}
              </button>
            </>
          }
        >
          {notes[action] && <p>{notes[action]}</p>}
          <Field
            label={action === 'reject' ? 'Lý do trả lại' : 'Ghi chú (không bắt buộc)'}
            required={action === 'reject'}
            htmlFor="review-note"
            error={tried && action === 'reject' && !note.trim() ? 'Vui lòng ghi lý do trả lại' : undefined}
          >
            <textarea id="review-note" className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </Modal>
      )}
    </>
  );
}

/** Thông báo dưới đầu trang khi tài liệu đang bị trả lại. */
export function RejectedNotice({ status, history }) {
  const last = lastRejection(history);
  if (status !== 'REJECTED' || !last?.note) return null;
  return (
    <Notice tone="err">
      Bị trả lại bởi {last.by} ({fmtDateTime(last.at)}): {last.note}
    </Notice>
  );
}

/** Lịch sử xử lý ở cuối trang (thu gọn). */
export function ReviewHistory({ items }) {
  return (
    <Card>
      <details>
        <summary className="muted text-sm">Lịch sử xử lý ({items?.length || 0})</summary>
        <div className="mt-8">
          <History items={items} />
        </div>
      </details>
    </Card>
  );
}
