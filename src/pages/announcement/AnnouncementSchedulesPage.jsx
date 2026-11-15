import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { useCallback, useEffect, useState } from 'react';
import RecipientTargetForm, { emptyTarget } from '@/components/announcement/RecipientTargetForm';
import { announcements } from '@/services/announcement/announcementService';

const blank = () => ({
  templateId: '',
  target: emptyTarget,
  frequency: 'WEEKLY',
  dayOfWeek: 1,
  dayOfMonth: null,
  sendTime: '08:00',
  active: true,
});
export default function AnnouncementSchedulesPage() {
  const [items, setItems] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(blank);
  const [id, setId] = useState(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    try {
      const [list, tpl] = await Promise.all([announcements.schedules(), announcements.templates()]);
      setItems(list);
      setTemplates(tpl);
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  const payload = (item) => ({
    templateId: Number(item.templateId),
    target: item.target,
    frequency: item.frequency,
    dayOfWeek: item.frequency === 'WEEKLY' ? Number(item.dayOfWeek) : null,
    dayOfMonth: item.frequency === 'MONTHLY' ? Number(item.dayOfMonth) : null,
    sendTime: item.sendTime,
    active: item.active,
  });
  const save = async (e) => {
    e.preventDefault();
    try {
      if (id) await announcements.updateSchedule(id, payload(form));
      else await announcements.createSchedule(payload(form));
      setForm(blank());
      setId(null);
      setError('');
      await reload();
    } catch (ex) {
      setError(ex.message);
    }
  };
  const toggle = async (item) => {
    try {
      await announcements.updateSchedule(item.id, payload({ ...item, active: !item.active }));
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };
  const remove = async (item) => {
    if (!window.confirm('Xóa lịch này?')) return;
    try {
      await announcements.deleteSchedule(item.id);
      await reload();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Lịch thông báo' }]} />
      <h1 className="page__title">Lịch thông báo</h1>
      {error && <p role="alert">{error}</p>}
      <div className="card card__body">
        {items.length === 0 && <p>Chưa có lịch.</p>}
        {items.map((item) => (
          <div key={item.id}>
            <strong>{item.templateName}</strong> · {item.active ? 'Đang bật' : 'Đã tắt'} · Lần gửi tiếp: {item.nextRunAt || '—'}{' '}
            <button
              className="btn"
              onClick={() => {
                setId(item.id);
                setForm(payload(item));
              }}
            >
              Sửa
            </button>
            <button className="btn" onClick={() => toggle(item)}>
              {item.active ? 'Tắt' : 'Bật'}
            </button>
            <button className="btn" onClick={() => remove(item)}>
              Xóa
            </button>
          </div>
        ))}
      </div>
      <form className="card card__body stack gap-4" onSubmit={save}>
        <h2>{id ? 'Sửa lịch' : 'Tạo lịch'}</h2>
        <label className="field">
          Mẫu{' '}
          <select className="select" required value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}>
            <option value="">Chọn mẫu</option>
            {templates.map((t) => (
              <option value={t.id} key={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <RecipientTargetForm value={form.target} onChange={(target) => setForm({ ...form, target })} />
        <label className="field">
          Tần suất{' '}
          <select className="select" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
            <option value="WEEKLY">Hàng tuần</option>
            <option value="MONTHLY">Hàng tháng</option>
          </select>
        </label>
        {form.frequency === 'WEEKLY' ? (
          <label className="field">
            Thứ{' '}
            <select
              className="select"
              value={form.dayOfWeek ?? 1}
              onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
            >
              {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                <option value={d} key={d}>
                  {d === 7 ? 'Chủ nhật' : `Thứ ${d + 1}`}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="field">
            Ngày trong tháng{' '}
            <input
              className="input"
              type="number"
              required
              min="1"
              max="31"
              value={form.dayOfMonth ?? ''}
              onChange={(e) => setForm({ ...form, dayOfMonth: Number(e.target.value) })}
            />
          </label>
        )}
        <label className="field">
          Giờ gửi (giờ Việt Nam){' '}
          <input
            className="input"
            required
            type="time"
            value={form.sendTime}
            onChange={(e) => setForm({ ...form, sendTime: e.target.value })}
          />
        </label>
        <label className="field">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Bật lịch
        </label>
        <button className="btn btn--primary">Lưu lịch</button>
        {id && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setId(null);
              setForm(blank());
            }}
          >
            Hủy sửa
          </button>
        )}
      </form>
    </div>
  );
}
