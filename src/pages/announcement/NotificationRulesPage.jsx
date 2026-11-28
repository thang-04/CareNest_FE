import { useToast } from '@/contexts/ToastContext';
import { useRef, useState } from 'react';
import { Button, Checkbox, DataTable, Modal, RowActions, StatusBadge, TextAreaField, TextField } from '@/components';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { Save } from '@/components/ui/icons';
import { AnnouncementAlert } from '@/components/announcement/announcementUi';
import AnnouncementPreview from '@/components/announcement/AnnouncementPreview';
import { formatCount, insertAtCaret, renderSample } from '@/utils/announcement/templateText.mjs';

const RULE_LIMITS = { title: 150, body: 500 };
import { announcements } from '@/services/announcement/announcementService';
import { useAsync } from '@/hooks/useAsync';

export default function NotificationRulesPage() {
  const { data, setData, loading, error, reload } = useAsync(() => announcements.rules(), []);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const titleRef = useRef(null);
  const bodyRef = useRef(null);
  const lastField = useRef('bodyTemplate');
  const toast = useToast();
  const open = (item, readOnly) => {
    setActionError('');
    setForm({ ...item, readOnly });
  };
  // Chế độ xem: giữ hiển thị như quyền sửa nhưng khóa ô nhập và ẩn nút lưu.
  const canSave = form?.editable && !form?.readOnly;
  // Chip biến chèn vào ô đang chọn gần nhất (mặc định nội dung), đúng chỗ con trỏ.
  const insertVariable = (variable) => {
    const key = lastField.current;
    const el = (key === 'titleTemplate' ? titleRef : bodyRef).current;
    const max = key === 'titleTemplate' ? RULE_LIMITS.title : RULE_LIMITS.body;
    const result = insertAtCaret(form[key] || '', el?.selectionStart, el?.selectionEnd, `{${variable}}`, max);
    if (!result) {
      setActionError('Không đủ chỗ để chèn biến, hãy rút gọn câu chữ.');
      return;
    }
    setActionError('');
    setForm({ ...form, [key]: result.value });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(result.caret, result.caret);
    });
  };
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
  const keyword = q.toLowerCase();
  const rows = data?.filter((item) => !keyword || item.label.toLowerCase().includes(keyword));
  return (
    <>
      <section className="card">
        <div className="filter-bar filter-bar--aligned">
          <SearchSubmit className="flex-1" value={q} label="Tìm loại thông báo" placeholder="Tìm theo loại thông báo" onSearch={setQ} />
        </div>
        <DataTable
          rows={rows}
          loading={loading}
          error={error}
          onRetry={reload}
          onRowClick={(item) => open(item, true)}
          empty={
            q
              ? { title: 'Không có loại thông báo phù hợp', description: 'Thử đổi từ khóa tìm kiếm.' }
              : { title: 'Chưa có quy tắc thông báo', description: 'Các loại thông báo tự động sẽ xuất hiện tại đây.' }
          }
          columns={[
            { key: 'index', header: 'STT', className: 'center', render: (item) => rows.indexOf(item) + 1 },
            { key: 'label', header: 'Loại thông báo', render: (item) => <span className="fw-600">{item.label}</span> },
            {
              key: 'mandatory',
              header: 'Quy định',
              className: 'center',
              render: (item) => <StatusBadge tone={item.mandatory ? 'orange' : 'gray'} label={item.mandatory ? 'Bắt buộc' : 'Tùy chọn'} />,
            },
            {
              key: 'enabled',
              header: 'Trạng thái',
              className: 'center',
              render: (item) => <StatusBadge tone={item.enabled ? 'green' : 'gray'} label={item.enabled ? 'Đang bật' : 'Đã tắt'} />,
            },
            {
              key: 'customized',
              header: 'Câu chữ',
              className: 'center',
              render: (item) => (item.customized ? 'Đã tùy chỉnh' : 'Mặc định'),
            },
            {
              key: 'editable',
              header: 'Quyền chỉnh sửa',
              className: 'center',
              render: (item) => (item.editable ? 'Được sửa câu chữ' : 'Chỉ xem'),
            },
            {
              key: 'actions',
              header: 'Thao tác',
              className: 'cell--actions',
              render: (item) => <RowActions name={item.label} edit={item.editable ? { onClick: () => open(item, false) } : undefined} />,
            },
          ]}
        />
      </section>
      <Modal
        open={!!form}
        title={form?.label || 'Quy tắc thông báo'}
        size={form?.editable ? 'xl' : 'lg'}
        onClose={busy ? undefined : () => setForm(null)}
        footer={
          <>
            <Button size="sm" disabled={busy} onClick={() => setForm(null)}>
              {canSave ? 'Hủy' : 'Đóng'}
            </Button>
            {canSave && (
              <Button size="sm" type="submit" form="notification-rule-form" variant="primary" icon={Save} loading={busy}>
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
              <div className="announcement-template-layout">
                <div className="announcement-form">
                  <TextField
                    ref={titleRef}
                    label="Tiêu đề"
                    maxLength={RULE_LIMITS.title}
                    disabled={busy || form.readOnly}
                    value={form.titleTemplate || ''}
                    onFocus={() => (lastField.current = 'titleTemplate')}
                    onChange={(e) => setForm({ ...form, titleTemplate: e.target.value })}
                    hint={formatCount(form.titleTemplate, RULE_LIMITS.title)}
                  />
                  <TextAreaField
                    ref={bodyRef}
                    label="Nội dung"
                    rows={6}
                    maxLength={RULE_LIMITS.body}
                    disabled={busy || form.readOnly}
                    value={form.bodyTemplate || ''}
                    onFocus={() => (lastField.current = 'bodyTemplate')}
                    onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })}
                    hint={formatCount(form.bodyTemplate, RULE_LIMITS.body)}
                  />
                  <div className="announcement-variables">
                    <span>Bấm để chèn biến vào chỗ con trỏ:</span>
                    {form.variables?.length ? (
                      form.variables.map((variable) => (
                        <Button
                          key={variable}
                          size="sm"
                          disabled={busy || form.readOnly}
                          aria-label={`Chèn biến ${variable}`}
                          onClick={() => insertVariable(variable)}
                        >
                          {`{${variable}}`}
                        </Button>
                      ))
                    ) : (
                      <span>Không có</span>
                    )}
                  </div>
                </div>
                <AnnouncementPreview
                  label="Xem trước với dữ liệu mẫu"
                  title={renderSample(form.titleTemplate)}
                  body={renderSample(form.bodyTemplate)}
                />
              </div>
            ) : (
              <AnnouncementAlert info>Câu chữ của loại thông báo này do hệ thống tạo theo nội dung nghiệp vụ.</AnnouncementAlert>
            )}
          </form>
        )}
      </Modal>
    </>
  );
}
