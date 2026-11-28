import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { LABELS } from '@/components/ui/labels';

const COLUMNS = [
  { key: 'label', header: 'Mục' },
  { key: 'before', header: 'Trước', className: 'muted' },
  { key: 'after', header: 'Sau khi lưu', className: 'fw-600' },
];

/** Soát lại trước khi đổi vai trò (cùng cách trình bày với bảng soát lại việc giao cho Phó hiệu trưởng). */
export function StaffRoleReviewModal({ name, rows, saving, onConfirm, onClose }) {
  return (
    <Modal
      open
      size="lg"
      title={`Xem lại thay đổi vai trò của ${name}`}
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            {LABELS.back}
          </Button>
          <Button variant="primary" loading={saving} onClick={onConfirm}>
            Xác nhận đổi vai trò
          </Button>
        </>
      }
    >
      <DataTable className="table--compact" columns={COLUMNS} rows={rows} />
      <ul className="sc-role-impact">
        <li>Phân công đang hiệu lực kết thúc từ hôm nay.</li>
        <li>Quyền ngoại lệ đã cấp riêng cho tài khoản bị xóa.</li>
        <li>Số điện thoại đăng nhập và mật khẩu giữ nguyên.</li>
      </ul>
    </Modal>
  );
}
