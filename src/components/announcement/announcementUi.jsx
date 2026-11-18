import { PageHeader, PageToolbar, createStatusBadge } from '@/components';
import { Check, Clock, Send, X } from '@/components/ui/icons';
import '@/styles/modules/announcement.css';

export const recipientRoleLabels = { PARENT: 'Phụ huynh', TEACHER: 'Giáo viên', KITCHEN: 'Nhân viên bếp', BGH: 'Ban giám hiệu' };
export const scopeLabels = { SCHOOL: 'Toàn trường', CAMPUS: 'Điểm trường', AGE_GROUP: 'Nhóm tuổi', CLASSROOM: 'Lớp' };
export const announcementStatusLabels = { SCHEDULED: 'Đã hẹn gửi', SENDING: 'Đang gửi', SENT: 'Đã gửi', CANCELLED: 'Đã hủy' };
export const AnnouncementStatusBadge = createStatusBadge(
  { SCHEDULED: ['orange', Clock], SENDING: ['blue', Send], SENT: ['green', Check], CANCELLED: ['gray', X] },
  announcementStatusLabels,
);

export const scheduleRepeatLabel = (item) =>
  item.frequency === 'WEEKLY'
    ? `${Number(item.dayOfWeek) === 7 ? 'Chủ nhật' : `Thứ ${Number(item.dayOfWeek) + 1}`} hằng tuần`
    : `Ngày ${item.dayOfMonth} hằng tháng`;

export function AnnouncementHeader({ title, actions, back, summary, detail = false }) {
  return (
    <>
      <PageHeader
        title={title}
        crumbs={[
          { label: 'Trang chủ', to: '/' },
          ...(detail ? [{ label: 'Thông báo nhà trường', to: '/announcements' }] : []),
          { label: title },
        ]}
      />
      {(actions || back || summary) && (
        <PageToolbar leading={back} summary={summary} aria-label={`Thao tác ${title.toLowerCase()}`}>
          {actions}
        </PageToolbar>
      )}
    </>
  );
}

export function AnnouncementSection({ title, description, children, actions }) {
  return (
    <section className="card">
      <div className="card__header">
        <div>
          <h2 className="card__title">{title}</h2>
          {description && <p className="announcement-section__description">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="card__body">{children}</div>
    </section>
  );
}

export function AnnouncementAlert({ children, info = false }) {
  if (!children) return null;
  return (
    <div className={`alert alert--${info ? 'info' : 'danger'}`} role={info ? 'status' : 'alert'}>
      {children}
    </div>
  );
}
