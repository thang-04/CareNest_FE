import { Pencil } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { StaffIdentityCard } from '@/components/school-config/StaffAccountFormParts';
import { StaffStatusBadge } from '@/components/school-config/SchoolConfigBadges';
import { ROLE_LABELS } from '@/models/User';

const none = <span className="muted">—</span>;

/** Xem nhanh tài khoản nhân sự (chỉ đọc): bấm dòng trong danh sách để mở; `onEdit` có thì hiện nút Sửa. */
export function StaffAccountDetailModal({ account, onClose, onEdit }) {
  return (
    <Modal
      open
      className="sc-account-modal"
      title="Chi tiết nhân sự"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Đóng</Button>
          {onEdit && (
            <Button variant="primary" icon={Pencil} onClick={onEdit}>
              Sửa thông tin
            </Button>
          )}
        </>
      }
    >
      <div className="sc-account-form">
        <StaffIdentityCard account={account} />
        <dl className="info-list">
          <dt>Vai trò</dt>
          <dd>{ROLE_LABELS[account.role] || none}</dd>
          <dt>Điểm trường</dt>
          <dd>{account.campusNames.join(', ') || none}</dd>
          <dt>Đang phụ trách</dt>
          <dd>{account.duties.join(' · ') || none}</dd>
          <dt>Số điện thoại</dt>
          <dd>{account.phone || none}</dd>
          <dt>Email</dt>
          <dd>{account.email || none}</dd>
          <dt>Trạng thái</dt>
          <dd>
            <StaffStatusBadge status={account.status || 'ACTIVE'} />
          </dd>
        </dl>
      </div>
    </Modal>
  );
}
