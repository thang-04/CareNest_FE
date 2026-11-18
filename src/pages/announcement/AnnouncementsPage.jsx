import { useToast } from '@/contexts/ToastContext';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Checkbox, ConfirmationModal, DataTable, Pagination, RowActions, SelectField } from '@/components';
import {
  emptyAnnouncementSelection,
  toggleAnnouncementSelection,
  announcementIsSelected,
  announcementSelectionCount,
  announcementSelectionRequest,
} from '@/components/announcement/announcementSelection.mjs';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { Plus, FileText, Trash2 } from '@/components/ui/icons';
import {
  AnnouncementAlert,
  AnnouncementHeader,
  AnnouncementStatusBadge,
  announcementStatusLabels,
  scopeLabels,
} from '@/components/announcement/announcementUi';
import { announcements } from '@/services/announcement/announcementService';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { formatDateTime } from '@/utils/format';

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const toast = useToast();
  const [selection, setSelection] = useState(emptyAnnouncementSelection);
  const filters = { q, status: status || undefined };
  const { data, loading, error, reload } = useAsync(
    () => announcements.list({ ...filters, page: page - 1, size: 20 }, user),
    [page, q, status, user],
  );
  const selectedCount = announcementSelectionCount(selection, data?.cancelledCount || 0);
  const allChecked = selectedCount > 0 && selectedCount === data?.cancelledCount;
  const requestDelete = () => {
    if (!selectedCount || busy || loading) return;
    setActionError('');
    setPending({ selection: announcementSelectionRequest(selection, filters), count: selectedCount });
  };
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      await announcements.deleteSelection(pending.selection, user);
      setPending(null);
      setSelection(emptyAnnouncementSelection());
      toast?.success('Đã xóa.');
      if (page > 1) setPage(1);
      else await reload({ silent: true });
    } catch (e) {
      setActionError(e.status === 0 ? 'Chưa xác định xóa thành công. Hãy tải lại danh sách để kiểm tra.' : e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page page--toolbar announcement-page">
      <AnnouncementHeader
        title="Thông báo nhà trường"
        summary={data ? `${data.totalElements} thông báo` : 'Thông báo đã tạo'}
        actions={
          <>
            <Button size="sm" variant="outline-danger" icon={Trash2} disabled={busy || loading || !selectedCount} onClick={requestDelete}>
              Xóa đã chọn{selectedCount ? ` (${selectedCount})` : ''}
            </Button>
            <Link className="btn btn--sm btn--outline-primary" to="/announcement-templates">
              <FileText size={15} aria-hidden="true" /> Mẫu thông báo
            </Link>
            <Link className="btn btn--sm btn--outline-primary" to="/announcements/new">
              <Plus size={15} aria-hidden="true" /> Soạn thông báo
            </Link>
          </>
        }
      />
      {!pending && <AnnouncementAlert>{actionError}</AnnouncementAlert>}
      <section className="card">
        <div className="filter-bar">
          <SearchSubmit
            value={q}
            label="Tìm thông báo"
            placeholder="Tìm tiêu đề hoặc nội dung"
            onSearch={(value) => {
              setQ(value);
              setPage(1);
              setSelection(emptyAnnouncementSelection());
            }}
          />
          <SelectField
            label="Trạng thái"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
              setSelection(emptyAnnouncementSelection());
            }}
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(announcementStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>
        <DataTable
          loading={loading}
          error={error}
          onRetry={reload}
          rows={data?.items}
          empty={{ title: 'Chưa có thông báo nhà trường', description: 'Soạn thông báo và chọn người nhận để bắt đầu.' }}
          columns={[
            {
              key: 'selection',
              className: 'center',
              header: (
                <Checkbox
                  aria-label="Chọn tất cả thông báo đã hủy khớp bộ lọc trên mọi trang"
                  checked={allChecked}
                  aria-checked={selectedCount > 0 && !allChecked ? 'mixed' : allChecked}
                  disabled={busy || loading || !data?.items?.length}
                  ref={(node) => {
                    if (node) node.indeterminate = selectedCount > 0 && !allChecked;
                  }}
                  onChange={(event) => {
                    // Chọn tất cả chỉ tick các tin đã hủy (canDelete); không có tin nào thì báo thay vì im lặng.
                    if (event.target.checked && !data?.cancelledCount) {
                      toast?.info('Không có thông báo đã hủy để chọn.');
                      return;
                    }
                    setSelection(event.target.checked ? { allMatching: true, ids: [], excludedIds: [] } : emptyAnnouncementSelection());
                  }}
                />
              ),
              render: (item) => (
                <Checkbox
                  checked={announcementIsSelected(selection, item)}
                  disabled={busy || loading || !item.canDelete}
                  aria-label={`Chọn thông báo ${item.title}`}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => setSelection((value) => toggleAnnouncementSelection(value, item.id))}
                />
              ),
            },
            { key: 'index', header: 'STT', className: 'center', render: (item) => (page - 1) * 20 + data.items.indexOf(item) + 1 },
            { key: 'title', header: 'Tiêu đề', render: (item) => <span className="fw-600">{item.title}</span> },
            { key: 'scope', header: 'Phạm vi', render: (item) => scopeLabels[item.target?.scopeType] || '—' },
            { key: 'senderName', header: 'Người gửi' },
            { key: 'sendAt', header: 'Thời gian gửi', render: (item) => formatDateTime(item.sentAt || item.sendAt) },
            { key: 'recipientCount', header: 'Số người nhận', className: 'center' },
            {
              key: 'status',
              header: 'Trạng thái',
              className: 'center',
              render: (item) => <AnnouncementStatusBadge status={item.status} />,
            },
            {
              key: 'actions',
              header: 'Thao tác',
              className: 'cell--actions',
              render: (item) => (
                <RowActions
                  name={item.title}
                  view={{ to: `/announcements/${item.id}`, label: 'Xem chi tiết' }}
                  edit={item.canEdit ? { to: `/announcements/${item.id}/edit` } : undefined}
                  menu={
                    item.canDelete
                      ? [
                          {
                            label: 'Xóa thông báo',
                            danger: true,
                            disabled: busy,
                            onClick: () => {
                              setActionError('');
                              setPending({
                                selection: announcementSelectionRequest({ allMatching: false, ids: [item.id], excludedIds: [] }, filters),
                                count: 1,
                              });
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
        {data && !error && <Pagination page={page} pageSize={data.size} total={data.totalElements} onChange={setPage} unit="thông báo" />}
      </section>
      <ConfirmationModal
        open={!!pending}
        title={`Xóa ${pending?.count || 0} thông báo đã chọn?`}
        message={`Các thông báo đã chọn và tệp đính kèm sẽ bị xóa.${pending?.selection.allMatching ? ' Lựa chọn áp dụng cho mọi trang khớp bộ lọc, trừ các tin bạn đã bỏ tick.' : ''} Không thể hoàn tác.`}
        confirmLabel="Xóa đã chọn"
        danger
        error={actionError}
        onConfirm={remove}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
