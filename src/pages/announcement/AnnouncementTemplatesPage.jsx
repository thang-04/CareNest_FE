import { useToast } from '@/contexts/ToastContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, ConfirmationModal, DataTable, Modal, RowActions } from '@/components';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { Plus, Save, Upload } from '@/components/ui/icons';
import AnnouncementTemplateForm from '@/components/announcement/AnnouncementTemplateForm';
import TemplateImportDialog from '@/components/announcement/TemplateImportDialog';
import { ROLES } from '@/models/User';
import { announcements } from '@/services/announcement/announcementService';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { textToHtml } from '@/utils/announcement/richText.mjs';

const blank = { name: '', title: '', body: '', bodyHtml: '', campusId: null };
export default function AnnouncementTemplatesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [importing, setImporting] = useState(false);
  const { data, loading, error, reload } = useAsync(async () => {
    const [items, campuses] = await Promise.all([announcements.templates(user), announcements.campuses()]);
    return { items, campuses };
  }, [user]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(null);
  const [id, setId] = useState(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [bodyError, setBodyError] = useState('');
  const toast = useToast();
  const edit = (item, readOnly = false) => {
    setActionError('');
    setBodyError('');
    setId(item?.id || null);
    setForm(
      item
        ? {
            name: item.name,
            title: item.title,
            body: item.body,
            bodyHtml: item.bodyHtml || textToHtml(item.body),
            campusId: item.campusId,
            readOnly,
          }
        : { ...blank },
    );
  };
  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!form.body?.trim()) {
      setBodyError('Nhập nội dung thông báo.');
      return;
    }
    setBodyError('');
    setBusy(true);
    setActionError('');
    try {
      const payload = { ...form, body: form.bodyHtml ? '' : form.body };
      if (id) await announcements.updateTemplate(id, payload, user);
      else await announcements.createTemplate(payload, user);
      setForm(null);
      toast?.success('Đã lưu.');
      await reload({ silent: true });
    } catch (e) {
      setActionError(e.message);
      setBodyError(e.details?.body || '');
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
  const keyword = q.toLowerCase();
  const rows = data?.items.filter((item) => !keyword || `${item.name} ${item.title}`.toLowerCase().includes(keyword));
  return (
    <>
      <section className="card">
        <div className="filter-bar filter-bar--aligned">
          <SearchSubmit
            className="flex-1"
            value={q}
            label="Tìm mẫu thông báo"
            placeholder="Tìm theo tên mẫu hoặc tiêu đề"
            onSearch={setQ}
          />
          <div className="filter-bar__end">
            <Button icon={Upload} disabled={!data} onClick={() => setImporting(true)}>
              Nhập từ Excel
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => edit(null)}>
              Tạo mẫu thông báo
            </Button>
          </div>
        </div>
        <DataTable
          rows={rows}
          loading={loading}
          error={error}
          onRetry={reload}
          onRowClick={(item) => edit(item, true)}
          empty={
            q
              ? { title: 'Không có mẫu phù hợp', description: 'Thử đổi từ khóa tìm kiếm.' }
              : { title: 'Chưa có mẫu thông báo', description: 'Tạo mẫu để dùng lại nội dung cho những lần gửi sau.' }
          }
          columns={[
            { key: 'index', header: 'STT', className: 'center', render: (item) => rows.indexOf(item) + 1 },
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
                  edit={item.canEdit ? { onClick: () => edit(item) } : undefined}
                  menu={[
                    // Trang tạo lịch gửi chỉ mở cho Hiệu trưởng nên Phó hiệu trưởng không thấy mục này
                    ...(user?.role === ROLES.PRINCIPAL
                      ? [{ label: 'Tạo lịch gửi từ mẫu này', onClick: () => navigate(`/announcement-schedules/new?templateId=${item.id}`) }]
                      : []),
                    ...(item.canEdit
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
                      : []),
                  ]}
                />
              ),
            },
          ]}
        />
      </section>
      <Modal
        open={!!form}
        title={form?.readOnly ? 'Chi tiết mẫu thông báo' : id ? 'Sửa mẫu thông báo' : 'Tạo mẫu thông báo'}
        size="xl"
        onClose={busy ? undefined : () => setForm(null)}
        footer={
          <>
            <Button size="sm" disabled={busy} onClick={() => setForm(null)}>
              {form?.readOnly ? 'Đóng' : 'Hủy'}
            </Button>
            {!form?.readOnly && (
              <Button size="sm" type="submit" form="announcement-template-form" variant="primary" icon={Save} loading={busy}>
                Lưu mẫu
              </Button>
            )}
          </>
        }
      >
        {form && (
          <AnnouncementTemplateForm
            id="announcement-template-form"
            form={form}
            onChange={(next) => {
              setForm(next);
              setBodyError('');
            }}
            onSubmit={save}
            disabled={busy || form.readOnly}
            campuses={data?.campuses || []}
            viceRole={user?.role === 'VICE_PRINCIPAL'}
            error={actionError}
            bodyError={bodyError}
          />
        )}
      </Modal>
      {importing && (
        <TemplateImportDialog
          user={user}
          campuses={data?.campuses || []}
          viceRole={user?.role === ROLES.VICE_PRINCIPAL}
          onDone={(created) => {
            if (created) toast?.success(`Đã tạo ${created} mẫu.`);
            reload({ silent: true });
          }}
          onClose={() => setImporting(false)}
        />
      )}
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
    </>
  );
}
