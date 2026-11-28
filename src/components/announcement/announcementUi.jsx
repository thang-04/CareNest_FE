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

// Nhãn nhịp lặp dùng chung cho danh sách, chi tiết và thẻ Tóm tắt (logic ở utils để test được).
export { scheduleRepeatLabel, scheduleRangeLabel } from '@/utils/announcement/scheduleRecurrence.mjs';

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

/** Một bước trong thẻ form dài: tiêu đề (đánh số khi có `step`), mô tả ngắn và phần nhập liệu. */
export function AnnouncementStep({ step, title, description, children }) {
  return (
    <section className="announcement-step">
      <h2 className="announcement-step__title">
        {step != null && (
          <span className="announcement-step__num" aria-hidden="true">
            {step}
          </span>
        )}
        {title}
      </h2>
      {description && <p className="announcement-section__description">{description}</p>}
      <div className="announcement-step__body">{children}</div>
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
