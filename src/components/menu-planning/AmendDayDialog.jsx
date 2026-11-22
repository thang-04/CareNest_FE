import { useState } from 'react';
import { Save } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SubmitOverlay } from '@/components/ui/States';
import { TextAreaField } from '@/components/form/Field';
import { MealDayChanges } from '@/components/menu-planning/MealDayChanges';

// Hỗ trợ nhập liệu; BE vẫn kiểm lại độ dài lý do (P-39)
const REASON_MIN = 10;
const REASON_MAX = 500;
const NOTE_MAX = 300;

/**
 * Bước xác nhận sửa ngoại lệ một ngày đã công bố: xem món đổi, nhập lý do (bắt buộc) và ghi chú ngày. Lưu là có hiệu lực ngay,
 * không qua duyệt; BE báo phụ huynh, bếp và tính lại trừ kho nếu ngày đã chốt suất. `error` là câu BE trả khi từ chối.
 */
export function AmendDayDialog({ title, beforeItems, afterItems, initialNote, busy, error, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState(initialNote || '');
  const reasonLength = reason.trim().length;

  return (
    <Modal
      open
      size="lg"
      title={`Sửa ngoại lệ · ${title}`}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Quay lại
          </Button>
          <Button
            variant="primary"
            icon={Save}
            loading={busy}
            disabled={reasonLength < REASON_MIN}
            onClick={() => onConfirm({ reason, note })}
          >
            Lưu thay đổi
          </Button>
        </>
      }
    >
      {busy && <SubmitOverlay state="sending" text="Đang lưu…" />}
      <div className="td-publish">
        <div className="alert alert--info">
          <div>
            Thực đơn đã công bố. Lưu xong, thay đổi có hiệu lực ngay: phụ huynh và bếp nhận thông báo kèm lý do; ngày đã chốt suất được tính
            lại lượng xuất kho.
          </div>
        </div>
        {error && (
          <div className="alert alert--danger" role="alert">
            {error}
          </div>
        )}
        <div>
          <h3 className="td-publish__title">Món thay đổi</h3>
          <MealDayChanges beforeItems={beforeItems} afterItems={afterItems} />
        </div>
        <TextAreaField
          label="Lý do sửa"
          required
          rows={3}
          maxLength={REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          hint={`Ví dụ: nhà cung cấp hết hàng, thực phẩm không đạt. Tối thiểu ${REASON_MIN} ký tự (${reasonLength}/${REASON_MAX}).`}
        />
        <TextAreaField label="Ghi chú ngày" rows={2} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}
