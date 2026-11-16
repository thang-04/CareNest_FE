import { useState } from 'react';
import { Button, Checkbox, ConfirmationModal, DataTable, Modal, RowActions, SelectField, StatusBadge, TextField } from '@/components';
import { Plus, Save } from '@/components/ui/icons';
import { AnnouncementAlert, AnnouncementHeader } from '@/components/announcement/announcementUi';
import RecipientTargetForm, { emptyTarget } from '@/components/announcement/RecipientTargetForm';
import { announcements } from '@/services/announcement/announcementService';
import { useAsync } from '@/hooks/useAsync';
import { formatDateTime } from '@/utils/format';

const blank = () => ({
  templateId: '',
  target: { ...emptyTarget, roles: [] },
  frequency: 'WEEKLY',
  dayOfWeek: 1,
  dayOfMonth: null,
  sendTime: '08:00',
  active: true,
});
const payload = (item) => ({
  templateId: Number(item.templateId),
  target: item.target,
  frequency: item.frequency,
  dayOfWeek: item.frequency === 'WEEKLY' ? Number(item.dayOfWeek) : null,
  dayOfMonth: item.frequency === 'MONTHLY' ? Number(item.dayOfMonth) : null,
  sendTime: item.sendTime,
  active: item.active,
});
const weekday = (day) => (Number(day) === 7 ? 'Chủ nhật' : `Thứ ${Number(day) + 1}`);

