import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RotateCcw } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSuppliers } from '@/hooks/kitchen/useKitchen';
import { useFilterParams } from '@/hooks/useFilterParams';
import { Button, DataTable, LABELS, ListPage, RowActions, SelectField } from '@/components';
import { FilterChips } from '@/components/ui/FilterChips';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { SupplierStatusBadge } from '@/components/kitchen/KitchenBadges';
import { SupplierEditModal } from '@/components/kitchen/SupplierEditModal';
import { canEditSuppliers } from '@/services/kitchen/kitchenService';
import { supplierCrumbs } from '@/utils/kitchen/breadcrumbs';
import { SUPPLIER_STATUS_LABELS } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

const PAGE = 10;
const FILTER_DEFAULTS = { keyword: '', status: '' };
const STATUS_OPTIONS = Object.entries(SUPPLIER_STATUS_LABELS).map(([value, label]) => ({ value, label }));
const dash = (value) => value || <span className="muted">—</span>;

/**
 * Danh mục nhà cung cấp (BA 01 Supplier List): HT thêm/sửa; PHT chỉ xem để đối chiếu khi nhập kho.
 * Màn mẫu cho khung danh sách chuẩn: ListPage + thanh lọc + DataTable (xem /ui-kit#primitives).
 */
export default function SupplierListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = canEditSuppliers(user);
  const [filters, setFilters, resetFilters, activeKeys] = useFilterParams(FILTER_DEFAULTS);
  const { keyword, status } = filters;
  const [page, setPage] = useState(1);
  // null = đóng; '' = thêm mới; id = sửa nhà cung cấp đó trong modal
  const [editing, setEditing] = useState(null);
  const { data, loading, error, reload } = useSuppliers({ keyword, status });
  const filtered = activeKeys.length > 0;
  const change = (key) => (v) => {
    setFilters({ [key]: v });
    setPage(1);
  };
  const reset = () => {
    resetFilters();
    setPage(1);
  };
  const chipLabels = { keyword: `Từ khóa: ${keyword}`, status: `Trạng thái: ${SUPPLIER_STATUS_LABELS[status] || status}` };
  const chips = activeKeys.map((k) => ({ key: k, label: chipLabels[k], onRemove: () => change(k)('') }));
  const addButton = canManage && (
    <Button variant="primary" icon={Plus} onClick={() => setEditing('')}>
      Thêm nhà cung cấp
    </Button>
  );
  const resetButton = (
    <Button icon={RotateCcw} onClick={reset}>
      {LABELS.resetFilters}
    </Button>
  );

  const columns = [
    { key: 'code', header: 'Mã NCC', className: 'center', render: (s) => <span className="fw-600 text-primary">{dash(s.code)}</span> },
    { key: 'name', header: 'Tên nhà cung cấp' },
    { key: 'contactName', header: 'Người liên hệ', render: (s) => dash(s.contactName) },
    { key: 'phone', header: 'Số điện thoại', className: 'center nowrap', render: (s) => dash(s.phone) },
    { key: 'receiptCount', header: 'Số phiếu nhập', className: 'num' },
    { key: 'status', header: 'Trạng thái', className: 'center', render: (s) => <SupplierStatusBadge status={s.status} /> },
    // Chỉ xem ⇒ bỏ cột Thao tác; bấm dòng vẫn mở chi tiết
    ...(canManage
      ? [
          {
            key: 'actions',
            header: 'Thao tác',
            className: 'cell--actions',
            render: (s) => <RowActions edit={{ onClick: () => setEditing(s.id) }} name={s.name} />,
          },
        ]
      : []),
  ];
  const empty = filtered
    ? { title: LABELS.noResults, description: 'Thử đổi từ khóa hoặc trạng thái.', action: resetButton }
    : {
        title: 'Chưa có nhà cung cấp nào',
        description: canManage
          ? 'Thêm nhà cung cấp để phó hiệu trưởng chọn khi lập phiếu nhập kho.'
          : 'Hiệu trưởng chưa thêm nhà cung cấp nào.',
        action: addButton,
      };

  return (
    <>
      <ListPage
        crumbs={supplierCrumbs()}
        title="Nhà cung cấp"
        filters={
          <>
            <div className="filter-bar filter-bar--aligned">
              <SearchSubmit
                className="flex-1"
                value={keyword}
                placeholder="Tìm tên hoặc mã nhà cung cấp"
                label="Tìm nhà cung cấp"
                onSearch={change('keyword')}
              />
              <SelectField
                aria-label="Trạng thái"
                value={status}
                onChange={(e) => change('status')(e.target.value)}
                placeholder="Tất cả trạng thái"
                options={STATUS_OPTIONS}
              />
              <Button icon={RotateCcw} onClick={reset} disabled={!filtered}>
                {LABELS.resetFilters}
              </Button>
              {canManage && <div className="filter-bar__end">{addButton}</div>}
            </div>
            <FilterChips count={loading ? null : (data || []).length} unit="nhà cung cấp" chips={chips} />
          </>
        }
      >
        <DataTable
          columns={columns}
          rows={data}
          loading={loading}
          error={error}
          onRetry={reload}
          empty={empty}
          onRowClick={(s) => navigate(`/menu/suppliers/${s.id}`)}
          page={page}
          onPageChange={setPage}
          pageSize={PAGE}
          unit="nhà cung cấp"
        />
      </ListPage>
      {editing !== null && (
        <SupplierEditModal supplierId={editing} onClose={() => setEditing(null)} onSaved={() => reload({ silent: true })} />
      )}
    </>
  );
}
