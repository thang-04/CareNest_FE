import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { announcements } from '@/services/announcement/announcementService';
import { useAuth } from '@/contexts/AuthContext';

const blank = { name: '', title: '', body: '', campusId: null };
export default function AnnouncementTemplatesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [form, setForm] = useState(blank);
  const [id, setId] = useState(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    try {
      const [list, sites] = await Promise.all([announcements.templates(user), announcements.campuses()]);
      setItems(list);
      setCampuses(sites);
    } catch (e) {
      setError(e.message);
    }
  }, [user]);
  useEffect(() => {
    reload();
  }, [reload]);
  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (id) await announcements.updateTemplate(id, form, user);
      else await announcements.createTemplate(form, user);
      setForm(blank);
      setId(null);
      await reload();
    } catch (ex) {
      setError(ex.message);
    }
  };
  const remove = async (item) => {
    if (!window.confirm(`Xóa mẫu “${item.name}”?`)) return;
    try {
      await announcements.deleteTemplate(item.id, user);
      await reload();
    } catch (e) {
      setError(e.errorCode === 1209 ? 'Mẫu đang được lịch sử dụng. Hãy kiểm tra lịch trước.' : e.message);
    }
  };
  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Mẫu thông báo' }]} />
      <Link to="/announcements">← Thông báo</Link>
      <h1 className="page__title">Mẫu thông báo</h1>
      {error && <p role="alert">{error}</p>}
      <div className="card card__body">
        {items.length === 0 && <p>Chưa có mẫu.</p>}
        {items.map((item) => (
          <div key={item.id}>
            <strong>{item.name}</strong> — {item.title}{' '}
            {item.canEdit && (
              <>
                <button
                  className="btn"
                  onClick={() => {
                    setId(item.id);
                    setForm({ name: item.name, title: item.title, body: item.body, campusId: item.campusId });
                  }}
                >
                  Sửa
                </button>
                <button className="btn" onClick={() => remove(item)}>
                  Xóa
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <form className="card card__body stack gap-4" onSubmit={save}>
        <h2>{id ? 'Sửa mẫu' : 'Tạo mẫu'}</h2>
        <label className="field">
          Tên mẫu{' '}
          <input
            className="input"
            required
            maxLength={100}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="field">
          Tiêu đề{' '}
          <input
            className="input"
            required
            maxLength={150}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <label className="field">
          Nội dung{' '}
          <textarea
            className="textarea"
            required
            maxLength={4000}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </label>
        <label className="field">
          Điểm trường{' '}
          <select
            className="select"
            required={user?.role === 'VICE_PRINCIPAL'}
            value={form.campusId ?? ''}
            onChange={(e) => setForm({ ...form, campusId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">{user?.role === 'VICE_PRINCIPAL' ? 'Chọn điểm trường' : 'Toàn trường'}</option>
            {campuses.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn--primary">Lưu mẫu</button>
        {id && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setId(null);
              setForm(blank);
            }}
          >
            Hủy sửa
          </button>
        )}
      </form>
    </div>
  );
}
