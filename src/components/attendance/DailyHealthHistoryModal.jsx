import { Phone } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { symptomLabels } from '@/utils/dailyHealthValidation';
import { formatDate, formatDateTime } from '@/utils/format';
import '@/styles/modules/attendance.css';
import { TemperatureBadge } from '@/components/attendance/TemperatureBadge';

const NOTIFICATION_CHIPS = {
  PENDING: { tone: 'chip--orange', label: 'Chưa gửi được thông báo phụ huynh' },
  DEMO_QUEUED: { tone: 'chip--blue', label: 'Đã gửi thông báo phụ huynh' },
};

const timeOf = (iso) => formatDateTime(iso).split(' ')[1] || '—';

/** Một dòng trạng thái thông báo phụ huynh của lần có dấu hiệu gần nhất. */
function NotificationLine({ entries }) {
  const noted = entries.find((entry) => entry.observation === 'NOTED');
  if (!noted) return <p className="muted text-sm mb-8">Không có lần ghi nhận cần báo phụ huynh.</p>;
  const chip = NOTIFICATION_CHIPS[noted.notificationStatus] || NOTIFICATION_CHIPS.PENDING;
  const notice = noted.parentNotifications?.[0];
  return (
    <div className="dd-health__actions mb-8">
      <span className={`chip ${chip.tone}`}>
        {chip.label}
        {notice ? ` · ${formatDateTime(notice.createdAt)}` : ''}
      </span>
      {notice && (
        <span className="muted text-sm">tới {[...new Set(noted.parentNotifications.map((n) => n.recipientName))].join(', ')}</span>
      )}
    </div>
  );
}

/** Chi tiết chỉ xem: các lần ghi nhận sức khỏe trong ngày của một trẻ và trạng thái thông báo phụ huynh. */
export function DailyHealthHistoryModal({ open, child, date, history, loading, error, onRetry, onClose }) {
  return (
    <Modal
      open={open}
      title={`Sức khỏe trong ngày – ${child?.childName || ''}`}
      size="lg"
      onClose={onClose}
      footer={
        <button className="btn" type="button" onClick={onClose}>
          Đóng
        </button>
      }
    >
      <p className="muted text-sm mb-12">
        {[child?.childCode, child?.className, formatDate(date)].filter(Boolean).join(' · ')}. Chỉ xem, giáo viên lớp ghi nhận ở màn Điểm
        danh &amp; sức khỏe.
      </p>
      {error ? (
        <ErrorState error={error} onRetry={error.status === 403 || error.status === 404 ? undefined : onRetry} />
      ) : loading || !history ? (
        <LoadingState />
      ) : (
        <div className="dd-health__contact mb-12" role="group" aria-label="Liên hệ phụ huynh">
          <strong>
            <Phone size={16} /> Liên hệ phụ huynh
          </strong>
          {!history.contacts?.length ? (
            <span className="muted text-sm">Chưa có thông tin phụ huynh trong hồ sơ nhập học.</span>
          ) : (
            history.contacts.map((contact, index) => (
              <div className="dd-health__contact-person" key={`${contact.fullName}:${index}`}>
                <span>
                  {contact.relation} · {contact.fullName || 'Chưa có thông tin'}
                </span>
                <span className="dd-health__phone">{contact.phone || 'Chưa có số'}</span>
              </div>
            ))
          )}
        </div>
      )}
      {error || loading || !history ? null : history.entries.length === 0 ? (
        <EmptyState title="Chưa có lần ghi nhận" description="Trẻ chưa được ghi nhận sức khỏe trong ngày đã chọn." />
      ) : (
        <>
          <NotificationLine entries={history.entries} />
          {/* Mỗi lần đo 1 dòng, mới nhất ở trên; 5–6 lần vẫn vừa một màn */}
          <div className="table-wrap dd-hist">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Giờ</th>
                  <th className="right">Thân nhiệt</th>
                  <th>Quan sát / biểu hiện</th>
                  <th>Ghi chú</th>
                  <th>Giáo viên</th>
                </tr>
              </thead>
              <tbody>
                {history.entries.map((entry, index) => (
                  <tr key={entry.id} className={index === 0 ? 'dd-hist__latest' : ''}>
                    <td className="nowrap">
                      {timeOf(entry.recordedAt)}
                      {index === 0 && history.entries.length > 1 && <span className="chip chip--blue dd-hist__tag">Mới nhất</span>}
                    </td>
                    <td className="right nowrap">
                      <TemperatureBadge value={entry.temperature} />
                    </td>
                    <td>
                      {entry.observation === 'NOTED' ? 'Có dấu hiệu' : 'Bình thường'}
                      {entry.symptoms?.length ? <div className="muted text-xs">{symptomLabels(entry.symptoms)}</div> : null}
                    </td>
                    <td className="dd-hist__note">{entry.note || '—'}</td>
                    <td className="nowrap">{entry.recordedByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
