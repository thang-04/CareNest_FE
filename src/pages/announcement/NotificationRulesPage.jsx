import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { useEffect, useState } from 'react';
import { announcements } from '@/services/announcement/announcementService';

export default function NotificationRulesPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    announcements
      .rules()
      .then((x) => {
        if (active) setItems(x);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const edit = (index, patch) => setItems((old) => old.map((x, i) => (i === index ? { ...x, ...patch } : x)));
  const save = async (index) => {
    const item = items[index];
    try {
      const updated = await announcements.updateRule(item.type, {
        enabled: item.enabled,
        titleTemplate: item.titleTemplate,
        bodyTemplate: item.bodyTemplate,
      });
      edit(index, updated);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Quy tắc thông báo' }]} />
      <h1 className="page__title">Quy tắc thông báo</h1>
      {error && <p role="alert">{error}</p>}
      {items.map((item, i) => (
        <section className="card card__body" key={item.type}>
          <h2>{item.label}</h2>
          <p>
            {item.mandatory ? 'Bắt buộc' : 'Tùy chọn'} · {item.customized ? 'Đã tùy chỉnh' : 'Mặc định'}
          </p>
          <label className="field">
            <input
              type="checkbox"
              disabled={!item.editable || item.mandatory}
              checked={item.enabled}
              onChange={(e) => edit(i, { enabled: e.target.checked })}
            />{' '}
            Bật
          </label>
          <label className="field">
            Tiêu đề{' '}
            <input
              className="input"
              disabled={!item.editable}
              maxLength={150}
              value={item.titleTemplate || ''}
              onChange={(e) => edit(i, { titleTemplate: e.target.value })}
            />
          </label>
          <label className="field">
            Nội dung{' '}
            <textarea
              className="textarea"
              disabled={!item.editable}
              maxLength={500}
              value={item.bodyTemplate || ''}
              onChange={(e) => edit(i, { bodyTemplate: e.target.value })}
            />
          </label>
          <p>Biến được hỗ trợ: {(item.variables || []).join(', ') || 'Không có'}</p>
          {item.editable && (
            <button className="btn" onClick={() => save(i)}>
              Lưu
            </button>
          )}
        </section>
      ))}
    </div>
  );
}
