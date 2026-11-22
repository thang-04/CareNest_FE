import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, ConfirmationModal, ErrorState, LoadingState } from '@/components';
import { ArrowLeft, Pencil, CalendarX, Trash2 } from '@/components/ui/icons';
import {
  AnnouncementAlert,
  AnnouncementHeader,
  AnnouncementSection,
  AnnouncementStatusBadge,
  scopeLabels,
  recipientRoleLabels,
} from '@/components/announcement/announcementUi';
import AnnouncementAttachments from '@/components/announcement/AnnouncementAttachments';
import { announcements } from '@/services/announcement/announcementService';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { formatDateTime } from '@/utils/format';

export default function AnnouncementDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, setData, loading, error, reload } = useAsync(() => announcements.detail(id, user), [id, user]);
  const [confirm, setConfirm] = useState(false);
  const [actionError, setActionError] = useState('');
  const cancel = async () => {
    setActionError('');
    try {
      if (confirm === 'delete') {
        await announcements.delete(id, user);
        navigate('/announcements', { replace: true });
      } else setData(await announcements.cancel(id, user));
      setConfirm(false);
    } catch (e) {
      setActionError(e.message);
      if (e.status === 409) await reload({ silent: true });
    }
  };
  return (
    <div className="page page--toolbar announcement-page">
      <AnnouncementHeader
        title="Chi tiết thông báo"
        detail
        back={
          <Link className="btn btn--sm btn--outline-primary" to="/announcements">
            <ArrowLeft size={15} aria-hidden="true" /> Quay lại
          </Link>
        }
        actions={
          <>
            {data?.canDelete && (
              <Button
                variant="outline-danger"
                size="sm"
                icon={Trash2}
                onClick={() => {
                  setActionError('');
                  setConfirm('delete');
                }}
              >
                Xóa thông báo đã hủy
              </Button>
            )}
            {data?.canEdit && (
              <>
                <Button
                  variant="outline-danger"
                  size="sm"
                  icon={CalendarX}
                  onClick={() => {
                    setActionError('');
                    setConfirm('cancel');
                  }}
                >
                  Hủy lịch gửi
                </Button>
                <Link className="btn btn--sm btn--outline-primary" to={`/announcements/${id}/edit`}>
                  <Pencil size={15} aria-hidden="true" /> Sửa thông báo
                </Link>
              </>
            )}
          </>
        }
      />
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
            <AnnouncementSection title="Thông tin gửi">
              <dl className="announcement-meta">
                <div>
                  <dt>Trạng thái</dt>
                  <dd>
                    <AnnouncementStatusBadge status={data.status} />
                  </dd>
                </div>
                <div>
                  <dt>Người gửi</dt>
                  <dd>{data.senderName || '—'}</dd>
                </div>
                <div>
                  <dt>Thời gian gửi</dt>
                  <dd>{formatDateTime(data.sentAt || data.sendAt)}</dd>
                </div>
                <div>
                  <dt>Số người nhận</dt>
                  <dd>{data.recipientCount ?? '—'}</dd>
                </div>
                <div>
                  <dt>Phạm vi</dt>
                  <dd>{scopeLabels[data.target?.scopeType] || '—'}</dd>
                </div>
                <div>
                  <dt>Vai trò nhận</dt>
                  <dd>{(data.target?.roles || []).map((role) => recipientRoleLabels[role] || role).join(', ') || '—'}</dd>
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
      {!confirm && <AnnouncementAlert>{actionError}</AnnouncementAlert>}
      <ConfirmationModal
        open={!!confirm}
        title={confirm === 'delete' ? 'Xóa thông báo đã hủy?' : 'Hủy lịch gửi thông báo?'}
        message={
          confirm === 'delete'
            ? 'Thông báo và tệp đính kèm sẽ bị xóa. Không thể hoàn tác.'
            : 'Thông báo này sẽ không được gửi theo lịch đã hẹn.'
        }
        confirmLabel={confirm === 'delete' ? 'Xóa thông báo' : 'Hủy lịch gửi'}
        danger
        onConfirm={cancel}
        onClose={() => setConfirm(false)}
        error={actionError}
      />
    </div>
  );
}
