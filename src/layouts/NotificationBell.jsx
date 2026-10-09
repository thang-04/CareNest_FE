import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Checks } from '@/components/ui/icons';
import { useNotifications } from '@/hooks/useNotifications';
import { useClickOutside } from '@/hooks/useClickOutside';
import { timeAgo } from '@/utils/format';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  const openNotification = async (n) => {
    setOpen(false);
    if (!n.read) await markRead(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-btn header__bell" onClick={() => setOpen((v) => !v)} aria-label={`Thông báo (${unreadCount} chưa đọc)`}>
        <Bell size={22} />
        {unreadCount > 0 && <span className="badge-dot">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {open && (
        <div className="dropdown__panel notif-panel">
          <div className="notif-panel__head">
            <span className="fw-600">Thông báo</span>
            <button className="link-btn row" style={{ gap: 4 }} onClick={markAllRead} disabled={!unreadCount}>
              <Checks size={15} /> Đánh dấu đã đọc
            </button>
          </div>
          <div className="notif-panel__list">
            {notifications.length === 0 && (
              <div className="state" style={{ padding: 28 }}>
                Chưa có thông báo nào
              </div>
            )}
            {notifications.slice(0, 12).map((n) => (
              <button key={n.id} className={`notif-item ${n.read ? '' : 'notif-item--unread'}`} onClick={() => openNotification(n)}>
                <div className="notif-item__title">{n.title}</div>
                <div className="notif-item__msg">{n.message}</div>
                <div className="notif-item__time">{timeAgo(n.createdAt)}</div>
              </button>
            ))}
          </div>
          <button
            className="notif-panel__all"
            onClick={() => {
              setOpen(false);
              navigate('/notifications');
            }}
          >
            Xem tất cả thông báo
          </button>
        </div>
      )}
    </div>
  );
}
