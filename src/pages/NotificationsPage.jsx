import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, EmptyState, ErrorState, LoadingState, PageHeader, PageToolbar, StatusBadge } from '@/components';
import { Bell, CheckCheck } from '@/components/ui/icons';
import { AnnouncementAlert } from '@/components/announcement/announcementUi';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDateTime } from '@/utils/format';
import { notificationTypeLabel } from '@/utils/notificationLabel.mjs';
import { notificationTarget } from '@/utils/notifications/notificationTarget.mjs';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, error, reload, markRead, markAllRead } = useNotifications();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const open = async (event, notification) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setActionError('');
    try {
      if (!notification.read) await markRead(notification.id);
      navigate(notificationTarget(notification));
    } catch (e) {
      setActionError(e.message);
    }
  };
  const readAll = async () => {
    setBusy(true);
    setActionError('');
    try {
      await markAllRead();
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page page--toolbar announcement-page">
      <PageHeader title="Thông báo" crumbs={[{ label: 'Trang chủ', to: '/' }, { label: 'Thông báo' }]} />
      <PageToolbar
        aria-label="Thao tác thông báo của tôi"
        summary={
          <span className="text-sm muted" role="status">
            {loading && !notifications.length
              ? 'Đang tải thông báo…'
              : error && !notifications.length
                ? 'Thông báo của bạn'
                : unreadCount
                  ? `${unreadCount} thông báo chưa đọc`
                  : 'Bạn đã đọc tất cả thông báo'}
          </span>
        }
      >
        <Button variant="outline-primary" size="sm" icon={CheckCheck} loading={busy} disabled={!unreadCount} onClick={readAll}>
          Đánh dấu tất cả đã đọc
        </Button>
      </PageToolbar>
      <AnnouncementAlert>{actionError}</AnnouncementAlert>
      <section className="card">
        {error && !notifications.length ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading && !notifications.length ? (
          <LoadingState />
        ) : notifications.length === 0 ? (
          <EmptyState
            title="Chưa có thông báo"
            description="Thông báo về phê duyệt, phân công và thay đổi liên quan đến bạn sẽ hiện ở đây."
          />
        ) : (
          <div>
            {notifications.map((notification) => (
              <Link
                key={notification.id}
                to={notificationTarget(notification)}
                className={`announcement-inbox-item${notification.read ? '' : ' announcement-inbox-item--unread'}`}
                onClick={(event) => open(event, notification)}
              >
                <span className="announcement-notification">
                  <span className="announcement-notification__icon">
                    <Bell size={20} aria-hidden="true" />
                  </span>
                  <span className="announcement-notification__content">
                    <span className="announcement-inbox-item__heading">
                      <strong>{notification.title}</strong>
                      <StatusBadge tone="gray" label={notificationTypeLabel(notification.type, notification.typeLabel)} />
                      {!notification.read && <span className="announcement-inbox-item__unread-dot" role="img" aria-label="Chưa đọc" />}
                    </span>
                    <span className="announcement-inbox-item__message">{notification.message}</span>
                    <span className="announcement-inbox-item__time">{formatDateTime(notification.createdAt)}</span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
