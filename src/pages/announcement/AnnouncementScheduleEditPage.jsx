import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorState, LoadingState, PageHeader, PageToolbar } from '@/components';
import { ArrowLeft } from '@/components/ui/icons';
import AnnouncementForm from '@/components/announcement/AnnouncementForm';
import { AnnouncementAlert } from '@/components/announcement/announcementUi';
import { announcements } from '@/services/announcement/announcementService';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';

export default function AnnouncementScheduleEditPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => announcements.schedule(id, user), [id, user], { enabled: !!id });
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [fields, setFields] = useState({});
  const save = async (value, files) => {
    setBusy(true);
    setSaveError('');
    setFields({});
    try {
      if (id) await announcements.updateSchedule(id, value, files, user);
      else await announcements.createSchedule(value, files, user);
      toast?.success('Đã lưu.');
      navigate('/announcement-schedules');
    } catch (e) {
      setSaveError(e.status === 0 ? 'Chưa xác định lưu thành công. Hãy kiểm tra danh sách trước khi thử lại.' : e.message);
      setFields(e.details && typeof e.details === 'object' ? e.details : {});
    } finally {
      setBusy(false);
    }
  };
  const showForm = !error && (!id || !!data);
  return (
    <div className="page page--toolbar announcement-page">
      <PageHeader
        title={id ? 'Sửa lịch gửi thông báo' : 'Tạo lịch gửi thông báo'}
        crumbs={[
          { label: 'Trang chủ', to: '/' },
          { label: 'Lịch gửi thông báo', to: '/announcement-schedules' },
          { label: id ? 'Sửa lịch gửi' : 'Tạo lịch gửi' },
        ]}
      />
      {!showForm && (
        <PageToolbar
          leading={
            <Link className="btn btn--sm btn--outline-primary" to="/announcement-schedules">
              <ArrowLeft size={15} aria-hidden="true" /> Quay lại
            </Link>
          }
        />
      )}
      <AnnouncementAlert>{saveError}</AnnouncementAlert>
      {error ? (
        <div className="card">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : id && loading && !data ? (
        <div className="card">
          <LoadingState />
        </div>
      ) : (
        showForm && <AnnouncementForm key={id || 'new'} recurring initial={data} onSave={save} busy={busy} serverErrors={fields} />
      )}
    </div>
  );
}
