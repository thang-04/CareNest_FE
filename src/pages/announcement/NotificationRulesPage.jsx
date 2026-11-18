import { useToast } from '@/contexts/ToastContext';
import { useState } from 'react';
import { Button, Checkbox, DataTable, Modal, RowActions, StatusBadge, TextAreaField, TextField } from '@/components';
import { Save } from '@/components/ui/icons';
import { AnnouncementAlert, AnnouncementHeader } from '@/components/announcement/announcementUi';
import { announcements } from '@/services/announcement/announcementService';
import { useAsync } from '@/hooks/useAsync';

export default function NotificationRulesPage() {
  const { data, setData, loading, error, reload } = useAsync(() => announcements.rules(), []);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const toast = useToast();
  const open = (item, readOnly) => {
    setActionError('');
    setForm({ ...item, readOnly });
  };
  // Chế độ xem: giữ hiển thị như quyền sửa nhưng khóa ô nhập và ẩn nút lưu.
  const canSave = form?.editable && !form?.readOnly;
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      const updated = await announcements.updateRule(form.type, {
        enabled: form.enabled,
        titleTemplate: form.titleTemplate,
        bodyTemplate: form.bodyTemplate,
      });
      setData((items) => items.map((item) => (item.type === form.type ? updated : item)));
      setForm(null);
      toast?.success('Đã lưu.');
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page page--toolbar announcement-page">
      <AnnouncementHeader title="Quy tắc thông báo" summary="Cấu hình các loại thông báo tự động" />
      <section className="card">
        <div className="filter-bar">
          <span className="text-sm muted">Chọn một loại thông báo để xem hoặc sửa câu chữ</span>
        </div>
        <DataTable
          rows={data}
          loading={loading}
          error={error}
          onRetry={reload}
          empty={{ title: 'Chưa có quy tắc thông báo', description: 'Các loại thông báo tự động sẽ xuất hiện tại đây.' }}
          columns={[
            { key: 'index', header: 'STT', className: 'center', render: (item) => data.indexOf(item) + 1 },
            { key: 'label', header: 'Loại thông báo', render: (item) => <span className="fw-600">{item.label}</span> },
            {
              key: 'mandatory',
              header: 'Quy định',
              render: (item) => <StatusBadge tone={item.mandatory ? 'orange' : 'gray'} label={item.mandatory ? 'Bắt buộc' : 'Tùy chọn'} />,
            },
            {
              key: 'enabled',
              header: 'Trạng thái',
              render: (item) => <StatusBadge tone={item.enabled ? 'green' : 'gray'} label={item.enabled ? 'Đang bật' : 'Đã tắt'} />,
            },
            { key: 'customized', header: 'Câu chữ', render: (item) => (item.customized ? 'Đã tùy chỉnh' : 'Mặc định') },
            { key: 'editable', header: 'Quyền chỉnh sửa', render: (item) => (item.editable ? 'Được sửa câu chữ' : 'Chỉ xem') },
            {
              key: 'actions',
              header: 'Thao tác',
              className: 'cell--actions',
              render: (item) => (
                <RowActions
                  name={item.label}
                  view={{ onClick: () => open(item, true), label: 'Xem chi tiết' }}
                  edit={item.editable ? { onClick: () => open(item, false) } : undefined}
                />
              ),
            },
          ]}
        />
      </section>
      <Modal
        open={!!form}
        title={form?.label || 'Quy tắc thông báo'}
        size="lg"
        onClose={busy ? undefined : () => setForm(null)}
        footer={
          <>
            <Button size="sm" disabled={busy} onClick={() => setForm(null)}>
              {canSave ? 'Hủy' : 'Đóng'}
            </Button>
            {canSave && (
              <Button size="sm" type="submit" form="notification-rule-form" variant="outline-primary" icon={Save} loading={busy}>
                Lưu quy tắc
              </Button>
            )}
          </>
        }
      >
        {form && (
          <form id="notification-rule-form" className="announcement-form" onSubmit={save}>
            <AnnouncementAlert>{actionError}</AnnouncementAlert>
            <div className="announcement-rule-summary">
              <StatusBadge tone={form.mandatory ? 'orange' : 'gray'} label={form.mandatory ? 'Bắt buộc' : 'Tùy chọn'} />
              <span className="muted text-sm">
                {form.mandatory ? 'Không thể tắt loại thông báo này.' : 'Có thể bật hoặc tắt loại thông báo này.'}
              </span>
            </div>
            <label className="announcement-check">
              <Checkbox
                disabled={!canSave || form.mandatory || busy}
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              <span>Bật thông báo</span>
            </label>
            {form.editable ? (
              <>
                <TextField
                  label="Tiêu đề"
                  maxLength={150}
                  disabled={busy || form.readOnly}
                  value={form.titleTemplate || ''}
                  onChange={(e) => setForm({ ...form, titleTemplate: e.target.value })}
                />
                <TextAreaField
                  label="Nội dung"
                  rows={6}
                  maxLength={500}
                  disabled={busy || form.readOnly}
                  value={form.bodyTemplate || ''}
                  onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })}
                />
                <div className="announcement-variables">
                  <span>Biến được hỗ trợ:</span>
                  {form.variables?.length ? (
                    form.variables.map((variable) => <code className="chip chip--gray" key={variable}>{`{${variable}}`}</code>)
                  ) : (
                    <span>Không có</span>
                  )}
                </div>
              </>
            ) : (
              <AnnouncementAlert info>Câu chữ của loại thông báo này do hệ thống tạo theo nội dung nghiệp vụ.</AnnouncementAlert>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}
