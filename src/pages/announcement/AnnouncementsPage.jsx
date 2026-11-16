import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Pagination } from '@/components/ui/Pagination';
import { DataTable } from '@/components/ui/DataTable';
import { announcements } from '@/services/announcement/announcementService';
import { useAuth } from '@/contexts/AuthContext';

export default function AnnouncementsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setError('');
    announcements
      .list({ page: page - 1, size: 20 }, user)
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [page, user]);
  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Thông báo nhà trường' }]} />
      <h1 className="page__title">Thông báo nhà trường</h1>
      <div className="row gap-2">
        <Link className="btn btn--primary" to="/announcements/new">
          Soạn thông báo
        </Link>
        <Link className="btn" to="/announcement-templates">
          Mẫu thông báo
        </Link>
      </div>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p>Đang tải…</p>}
      {data && (
        <div className="card card__body">
          {data.items.length === 0 ? (
            <p>Chưa có thông báo.</p>
          ) : (
            <DataTable
              columns={[
                { key: 'title', header: 'Tiêu đề' },
                { key: 'senderName', header: 'Người gửi' },
                { key: 'status', header: 'Trạng thái' },
                { key: 'recipientCount', header: 'Người nhận' },
              ]}
              rows={data.items}
              onRowClick={(item) => navigate(`/announcements/${item.id}`)}
            />
          )}
          <Pagination page={page} pageSize={data.size} total={data.totalElements} onChange={setPage} unit="thông báo" />
        </div>
      )}
    </div>
  );
}
