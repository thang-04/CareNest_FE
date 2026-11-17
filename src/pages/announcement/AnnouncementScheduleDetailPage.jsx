import { Link, useParams } from 'react-router-dom';
import { ErrorState, LoadingState, PageHeader, PageToolbar, StatusBadge } from '@/components';
import { ArrowLeft, Pencil } from '@/components/ui/icons';
import { AnnouncementSection, recipientRoleLabels, scheduleRepeatLabel, scopeLabels } from '@/components/announcement/announcementUi';
import AnnouncementAttachments from '@/components/announcement/AnnouncementAttachments';
import { announcements } from '@/services/announcement/announcementService';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { formatDateTime } from '@/utils/format';

export default function AnnouncementScheduleDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => announcements.schedule(id, user), [id, user]);
  return (
    <div className="page page--toolbar announcement-page">
      <PageHeader
        title="Chi tiết lịch gửi"
        crumbs={[
          { label: 'Trang chủ', to: '/' },
          { label: 'Lịch gửi thông báo', to: '/announcement-schedules' },
          { label: 'Chi tiết lịch gửi' },
        ]}
      />
      <PageToolbar
        aria-label="Thao tác chi tiết lịch gửi"
        leading={
          <Link className="btn btn--sm btn--outline-primary" to="/announcement-schedules">
            <ArrowLeft size={15} aria-hidden="true" /> Quay lại
          </Link>
        }
      >
        {data && (
          <Link className="btn btn--sm btn--outline-primary" to={`/announcement-schedules/${id}/edit`}>
            <Pencil size={15} aria-hidden="true" /> Sửa lịch gửi
          </Link>
        )}
      </PageToolbar>
      {error ? (
        <div className="card">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : loading && !data ? (
        <div className="card">
          <LoadingState />
        </div>
      ) : (
        data && (
          <>
            <AnnouncementSection title="Lịch gửi">
              <dl className="announcement-meta">
                <div>
                  <dt>Trạng thái</dt>
                  <dd>
                    <StatusBadge tone={data.active ? 'green' : 'gray'} label={data.active ? 'Đang bật' : 'Đã tắt'} />
                  </dd>
                </div>
                <div>
                  <dt>Lặp lại</dt>
                  <dd>{scheduleRepeatLabel(data)}</dd>
                </div>
                <div>
                  <dt>Giờ gửi</dt>
                  <dd>{data.sendTime?.slice(0, 5) || '—'}</dd>
                </div>
                <div>
                  <dt>Lần gửi tiếp theo</dt>
                  <dd>{data.active ? formatDateTime(data.nextRunAt) : '—'}</dd>
                </div>
                <div>
                  <dt>Phạm vi</dt>
                  <dd>{scopeLabels[data.target?.scopeType] || '—'}</dd>
                </div>
                <div>
                  <dt>Vai trò nhận</dt>
                  <dd>{(data.target?.roles || []).map((role) => recipientRoleLabels[role] || role).join(', ') || '—'}</dd>
                </div>
                <div>
                  <dt>Mẫu đã dùng</dt>
                  <dd>{data.templateName || 'Soạn riêng'}</dd>
                </div>
              </dl>
            </AnnouncementSection>
            <AnnouncementSection title="Nội dung thông báo">
              <h2 className="announcement-document__title">{data.title}</h2>
              <div className="announcement-body">{data.body}</div>
            </AnnouncementSection>
            <AnnouncementSection title="Tệp đính kèm">
              <AnnouncementAttachments existing={data.attachments || []} readOnly />
            </AnnouncementSection>
          </>
        )
      )}
    </div>
  );
}
