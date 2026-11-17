import { useToast } from '@/contexts/ToastContext';
import { useState } from 'react';
import { Button, ConfirmationModal, DataTable, Modal, RowActions, SelectField, TextAreaField, TextField } from '@/components';
import { Plus, Save } from '@/components/ui/icons';
import { AnnouncementAlert, AnnouncementHeader } from '@/components/announcement/announcementUi';
import { announcements } from '@/services/announcement/announcementService';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';

const blank = { name: '', title: '', body: '', campusId: null };
export default function AnnouncementTemplatesPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(async () => {
    const [items, campuses] = await Promise.all([announcements.templates(user), announcements.campuses()]);
    return { items, campuses };
  }, [user]);
  const [form, setForm] = useState(null);
  const [id, setId] = useState(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const toast = useToast();
  const edit = (item, readOnly = false) => {
    setActionError('');
    setId(item?.id || null);
    setForm(item ? { name: item.name, title: item.title, body: item.body, campusId: item.campusId, readOnly } : { ...blank });
  };
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      if (id) await announcements.updateTemplate(id, form, user);
      else await announcements.createTemplate(form, user);
      setForm(null);
      toast?.success('Đã lưu.');
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
      await announcements.deleteTemplate(pending.id, user);
      setPending(null);
      toast?.success('Đã xóa.');
      await reload({ silent: true });
    } catch (e) {
      setActionError(e.errorCode === 1209 ? 'Mẫu đang được lịch sử dụng. Hãy kiểm tra lịch trước.' : e.message);
    }
  };
  return (
    <div className="page page--toolbar announcement-page">
      <AnnouncementHeader
        title="Mẫu thông báo"
        summary="Nội dung dùng lại cho thông báo và lịch gửi"
        actions={
          <Button variant="outline-primary" size="sm" icon={Plus} onClick={() => edit(null)}>
            Tạo mẫu thông báo
          </Button>
        }
      />
      <section className="card">
        <DataTable
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={reload}
          empty={{ title: 'Chưa có mẫu thông báo', description: 'Tạo mẫu để dùng lại nội dung cho những lần gửi sau.' }}
          columns={[
            { key: 'index', header: 'STT', className: 'center', render: (item) => data.items.indexOf(item) + 1 },
            { key: 'name', header: 'Tên mẫu', render: (item) => <span className="fw-600">{item.name}</span> },
            { key: 'title', header: 'Tiêu đề thông báo' },
            {
              key: 'campus',
              header: 'Phạm vi mẫu',
              render: (item) =>
                item.campusId == null
                  ? 'Toàn trường'
                  : data.campuses.find((campus) => String(campus.id) === String(item.campusId))?.name || 'Điểm trường',
            },
            {
              key: 'actions',
              header: 'Thao tác',
              className: 'cell--actions',
              render: (item) => (
                <RowActions
                  name={item.name}
                  view={{ onClick: () => edit(item, true), label: 'Xem chi tiết' }}
                  edit={item.canEdit ? { onClick: () => edit(item) } : undefined}
                  menu={
                    item.canEdit
                      ? [
                          {
                            label: 'Xóa mẫu',
                            danger: true,
                            onClick: () => {
                              setActionError('');
                              setPending(item);
                            },
                          },
                        ]
                      : []
                  }
                />
              ),
            },
          ]}
        />
      </section>
      <Modal
        open={!!form}
        title={form?.readOnly ? 'Chi tiết mẫu thông báo' : id ? 'Sửa mẫu thông báo' : 'Tạo mẫu thông báo'}
        size="lg"
        onClose={busy ? undefined : () => setForm(null)}
        footer={
          <>
            <Button size="sm" disabled={busy} onClick={() => setForm(null)}>
              {form?.readOnly ? 'Đóng' : 'Hủy'}
            </Button>
            {!form?.readOnly && (
              <Button size="sm" type="submit" form="announcement-template-form" variant="outline-primary" icon={Save} loading={busy}>
                Lưu mẫu
              </Button>
            )}
          </>
        }
      >
        {form && (
          <form id="announcement-template-form" className="announcement-form" onSubmit={save}>
            <AnnouncementAlert>{actionError}</AnnouncementAlert>
            <TextField
              fieldClassName="announcement-field--medium"
              disabled={busy || form.readOnly}
              label="Tên mẫu"
              required
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <SelectField
              fieldClassName="announcement-field--medium"
              disabled={busy || form.readOnly}
              label="Phạm vi mẫu"
              required={user?.role === 'VICE_PRINCIPAL'}
              value={form.campusId ?? ''}
              onChange={(e) => setForm({ ...form, campusId: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">{user?.role === 'VICE_PRINCIPAL' ? 'Chọn điểm trường' : 'Toàn trường'}</option>
              {(data?.campuses || []).map((site) => (
                <option value={site.id} key={site.id}>
                  {site.name}
                </option>
              ))}
            </SelectField>
            <TextField
              disabled={busy || form.readOnly}
              label="Tiêu đề thông báo"
              required
              maxLength={150}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <TextAreaField
              disabled={busy || form.readOnly}
              label="Nội dung"
              required
              rows={8}
              maxLength={4000}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </form>
        )}
      </Modal>
      <ConfirmationModal
        open={!!pending}
        title="Xóa mẫu thông báo?"
        message={`Mẫu “${pending?.name || ''}” sẽ bị xóa. Thông báo đã gửi không bị ảnh hưởng.`}
        confirmLabel="Xóa mẫu"
        danger
        error={actionError}
        onConfirm={remove}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