export default function AnnouncementSchedulesPage() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [items, templates] = await Promise.all([announcements.schedules(), announcements.templates()]);
    return { items, templates };
  }, []);
  const [form, setForm] = useState(null);
  const [id, setId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const edit = (item) => {
    setActionError('');
    setId(item?.id || null);
    setForm(item ? payload(item) : blank());
  };
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      if (id) await announcements.updateSchedule(id, payload(form));
      else await announcements.createSchedule(payload(form));
      setForm(null);
      setNotice(id ? 'Đã lưu thay đổi lịch gửi.' : 'Đã tạo lịch gửi thông báo.');
      await reload({ silent: true });
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (item) => {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      await announcements.updateSchedule(item.id, payload({ ...item, active: !item.active }));
      setNotice(item.active ? 'Đã tắt lịch gửi.' : 'Đã bật lịch gửi.');
      await reload({ silent: true });
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setActionError('');
    try {
      await announcements.deleteSchedule(pending.id);
      setPending(null);
      setNotice('Đã xóa lịch gửi.');
      await reload({ silent: true });
    } catch (e) {
      setActionError(e.message);
    }
  };
  return (
    <div className="page page--toolbar announcement-page">
      <AnnouncementHeader
        title="Lịch gửi thông báo"
        summary="Gửi lặp theo tuần hoặc tháng"
        actions={
          <Button icon={Plus} variant="outline-primary" size="sm" disabled={busy} onClick={() => edit(null)}>
            Tạo lịch gửi
          </Button>
        }
      />
      <AnnouncementAlert info>{notice}</AnnouncementAlert>
      {!form && !pending && <AnnouncementAlert>{actionError}</AnnouncementAlert>}
      <section className="card">
        <div className="filter-bar">
          <span className="text-sm muted">Gửi lặp theo tuần hoặc tháng; bỏ qua lần trúng ngày nghỉ</span>
        </div>
        <DataTable
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={reload}
          empty={{
            title: 'Chưa có lịch gửi thông báo',
            description: 'Tạo mẫu thông báo trước, sau đó chọn mẫu để thiết lập lịch gửi lặp.',
          }}
          columns={[
            { key: 'index', header: 'STT', className: 'center', render: (item) => data.items.indexOf(item) + 1 },
            { key: 'templateName', header: 'Mẫu thông báo', render: (item) => <span className="fw-600">{item.templateName}</span> },
            {
              key: 'frequency',
              header: 'Lặp lại',
              render: (item) =>
                item.frequency === 'WEEKLY' ? `${weekday(item.dayOfWeek)} hằng tuần` : `Ngày ${item.dayOfMonth} hằng tháng`,
            },
            { key: 'sendTime', header: 'Giờ gửi', render: (item) => item.sendTime?.slice(0, 5) || '—' },
            { key: 'nextRunAt', header: 'Lần gửi tiếp theo', render: (item) => formatDateTime(item.nextRunAt) },
            {
              key: 'active',
              header: 'Trạng thái',
              render: (item) => <StatusBadge tone={item.active ? 'green' : 'gray'} label={item.active ? 'Đang bật' : 'Đã tắt'} />,
            },
            {
              key: 'actions',
              header: 'Thao tác',
              className: 'cell--actions',
              render: (item) => (
                <RowActions
                  name={item.templateName}
                  edit={busy ? undefined : { onClick: () => edit(item) }}
                  menu={[
                    { label: item.active ? 'Tắt lịch gửi' : 'Bật lịch gửi', disabled: busy, onClick: () => toggle(item) },
                    {
                      label: 'Xóa lịch gửi',
                      danger: true,
                      disabled: busy,
                      onClick: () => {
                        setActionError('');
                        setPending(item);
                      },
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </section>
      <Modal
        open={!!form}
        title={id ? 'Sửa lịch gửi' : 'Tạo lịch gửi'}
        size="lg"
        onClose={busy ? undefined : () => setForm(null)}
        footer={
          <>
            <Button size="sm" disabled={busy} onClick={() => setForm(null)}>
              Hủy
            </Button>
            <Button size="sm" type="submit" form="announcement-schedule-form" icon={Save} variant="outline-primary" loading={busy}>
              Lưu lịch gửi
            </Button>
          </>
        }
      >
        {form && (
          <form id="announcement-schedule-form" className="announcement-form" onSubmit={save}>
            <AnnouncementAlert>{actionError}</AnnouncementAlert>
            <SelectField
              fieldClassName="announcement-field--medium"
              disabled={busy}
              label="Mẫu thông báo"
              required
              value={form.templateId}
              onChange={(e) => setForm({ ...form, templateId: e.target.value })}
            >
              <option value="">Chọn mẫu thông báo</option>
              {(data?.templates || []).map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </SelectField>
            <RecipientTargetForm disabled={busy} value={form.target} onChange={(target) => setForm({ ...form, target })} />
            <div className="announcement-fields">
              <SelectField
                disabled={busy}
                label="Tần suất"
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
              >
                <option value="WEEKLY">Hằng tuần</option>
                <option value="MONTHLY">Hằng tháng</option>
              </SelectField>
              {form.frequency === 'WEEKLY' ? (
                <SelectField
                  disabled={busy}
                  label="Ngày gửi trong tuần"
                  value={form.dayOfWeek ?? 1}
                  onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                    <option key={day} value={day}>
                      {weekday(day)}
                    </option>
                  ))}
                </SelectField>
              ) : (
                <TextField
                  disabled={busy}
                  label="Ngày gửi trong tháng"
                  fieldClassName="announcement-field--short"
                  type="number"
                  required
                  min="1"
                  max="31"
                  value={form.dayOfMonth ?? ''}
                  onChange={(e) => setForm({ ...form, dayOfMonth: Number(e.target.value) })}
                  hint="Nếu tháng không có ngày đã chọn, lịch dùng ngày cuối tháng."
                />
              )}
              <TextField
                disabled={busy}
                label="Giờ gửi (giờ Việt Nam)"
                fieldClassName="announcement-field--short"
                required
                type="time"
                value={form.sendTime}
                onChange={(e) => setForm({ ...form, sendTime: e.target.value })}
              />
            </div>
            <label className="announcement-check">
              <Checkbox disabled={busy} checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              <span>Bật lịch gửi</span>
            </label>
          </form>
        )}
      </Modal>
      <ConfirmationModal
        open={!!pending}
        title="Xóa lịch gửi?"
        message={`Lịch gửi từ mẫu “${pending?.templateName || ''}” sẽ bị xóa. Những thông báo đã gửi vẫn được giữ lại.`}
        confirmLabel="Xóa lịch gửi"
        danger
        onConfirm={remove}
        onClose={() => setPending(null)}
        error={actionError}
      />
    </div>
  );
}
