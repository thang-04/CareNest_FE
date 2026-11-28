import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, ErrorState, LoadingState, PageHeader, PageToolbar, RichBody, StatusBadge } from '@/components';
import { ArrowLeft, Download, ExternalLink } from '@/components/ui/icons';
import { StatusPage } from '@/components/ui/StatusPage';
import { useNotificationDetail } from '@/hooks/account/useAccount';
import { acCrumbs } from '@/utils/account/breadcrumbs';
import { notificationGroupLabel } from '@/models/account/accountConstants';
import { formatDateTime } from '@/utils/format';
import { getAnnouncementAttachment } from '@/services/notificationService';
import '@/styles/modules/account.css';

export default function NotificationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: notification, loading, error, reload } = useNotificationDetail(id);
  const [attachmentError, setAttachmentError] = useState('');
  const [downloading, setDownloading] = useState(null);
  const download = async (attachment) => {
    setAttachmentError('');
    setDownloading(attachment.id);
    try {
      const blob = await getAnnouncementAttachment(attachment.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = attachment.fileName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setAttachmentError(e.message || 'Không thể tải tệp đính kèm.');
    } finally {
      setDownloading(null);
    }
  };
  const back = (
    <Link to="/notifications" className="btn btn--sm btn--outline-primary">
      <ArrowLeft size={15} aria-hidden="true" /> Quay lại
    </Link>
  );
  let content;
  if (loading && !notification)
    content = (
      <div className="card">
        <LoadingState />
      </div>
    );
  else if (error?.status === 403 || error?.status === 404)
    content = (
      <div className="card">
        <StatusPage
          bare
          kind={String(error.status)}
          title={error.status === 403 ? 'Bạn không có quyền xem thông báo này' : 'Không tìm thấy thông báo'}
          description={error.message}
          action={null}
        />
      </div>
    );
  else if (error)
    content = (
      <div className="card">
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  else if (notification)
    content = (
      <>
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">Thông tin thông báo</h2>
          </div>
          <div className="card__body row gap-4">
            <StatusBadge tone="gray" label={notificationGroupLabel(notification.type, notification.typeLabel)} />
            <span className="muted text-sm">{formatDateTime(notification.createdAt)}</span>
            {notification.senderName && <span className="text-sm">Người gửi: {notification.senderName}</span>}
          </div>
        </section>
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">Nội dung thông báo</h2>
          </div>
          <div className="card__body">
            <h2 className="ac-notif__title">{notification.title}</h2>
            {notification.bodyHtml ? (
              <div className="ac-notif__message">
                <RichBody html={notification.bodyHtml} text={notification.message} />
              </div>
            ) : (
              <div className="ac-notif__message">{notification.message}</div>
            )}
          </div>
        </section>
        {notification.attachments?.length > 0 && (
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Tệp đính kèm</h2>
            </div>
            <div className="card__body stack gap-3">
              {notification.attachments.map((attachment) => (
                <div className="row gap-3" key={attachment.id}>
                  <span className="ac-notif__file-name">{attachment.fileName}</span>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    icon={Download}
                    disabled={downloading !== null}
                    loading={downloading === attachment.id}
                    onClick={() => download(attachment)}
                    aria-label={`Tải ${attachment.fileName}`}
                  >
                    Tải tệp
                  </Button>
                </div>
              ))}
              {attachmentError && (
                <div className="alert alert--danger" role="alert">
                  {attachmentError}
                </div>
              )}
            </div>
          </section>
        )}
      </>
    );
  return (
    <div className="page page--toolbar stack gap-4">
      <PageHeader title="Chi tiết thông báo" crumbs={acCrumbs({ label: 'Thông báo', to: '/notifications' }, 'Chi tiết thông báo')} />
      <PageToolbar leading={back} aria-label="Thao tác chi tiết thông báo">
        {notification?.link && !error && (
          <Button size="sm" variant="outline-primary" icon={ExternalLink} onClick={() => navigate(notification.link)}>
            Xem chi tiết
          </Button>
        )}
      </PageToolbar>
      {content}
    </div>
  );
}
