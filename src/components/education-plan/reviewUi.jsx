import { useState } from 'react';
import { Check, ListChecks, Send, Undo2, XCircle } from '@/components/ui/icons';
import { RowMenu } from '@/components/ui/RowMenu';
import { Button } from '@/components/ui/Button';
import { Card, Field, History, Modal, Notice, fmtDateTime } from '@/components/education-plan/eduUi';

/*
 * Một kiểu gửi duyệt / duyệt cho mọi tài liệu kế hoạch giáo dục (kế hoạch năm, chủ đề nhánh, hồ sơ chủ đề gồm kế hoạch
 * chủ đề + giáo án tuần, ngày): nút ở đầu trang → hộp xác nhận có ghi chú (trả lại bắt buộc lý do) → thông báo khi bị
 * trả lại dưới đầu trang → lịch sử xử lý cuối trang. Quyền và bước duyệt do service quyết định; ở đây chỉ hiển thị.
 */

/** Tên ngắn của người duyệt trong hộp xác nhận. */
export const SIGNER_SHORT = { TEAM_LEADER: 'Tổ trưởng', VICE_PRINCIPAL: 'Phó HT', PRINCIPAL: 'Hiệu trưởng' };

/** Lần trả lại gần nhất trong lịch sử (tone 'err'). */
export const lastRejection = (history) => [...(history || [])].reverse().find((h) => h.tone === 'err') || null;

/**
 * Nút "Thao tác" mở danh sách thao tác của trang (mục dạng RowMenu). Chỉ gom khi có từ 2 thao tác; 1 thao tác thì hiện
 * thẳng nút đó (Tiền 14/11/2026); không có thì không hiện.
 */
export function ActionsMenu({ items, className = 'btn btn--sm btn--outline-primary' }) {
  if (!items?.length) return null;
  if (items.length === 1) {
    const [{ label, icon, onClick, disabled }] = items;
    return (
      <Button variant="outline-primary" size="sm" icon={icon} onClick={onClick} disabled={disabled}>
        {label}
      </Button>
    );
  }
  return <RowMenu label="Thao tác" text="Thao tác" icon={<ListChecks size={16} aria-hidden />} className={className} items={items} />;
}

/**
 * Nút gửi / trả lại / duyệt ở đầu trang và hộp xác nhận.
 * - name: tên tài liệu trong câu hỏi ("kế hoạch năm học", "chủ đề nhánh", "kế hoạch chủ đề").
 * - sendTo: người duyệt đầu tiên (vd. "Phó HT"); approveLabel: "Duyệt" hoặc "Ban hành".
 * - can: { send, reject, approve }; sendBlocked: lý do chưa gửi được (vd. còn thay đổi chưa lưu) để khóa nút.
 * - beforeOpen(action): trả false để không mở hộp (vd. kiểm tra form, nhắc thiếu dữ liệu).
 * - notes: câu giải thích thêm trong hộp theo action; onAct(action, note, savedDoc) trả kết quả (null khi lỗi thì hộp giữ lại).
 * - unsaved + onSave (Tiền 05/11): nút Gửi / Ban hành / Duyệt luôn bấm được; còn thay đổi chưa lưu thì hộp báo và nút xác
 *   nhận thành "Lưu và …": lưu trước (onSave trả kết quả khác false), rồi mới gửi / duyệt. Lý do khác chưa gửi được
 *   (sendBlocked, không có quyền) thì bấm vẫn được nhưng chỉ hiện thông báo lý do, không mờ nút.
 * - menu (Tiền 14/11/2026): gom gửi/trả lại/duyệt vào một nút "Thao tác" mở danh sách; menu.before/after là các mục
 *   khác của trang (dạng mục RowMenu) đứng trước/sau theo trình tự thao tác.
 */
