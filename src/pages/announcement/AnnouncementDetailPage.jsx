import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { announcements } from '@/services/announcement/announcementService';
import AnnouncementAttachments from '@/components/announcement/AnnouncementAttachments';
import { useAuth } from '@/contexts/AuthContext';

export default function AnnouncementDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    announcements
      .detail(id, user)
      .then((x) => {
        if (active) setData(x);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, user]);
  const cancel = async () => {
    if (!window.confirm('Hủy thông báo đã hẹn?')) return;
    try {
      setData(await announcements.cancel(id, user));
    } catch (e) {
      setError(e.message);
      if (e.status === 409) {
        try {
          setData(await announcements.detail(id, user));
        } catch {
          /* Giữ trạng thái đang hiển thị. */
        }
      }
    }
  };
  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Chi tiết thông báo' }]} />
      <Link to="/announcements">← Danh sách</Link>
      <h1 className="page__title">Chi tiết thông báo</h1>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Đang tải…</p>}
      {data && (
        <div className="card card__body">
          <h2>{data.title}</h2>
          <p>
            Người gửi: {data.senderName} · Mã: {data.senderId}
          </p>
          <p>
            Trạng thái: {data.status} · Người nhận: {data.recipientCount}
          </p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{data.body}</p>
          <AnnouncementAttachments existing={data.attachments || []} readOnly />
          {data.canEdit && (
            <div className="row gap-2">
              <Link className="btn" to={`/announcements/${id}/edit`}>
                Sửa
              </Link>
              <button className="btn" onClick={cancel}>
                Hủy lịch
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
