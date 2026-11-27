import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from '@/components/ui/icons';
import { EmptyState, ErrorState, LoadingState } from '@/components';
import { AnnouncementAlert, AnnouncementHeader, announcementStatusLabels } from '@/components/announcement/announcementUi';
import AnnouncementForm from '@/components/announcement/AnnouncementForm';
import { announcements } from '@/services/announcement/announcementService';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';

export default function AnnouncementEditPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error: loadError, reload } = useAsync(() => announcements.detail(id, user), [id, user], { enabled: !!id });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(null);
  const save = async (value, files) => {
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      const saved = id ? await announcements.update(id, value, files, user) : await announcements.create(value, files, user);
      navigate(`/announcements/${saved.id}`);
    } catch (e) {
      setFieldErrors(e.details && typeof e.details === 'object' ? e.details : {});
      setError(e.status === 0 ? 'Chưa xác định gửi thành công. Kiểm tra danh sách trước khi gửi lại.' : e.message);
      if (id && e.status === 409) {
        try {
          setCurrent(await announcements.detail(id, user));
        } catch {
          /* Giữ nội dung đang nhập. */
        }
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page page--toolbar announcement-page">
      <AnnouncementHeader
        title={id ? 'Sửa thông báo' : 'Soạn thông báo'}
        detail
        back={
          (loadError || (id && !data?.canEdit)) && (
            <Link className="btn btn--sm" to="/announcements">
              <ArrowLeft size={15} aria-hidden="true" /> Quay lại
            </Link>
          )
        }
      />
      <AnnouncementAlert>{error}</AnnouncementAlert>
      {current && (
        <AnnouncementAlert info>
          Trạng thái hiện tại: {announcementStatusLabels[current.status] || current.status}. Nội dung đang nhập được giữ lại để đối chiếu.
        </AnnouncementAlert>
      )}
      {loadError ? (
        <div className="card">
          <ErrorState error={loadError} onRetry={reload} />
        </div>
      ) : id && loading && !data ? (
        <div className="card">
          <LoadingState />
        </div>
      ) : id && data && !data.canEdit ? (
        <div className="card">
          <EmptyState
            title="Thông báo không còn cho phép sửa"
            description="Chỉ có thể sửa thông báo còn hẹn gửi. Hãy quay lại danh sách để xem trạng thái mới nhất."
          />
        </div>
      ) : (
        (!id || data?.canEdit) && <AnnouncementForm key={id || 'new'} initial={data} onSave={save} busy={busy} serverErrors={fieldErrors} />
      )}
    </div>
  );
}
