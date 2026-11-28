import { Mail, Pencil, Phone } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { ROLE_INFO } from '@/components/school-config/StaffAccountFormParts';
import { StaffStatusBadge } from '@/components/school-config/SchoolConfigBadges';
import { ROLE_LABELS } from '@/models/User';

/** Một kênh liên hệ: có giá trị thì bấm được (gọi / gửi thư), trống thì ghi "Chưa có". */
function ContactRow({ icon: Icon, label, value, scheme }) {
  const body = (
    <>
      <span className="sc-form-section__icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <span className="sc-contact__text">
        <span className="sc-contact__label">{label}</span>
        <span className="sc-contact__value">{value || 'Chưa có'}</span>
      </span>
    </>
  );
  return value ? (
    <a className="sc-contact" href={`${scheme}:${value}`}>
      {body}
    </a>
  ) : (
    <div className="sc-contact sc-contact--empty">{body}</div>
  );
}

/** Xem nhanh tài khoản nhân sự (chỉ đọc): bấm dòng trong danh sách để mở; `onEdit` có thì hiện nút Sửa. */
export function StaffAccountDetailModal({ account, onClose, onEdit }) {
  const RoleIcon = ROLE_INFO[account.role]?.icon;
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
        <div className="sc-profile-hero">
          <Avatar user={account} size="xl" />
          <div className="sc-profile-hero__text">
            <h3 className="sc-profile-hero__name">{account.fullName}</h3>
            <div className="sc-profile-hero__tags">
              <span className="chip chip--blue">
                {RoleIcon && <RoleIcon size={14} aria-hidden="true" />}
                {ROLE_LABELS[account.role] || 'Chưa có vai trò'}
              </span>
              <StaffStatusBadge status={account.status || 'ACTIVE'} />
            </div>
          </div>
        </div>
        <section>
          <h4 className="sc-profile-block__title">Công tác</h4>
          <dl className="info-list">
            <dt>Cơ sở công tác</dt>
            <dd>{account.campusNames.join(', ') || <span className="muted">Chưa có</span>}</dd>
            <dt>Đang phụ trách</dt>
            <dd>
              {account.duties.length ? (
                <ul className="sc-duty-list">
                  {account.duties.map((duty, i) => (
                    // BE có thể trả hai phân công cùng nhãn
                    <li key={`${duty}-${i}`} className="chip">
                      {duty}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="muted">Chưa được phân công</span>
              )}
            </dd>
          </dl>
        </section>
        <section>
          <h4 className="sc-profile-block__title">Liên hệ</h4>
          <div className="sc-contact-list">
            <ContactRow icon={Phone} label="Số điện thoại" value={account.phone} scheme="tel" />
            <ContactRow icon={Mail} label="Email" value={account.email} scheme="mailto" />
          </div>
        </section>
      </div>
    </Modal>
  );
}
