import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Checkbox, ConfirmationModal, DataTable, RowActions, StatusBadge } from '@/components';
import { Plus, Check, Trash2, PauseCircle } from '@/components/ui/icons';
import { AnnouncementAlert, AnnouncementHeader, scheduleRepeatLabel } from '@/components/announcement/announcementUi';
import { announcements } from '@/services/announcement/announcementService';
import { useAsync } from '@/hooks/useAsync';
import { useToast } from '@/contexts/ToastContext';
import { formatDateTime } from '@/utils/format';

export default function AnnouncementSchedulesPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => announcements.schedules(), []);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const [actionError, setActionError] = useState('');
  const rows = data || [];
  // PAR-10: tick mọi lịch để bật/tắt hàng loạt; chỉ xóa được khi mọi lịch đã chọn đều đã tắt (BE 1215).
  const picked = selected.filter((id) => rows.some((row) => row.id === id));
  const pickedOn = picked.filter((id) => rows.find((row) => row.id === id).active);
  const pickedOff = picked.filter((id) => !pickedOn.includes(id));
  const allSelected = rows.length > 0 && picked.length === rows.length;
  const toggleSelected = (id) => setSelected((ids) => (ids.includes(id) ? ids.filter((key) => key !== id) : [...ids, id]));
  const activate = async (ids, active) => {
    if (busy || !ids.length) return;
    setBusy(true);
    setActionError('');
    try {
      await announcements.activateSchedules(ids, active);
      setSelected([]);
      toast?.success('Đã cập nhật.');
      await reload({ silent: true });
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    setActionError('');
    try {
      await announcements.deleteSchedules(pending.ids);
      setSelected((ids) => ids.filter((id) => !pending.ids.includes(id)));
      setPending(null);
      toast?.success('Đã xóa.');
      await reload({ silent: true });
    } catch (e) {
      setActionError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page page--toolbar announcement-page">
      <AnnouncementHeader
        title="Lịch gửi thông báo"
        summary={`${rows.length} lịch gửi`}
        actions={
          <>
            <Button
              size="sm"
              variant="outline-primary"
              icon={Check}
              disabled={busy || loading || !pickedOff.length}
              onClick={() => activate(pickedOff, true)}
            >
              Bật đã chọn{pickedOff.length ? ` (${pickedOff.length})` : ''}
            </Button>
            <Button
              size="sm"
              variant="outline-primary"
              icon={PauseCircle}
              disabled={busy || loading || !pickedOn.length}
              onClick={() => activate(pickedOn, false)}
            >
              Tắt đã chọn{pickedOn.length ? ` (${pickedOn.length})` : ''}
            </Button>
            <Button
              size="sm"
              variant="outline-danger"
              icon={Trash2}
              title={pickedOn.length ? 'Tắt các lịch đang bật trước khi xóa' : undefined}
              disabled={busy || loading || !picked.length || pickedOn.length > 0}
              onClick={() => {
                setActionError('');
                setPending({ ids: picked });
              }}
            >
              Xóa đã chọn{picked.length ? ` (${picked.length})` : ''}
            </Button>
            <Link className="btn btn--sm btn--outline-primary" to="/announcement-schedules/new">
              <Plus size={15} aria-hidden="true" /> Tạo lịch gửi
            </Link>
          </>
        }
      />
      {!pending && <AnnouncementAlert>{actionError}</AnnouncementAlert>}
      <section className="card">
        <DataTable
          rows={rows}
          loading={loading}
          error={error}
          onRetry={reload}
          empty={{ title: 'Chưa có lịch gửi thông báo', description: 'Tạo lịch gửi để bắt đầu.' }}
          columns={[
            {
              key: 'selection',
              className: 'center',
              header: (
                <Checkbox
                  aria-label="Chọn tất cả lịch gửi"
                  checked={allSelected}
                  aria-checked={picked.length > 0 && !allSelected ? 'mixed' : allSelected}
                  disabled={busy || loading || !rows.length}
                  ref={(node) => {
                    if (node) node.indeterminate = picked.length > 0 && !allSelected;
                  }}
                  onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])}
                />
              ),
              render: (item) => (
                <Checkbox
                  aria-label={`Chọn lịch ${item.title || item.templateName}`}
                  checked={picked.includes(item.id)}
                  disabled={busy || loading}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => toggleSelected(item.id)}
                />
              ),
            },
            { key: 'index', header: 'STT', className: 'center', render: (item) => rows.indexOf(item) + 1 },
            {
              key: 'title',
              header: 'Tiêu đề thông báo',
              render: (item) => <span className="fw-600">{item.title || item.templateName}</span>,
            },
            { key: 'frequency', header: 'Lặp lại', render: scheduleRepeatLabel },
            { key: 'sendTime', header: 'Giờ gửi', render: (item) => item.sendTime?.slice(0, 5) || '—' },
            { key: 'nextRunAt', header: 'Lần gửi tiếp theo', render: (item) => (item.active ? formatDateTime(item.nextRunAt) : '—') },
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
                  name={item.title || item.templateName}
                  view={{ to: `/announcement-schedules/${item.id}`, label: 'Xem chi tiết' }}
                  edit={{ to: `/announcement-schedules/${item.id}/edit` }}
                  menu={[
                    {
                      label: item.active ? 'Tắt lịch gửi' : 'Bật lịch gửi',
                      disabled: busy,
                      onClick: () => activate([item.id], !item.active),
                    },
                    {
                      label: item.active ? 'Xóa lịch gửi (tắt lịch trước)' : 'Xóa lịch gửi',
                      danger: true,
                      disabled: busy || item.active,
                      onClick: () => {
                        setActionError('');
                        setPending({ ids: [item.id] });
                      },
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </section>
      <ConfirmationModal
        open={!!pending}
        title={pending?.ids.length > 1 ? `Xóa ${pending.ids.length} lịch gửi đã chọn?` : 'Xóa lịch gửi?'}
        message="Lịch gửi và tệp đính kèm của lịch sẽ bị xóa. Các thông báo đã gửi vẫn được giữ lại. Không thể hoàn tác."
        confirmLabel={pending?.ids.length > 1 ? 'Xóa đã chọn' : 'Xóa lịch gửi'}
        danger
        error={actionError}
        onConfirm={remove}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
