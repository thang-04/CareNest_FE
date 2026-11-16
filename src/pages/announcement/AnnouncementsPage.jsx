import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DataTable, Pagination } from '@/components';
import { Plus, FileText } from '@/components/ui/icons';
import { AnnouncementHeader, AnnouncementStatusBadge, scopeLabels } from '@/components/announcement/announcementUi';
import { announcements } from '@/services/announcement/announcementService';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { formatDateTime } from '@/utils/format';

export default function AnnouncementsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => announcements.list({ page: page - 1, size: 20 }, user), [page, user]);
  return (
    <div className="page page--toolbar announcement-page">
      <AnnouncementHeader
        title="Thông báo nhà trường"
        summary={data ? `${data.totalElements} thông báo` : 'Thông báo đã tạo'}
        actions={
          <>
            <Link className="btn btn--sm btn--outline-primary" to="/announcement-templates">
              <FileText size={15} aria-hidden="true" /> Mẫu thông báo
            </Link>
            <Link className="btn btn--sm btn--outline-primary" to="/announcements/new">
              <Plus size={15} aria-hidden="true" /> Soạn thông báo
            </Link>
          </>
        }
      />
      <section className="card">
        <DataTable
          loading={loading}
          error={error}
          onRetry={reload}
          rows={data?.items}
          empty={{ title: 'Chưa có thông báo nhà trường', description: 'Soạn thông báo và chọn người nhận để bắt đầu.' }}
          columns={[
            { key: 'index', header: 'STT', className: 'center', render: (item) => (page - 1) * 20 + data.items.indexOf(item) + 1 },
            { key: 'title', header: 'Tiêu đề', render: (item) => <span className="fw-600">{item.title}</span> },
            { key: 'scope', header: 'Phạm vi', render: (item) => scopeLabels[item.target?.scopeType] || '—' },
            { key: 'senderName', header: 'Người gửi' },
            { key: 'sendAt', header: 'Thời gian gửi', render: (item) => formatDateTime(item.sentAt || item.sendAt) },
            { key: 'recipientCount', header: 'Số người nhận', className: 'center' },
            {
              key: 'status',
              header: 'Trạng thái',
              className: 'center',
              render: (item) => <AnnouncementStatusBadge status={item.status} />,
            },
          ]}
          onRowClick={(item) => navigate(`/announcements/${item.id}`)}
        />
        {data && !error && <Pagination page={page} pageSize={data.size} total={data.totalElements} onChange={setPage} unit="thông báo" />}
      </section>
    </div>
  );
}
