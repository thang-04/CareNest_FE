import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from '@/components/ui/icons';
import { useNotifications } from '@/hooks/useNotifications';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { formatDateTime } from '@/utils/format';
import '@/styles/modules/account.css';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, error, reload, markAllRead } = useNotifications();

  // Screen 9: the detail page shows the content, marks it read and links to the related record.
  const open = (n) => navigate(`/notifications/${n.id}`);

  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Thông báo' }]} />
      <div className="page__head">
        <h1 className="page__title">Thông báo</h1>
        <button className="btn mt-8" onClick={markAllRead} disabled={!unreadCount}>
          <CheckCheck size={16} /> Đánh dấu tất cả đã đọc
        </button>
      </div>
      <div className="card ac-notif-list">
        {error && !notifications.length ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading && !notifications.length ? (
          <LoadingState />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Chưa có thông báo"
            description="Thông báo về phê duyệt, phân công và thay đổi liên quan đến bạn sẽ hiện ở đây."
          />
        ) : (
          notifications.map((n) => (
            <button key={n.id} type="button" className={`notif-item ${n.read ? '' : 'notif-item--unread'}`} onClick={() => open(n)}>
              <div className="notif-item__title">{n.title}</div>
              <div className="notif-item__msg">{n.message}</div>
              <div className="notif-item__time">{formatDateTime(n.createdAt)}</div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
