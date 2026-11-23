import { recipientRoleLabels, scheduleRangeLabel, scheduleRepeatLabel, scopeLabels } from './announcementUi';
import { formatDateTime } from '@/utils/format';

const Row = ({ label, children }) => (
  <div className="announcement-summary__row">
    <dt>{label}</dt>
    <dd>{children}</dd>
  </div>
);

// Chỉ hiển thị lại điều người dùng đã nhập và số liệu BE trả (xem trước người nhận, lần gửi tiếp theo); không tự tính nghiệp vụ.
const whenLabel = ({ recurring, schedule, sendAt }) => {
  if (!recurring) return sendAt ? `Hẹn gửi lúc ${sendAt.replace('T', ' ')}` : 'Gửi ngay sau khi xác nhận';
  return `${scheduleRepeatLabel(schedule)} lúc ${schedule.sendTime || '--:--'}`;
};

/** Thẻ tóm tắt dính bên phải form soạn: nội dung chính, người nhận, thời gian gửi và nút Lưu. */
export default function AnnouncementSummary({ recurring, title, target, schedule, sendAt, preview, nextRunAt, action }) {
  const roles = (target.roles || []).map((role) => recipientRoleLabels[role] || role).join(', ');
  return (
    <aside className="card announcement-summary" aria-label="Tóm tắt thông báo">
      <div className="card__header">
        <h2 className="card__title">Tóm tắt</h2>
      </div>
      <div className="card__body">
        <dl className="announcement-summary__list">
          <Row label="Tiêu đề">{title.trim() || <span className="muted">Chưa nhập</span>}</Row>
          <Row label="Phạm vi">{scopeLabels[target.scopeType] || '—'}</Row>
          <Row label="Gửi cho">{roles || <span className="muted">Chưa chọn vai trò</span>}</Row>
          <Row label="Người nhận">
            {preview ? (
              <>
                <strong>{preview.total} người</strong>
                <span className="announcement-summary__note">
                  {Object.entries(preview.byRole || {})
                    .map(([role, count]) => `${recipientRoleLabels[role] || role}: ${count}`)
                    .join(' · ')}
                </span>
              </>
            ) : (
              <span className="muted">Chưa xem trước</span>
            )}
          </Row>
          <Row label={recurring ? 'Lặp lại' : 'Thời gian gửi'}>{whenLabel({ recurring, schedule, sendAt })}</Row>
          {recurring && scheduleRangeLabel(schedule) && <Row label="Khoảng ngày">{scheduleRangeLabel(schedule)}</Row>}
          {recurring && <Row label="Trạng thái lịch">{schedule.active ? 'Đang bật' : 'Đã tắt'}</Row>}
          {recurring && schedule.active && nextRunAt && <Row label="Lần gửi tiếp theo">{formatDateTime(nextRunAt)}</Row>}
        </dl>
        <div className="announcement-summary__action">{action}</div>
      </div>
    </aside>
  );
}
