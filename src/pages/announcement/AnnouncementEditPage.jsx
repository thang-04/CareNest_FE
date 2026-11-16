import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AnnouncementForm from '@/components/announcement/AnnouncementForm';
import { announcements } from '@/services/announcement/announcementService';
import { useAuth } from '@/contexts/AuthContext';

export default function AnnouncementEditPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(null);
  useEffect(() => {
    if (!id) return undefined;
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
    <div className="page">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Soạn hoặc sửa thông báo' }]} />
      <Link to="/announcements">← Danh sách</Link>
      <h1 className="page__title">{id ? 'Sửa thông báo' : 'Soạn thông báo'}</h1>
      {error && <p role="alert">{error}</p>}
      {current && <p>Trạng thái hiện tại trên máy chủ: {current.status}. Nội dung bạn đang nhập được giữ lại để đối chiếu.</p>}
      {(!id || data?.canEdit) && <AnnouncementForm initial={data} onSave={save} busy={busy} serverErrors={fieldErrors} />}
      {id && data && !data.canEdit && <p>Thông báo không còn cho phép sửa.</p>}
    </div>
  );
}
