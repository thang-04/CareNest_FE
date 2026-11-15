import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from '@/components/ui/icons';
import { Breadcrumb, ErrorState, LoadingState } from '@/components';
import { StatusPage } from '@/components/ui/StatusPage';
import { useNotificationDetail } from '@/hooks/account/useAccount';
import { acCrumbs } from '@/utils/account/breadcrumbs';
import { notificationGroupLabel } from '@/models/account/accountConstants';
import { formatDateTime, timeAgo } from '@/utils/format';
import { getAnnouncementAttachment } from '@/services/notificationService';
import '@/styles/modules/account.css';

/** Screen 9 – Notification Detail (SRS 1.4 steps 7–8): content plus a link to the record; the record page checks access again. */
export default function NotificationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: n, loading, error, reload } = useNotificationDetail(id);
  const [attachmentError, setAttachmentError] = useState('');
  const openAttachment = async (attachment) => {
    setAttachmentError('');
    try {
      const blob = await getAnnouncementAttachment(attachment.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = attachment.fileName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (ex) {
      setAttachmentError(ex.message || 'Không thể tải tệp đính kèm');
    }
  };
  const crumbs = acCrumbs({ label: 'Thông báo', to: '/notifications' }, 'Chi tiết thông báo');

  const back = (
    <Link to="/notifications" className="btn">
      <ArrowLeft size={16} /> Quay lại danh sách
    </Link>
  );

  let body;
  if (loading && !n) body = <LoadingState />;
  else if (error?.status === 403 || error?.status === 404) {
    body = (
      <StatusPage
        bare
        kind={String(error.status)}
        title={error.status === 403 ? 'Bạn không có quyền xem thông báo này' : 'Không tìm thấy thông báo'}
        description={error.message}
        action={back}
      />
    );
  } else if (error) body = <ErrorState error={error} onRetry={reload} />;
  else if (n) {
    body = (
      <>
        <div className="card__body ac-notif">
          <div className="row ac-notif__meta">
            <span className="chip chip--blue">{notificationGroupLabel(n.type)}</span>
            <span className="muted text-sm" title={formatDateTime(n.createdAt)}>
              {formatDateTime(n.createdAt)} · {timeAgo(n.createdAt)}
            </span>
          </div>
          <h2 className="ac-notif__title">{n.title}</h2>
          {n.senderName && <p className="muted">Người gửi: {n.senderName}</p>}
          <p className="ac-notif__message">{n.message}</p>
          {n.attachments?.length > 0 && (
            <div>
              <h3>Tệp đính kèm</h3>
              {n.attachments.map((attachment) => (
                <button key={attachment.id} type="button" className="btn" onClick={() => openAttachment(attachment)}>
                  {attachment.fileName}
                </button>
              ))}
              {attachmentError && <p role="alert">{attachmentError}</p>}
            </div>
          )}
        </div>
        <div className="card__body page-actions ac-actions">
          {back}
          {n.link ? (
            <button type="button" className="btn btn--primary" onClick={() => navigate(n.link)}>
              <ExternalLink size={16} /> Mở nội dung liên quan
            </button>
          ) : (
            <span className="muted text-sm">Thông báo này không gắn với hồ sơ nào.</span>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <h1 className="page__title">Chi tiết thông báo</h1>
      <div className="card ac-narrow ac-narrow--wide">{body}</div>
    </div>
  );
}