export function ReviewActions({
  name,
  sendTo,
  approveLabel = 'Duyệt',
  sendLabel = 'Gửi duyệt',
  can = {},
  sendBlocked,
  showSend = false,
  sendDisabledReason,
  beforeOpen,
  notes = {},
  onAct,
  size = 'btn--sm',
  variant = 'btn--primary',
  unsaved = false,
  onSave,
  menu = null,
}) {
  const [action, setAction] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actError, setActError] = useState('');
  const open = async (next) => {
    if (beforeOpen && (await beforeOpen(next)) === false) {
      requestAnimationFrame(() => {
        const errEl =
          document.querySelector('.ga-plan-error-summary') ||
          document.querySelector('.alert--danger') ||
          document.querySelector('[role="alert"]') ||
          document.querySelector('.field__error') ||
          document.querySelector('[aria-invalid="true"]');
        errEl?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        errEl?.focus?.({ preventScroll: true });
      });
      return;
    }
    setNote('');
    setTried(false);
    setActError('');
    setAction(next);
  };
  const confirm = async () => {
    setTried(true);
    setActError('');
    if (action === 'reject' && !note.trim()) return;
    setBusy(true);
    let savedDoc = null;
    const scrollToError = () => {
      requestAnimationFrame(() => {
        const errEl =
          document.querySelector('.ga-plan-error-summary') ||
          document.querySelector('.alert--danger') ||
          document.querySelector('[role="alert"]') ||
          document.querySelector('.field__error') ||
          document.querySelector('[aria-invalid="true"]');
        errEl?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        errEl?.focus?.({ preventScroll: true });
      });
    };
    try {
      if (unsaved && onSave && action !== 'reject') {
        const res = await onSave();
        if (!res) {
          setAction(null);
          setBusy(false);
          scrollToError();
          return;
        }
        savedDoc = typeof res === 'object' ? res : null;
      }
      const res = await onAct(action, note.trim() || undefined, savedDoc);
      if (res) {
        setAction(null);
      } else {
        setAction(null);
        scrollToError();
      }
    } catch (err) {
      setAction(null);
      setActError(err?.message || 'Có lỗi xảy ra khi thực hiện thao tác.');
      scrollToError();
    } finally {
      setBusy(false);
    }
  };
  const titles = {
    submit: sendTo ? `Gửi ${sendTo} duyệt ${name}` : `Gửi duyệt ${name}`,
    reject: `Trả lại ${name}`,
    approve: `${approveLabel} ${name}`,
  };
  const btn = (cls) => `btn ${cls} ${size}`.trim();
  const sendReason = !can.send ? sendDisabledReason || 'Bạn chưa thể gửi tài liệu này' : sendBlocked;
  // Nhãn nút xác nhận: còn thay đổi chưa lưu thì "Lưu và …" (nhãn đã có chữ Lưu thì giữ)
  const withSave = (label) => (unsaved && !/^lưu/i.test(label) ? `Lưu và ${label.charAt(0).toLowerCase()}${label.slice(1)}` : label);

  const sendClick = () => (sendReason ? setBlocked(sendReason) : open('submit'));
  const menuItems = menu && [
    ...(menu.before || []),
    ...(can.send || showSend ? [{ label: sendLabel, icon: Send, onClick: sendClick }] : []),
    ...(can.reject ? [{ label: 'Trả lại', icon: Undo2, onClick: () => open('reject') }] : []),
    ...(can.approve ? [{ label: approveLabel, icon: Check, onClick: () => open('approve') }] : []),
    ...(menu.after || []),
  ];

  return (
    <>
      {menu && <ActionsMenu items={menuItems} className={btn(variant)} />}
      {!menu && (can.send || showSend) && (
        <button
          type="button"
          className={btn(variant)}
          title={sendReason || undefined}
          aria-description={sendReason || undefined}
          onClick={sendClick}
        >
          <Send size={16} aria-hidden /> {sendLabel}
        </button>
      )}
      {!menu && can.reject && (
        <button type="button" className={btn('btn--outline-danger')} onClick={() => open('reject')}>
          <Undo2 size={16} aria-hidden /> Trả lại
        </button>
      )}
      {!menu && can.approve && (
        <button type="button" className={btn(variant)} onClick={() => open('approve')}>
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
                {action === 'reject' ? 'Trả lại' : action === 'submit' ? 'Gửi duyệt' : withSave(approveLabel)}
              </button>
            </>
          }
        >
          {actError && <Notice>{actError}</Notice>}
          {unsaved && action !== 'submit' && action !== 'reject' && (
            <Notice>Còn thay đổi chưa lưu. Bấm "{withSave(approveLabel)}" để lưu rồi tiếp tục.</Notice>
          )}
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
      {blocked && (
        <Modal
          title={titles.submit}
          onClose={() => setBlocked(null)}
          footer={
            <button type="button" className="btn btn--primary" onClick={() => setBlocked(null)}>
              Đã hiểu
            </button>
          }
        >
          <p>{blocked}</p>
        </Modal>
      )}
    </>
  );
}

/** Thông báo dưới đầu trang khi tài liệu đang bị trả lại. */
export function RejectedNotice({ status, history }) {
  const last = lastRejection(history);
  if (!['DRAFT', 'REJECTED'].includes(status) || !last?.note) return null;
  return (
    // Lý do trả lại: khung đỏ giống nhau ở mọi trang, ngay dưới hàng nút (Tiền 12/11/2026); thông báo khác vẫn là chữ đỏ
    <div className="alert alert--danger ga-notice" role="status">
      <XCircle size={18} aria-hidden />
      <span>
        Bị trả lại bởi {last.by} ({fmtDateTime(last.at)}): {last.note}
      </span>
    </div>
  );
}

/** Lịch sử xử lý ở cuối trang (thu gọn). */
export function ReviewHistory({ items, open = false }) {
  return (
    <Card>
      <details open={open}>
        <summary className="muted text-sm">Lịch sử duyệt ({items?.length || 0})</summary>
        <div className="mt-8">
          <History items={items} />
        </div>
      </details>
    </Card>
  );
}
