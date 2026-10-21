import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Pencil, Plus, RotateCcw } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSuppliers } from '@/hooks/kitchen/useKitchen';
import { useFilterParams } from '@/hooks/useFilterParams';
import { Breadcrumb, EmptyState, ErrorState, Pagination, RowMenu, SkeletonRows, paginate } from '@/components';
import { FilterChips } from '@/components/ui/FilterChips';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { SupplierStatusBadge } from '@/components/kitchen/KitchenBadges';
import { canManageSuppliers } from '@/utils/kitchen/kitchenPermissions';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { clickableRowProps } from '@/utils/clickableRow';
import { SUPPLIER_STATUS_LABELS } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

const PAGE = 10;
const FILTER_DEFAULTS = { keyword: '', status: '' };

/** Danh mục nhà cung cấp (BA 01 Supplier List): HT thêm/sửa; PHT chỉ xem để đối chiếu khi nhập kho. */
export default function SupplierListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = canManageSuppliers(user);
  const [filters, setFilters, resetFilters, activeKeys] = useFilterParams(FILTER_DEFAULTS);
  const { keyword, status } = filters;
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useSuppliers({ keyword, status });
  const rows = data || [];
  const filtered = activeKeys.length > 0;
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / PAGE)));
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
  const open = (s) => navigate(`/kitchen/suppliers/${s.id}`);

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.suppliers)} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Nhà cung cấp</h1>
          <p className="page__desc">
            {canManage
              ? 'Thông tin cơ bản của nhà cung cấp; phó hiệu trưởng chọn nhà cung cấp đang dùng khi lập phiếu nhập kho.'
              : 'Danh mục do hiệu trưởng quản lý; chọn nhà cung cấp đang dùng khi lập phiếu nhập kho.'}
          </p>
        </div>
        {canManage && (
          <div className="page__actions">
            <Link className="btn btn--primary" to="/kitchen/suppliers/new">
              <Plus size={16} /> Thêm nhà cung cấp
            </Link>
          </div>
        )}
      </div>
      <section className="card">
        <div className="filter-bar">
          <SearchSubmit
            className="flex-1"
            value={keyword}
            placeholder="Tìm tên hoặc mã nhà cung cấp"
            label="Tìm nhà cung cấp"
            onSearch={change('keyword')}
          />
          <select className="select" value={status} onChange={(e) => change('status')(e.target.value)} aria-label="Trạng thái">
            <option value="">Tất cả trạng thái</option>
            {Object.entries(SUPPLIER_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button type="button" className="btn" onClick={reset} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
        </div>
        <FilterChips count={loading ? null : rows.length} unit="nhà cung cấp" chips={chips} />
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Mã NCC</th>
                  <th>Tên nhà cung cấp</th>
                  <th>Người liên hệ</th>
                  <th>Số điện thoại</th>
                  <th className="num">Số phiếu nhập</th>
                  <th className="center">Trạng thái</th>
                  <th className="td-num-col cell--actions" aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <SkeletonRows rows={5} cols={7} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        title={filtered ? 'Không có kết quả phù hợp' : 'Chưa có nhà cung cấp nào'}
                        description={
                          filtered
                            ? 'Thử đổi từ khóa hoặc trạng thái.'
                            : canManage
                              ? 'Thêm nhà cung cấp để phó hiệu trưởng chọn khi lập phiếu nhập kho.'
                              : 'Hiệu trưởng chưa thêm nhà cung cấp nào.'
                        }
                        action={
                          filtered ? (
                            <button className="btn" onClick={reset}>
                              <RotateCcw size={15} /> Đặt lại bộ lọc
                            </button>
                          ) : (
                            canManage && (
                              <Link className="btn btn--primary" to="/kitchen/suppliers/new">
                                <Plus size={16} /> Thêm nhà cung cấp
                              </Link>
                            )
                          )
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  paginate(rows, safePage, PAGE).map((s) => (
                    <tr key={s.id} className="row-click" {...clickableRowProps(() => open(s))}>
                      <td className="fw-600 text-primary">{s.code}</td>
                      <td>{s.name}</td>
                      <td>{s.contactName || <span className="muted">—</span>}</td>
                      <td className="nowrap">{s.phone || <span className="muted">—</span>}</td>
                      <td className="num">{s.receiptCount}</td>
                      <td className="center">
                        <SupplierStatusBadge status={s.status} />
                      </td>
                      <td className="td-num-col cell--actions">
                        <RowMenu
                          label={`Thao tác ${s.name}`}
                          items={[
                            { label: 'Xem chi tiết', to: `/kitchen/suppliers/${s.id}`, icon: Eye },
                            ...(canManage ? [{ label: 'Sửa', to: `/kitchen/suppliers/${s.id}/edit`, icon: Pencil }] : []),
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rows.length > 0 && (
          <Pagination page={safePage} total={rows.length} onChange={setPage} pageSize={PAGE} unit="nhà cung cấp" />
        )}
      </section>
    </div>
  );
}
