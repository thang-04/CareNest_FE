import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Printer, Scale, RotateCcw, ArrowRight, FileStack, PackageCheck, Handshake } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useTransfers } from '@/hooks/facility-transfer/useTransfers';
import { useMasterData } from '@/hooks/useMasterData';
import { useFilterParams } from '@/hooks/useFilterParams';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { FilterChips } from '@/components/ui/FilterChips';
import { FilterMore } from '@/components/ui/FilterMore';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import { TransferStatusBadge } from '@/components/facility-transfer/TransferStatusBadge';
import { formatDate } from '@/utils/format';
import { locationLabel, locationBaseLabel } from '@/models/Location';
import {
  TRANSFER_STATUS,
  TRANSFER_STATUS_LABELS,
  TRANSFER_TYPES,
  TRANSFER_TYPE_LABELS,
  TRANSFER_TYPE_SHORT_LABELS,
  MY_TRANSFER_ROLE_LABELS,
} from '@/models/facility-transfer/transferConstants';
import {
  canCreateTransfer,
  canEditTransfer,
  canResolveDiscrepancy,
  getMyTransferRole,
  isVicePrincipal,
  canHandover,
  canReceive,
  staffTransferPath,
} from '@/utils/facility-transfer/transferPermissions';
import { transferCrumbs } from '@/utils/facility-transfer/breadcrumbs';
import '@/styles/modules/facility-transfer.css';
import { StatCardIcon } from '@/components/ui/StatCardIcon';

const EMPTY_FILTERS = { keyword: '', status: 'ALL', type: 'ALL', fromDate: '', toDate: '' };

const placeText = (md, locationId, campusId, showCampus) => {
  const loc = md.locationById(locationId);
  return (
    <>
      <div>{showCampus ? locationBaseLabel(loc) : locationLabel(loc)}</div>
      {showCampus && <div className="muted text-xs">{md.campusById(campusId)?.shortName}</div>}
    </>
  );
};

/* ---------------- PHT-01 ---------------- */
function VicePrincipalList({ user, md }) {
  const navigate = useNavigate();
  const [filters, setFilters, , activeKeys] = useFilterParams(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const { transfers, loading, error, reload } = useTransfers(filters);
  const { transfers: all } = useTransfers(EMPTY_FILTERS);

  const stats = useMemo(() => {
    const count = (s) => all.filter((t) => t.status === s).length;
    return [
      { status: 'ALL', label: 'Tổng số phiếu', value: all.length, tone: 'blue' },
      { status: TRANSFER_STATUS.PENDING_HANDOVER, label: 'Chờ bàn giao', value: count(TRANSFER_STATUS.PENDING_HANDOVER), tone: 'orange' },
      {
        status: TRANSFER_STATUS.REVISION_REQUESTED,
        label: 'Cần điều chỉnh',
        value: count(TRANSFER_STATUS.REVISION_REQUESTED),
        tone: 'red',
      },
      { status: TRANSFER_STATUS.PENDING_RECEIPT, label: 'Chờ xác nhận nhận', value: count(TRANSFER_STATUS.PENDING_RECEIPT), tone: 'blue' },
      {
        status: TRANSFER_STATUS.PENDING_RESOLUTION,
        label: 'Chờ xử lý chênh lệch',
        value: count(TRANSFER_STATUS.PENDING_RESOLUTION),
        tone: 'purple',
      },
      { status: TRANSFER_STATUS.COMPLETED, label: 'Hoàn thành', value: count(TRANSFER_STATUS.COMPLETED), tone: 'green' },
    ];
  }, [all]);

  const set = (patch) => {
    setFilters(patch);
    setPage(1);
  };
  const dirty = activeKeys.length > 0;
  const rows = paginate(transfers, page);
  const chips = [
    filters.keyword && { key: 'keyword', label: `Từ khóa: ${filters.keyword}`, onRemove: () => set({ keyword: '' }) },
    filters.status !== 'ALL' && {
      key: 'status',
      label: `Trạng thái: ${stats.find((s) => s.status === filters.status)?.label || TRANSFER_STATUS_LABELS[filters.status] || filters.status}`,
      onRemove: () => set({ status: 'ALL' }),
    },
    filters.type !== 'ALL' && {
      key: 'type',
      label: `Loại: ${TRANSFER_TYPE_LABELS[filters.type] || filters.type}`,
      onRemove: () => set({ type: 'ALL' }),
    },
    filters.fromDate && { key: 'fromDate', label: `Từ ngày: ${formatDate(filters.fromDate)}`, onRemove: () => set({ fromDate: '' }) },
    filters.toDate && { key: 'toDate', label: `Đến ngày: ${formatDate(filters.toDate)}`, onRemove: () => set({ toDate: '' }) },
  ].filter(Boolean);

  return (
    <>
      <div className="page__head">
        <h1 className="page__title">Luân chuyển tài sản</h1>
        {canCreateTransfer(user) && (
          <Link to="/facility/transfers/new" className="btn btn--primary btn--lg ft-mt-1-5">
            <Plus size={18} /> Tạo phiếu luân chuyển
          </Link>
        )}
      </div>

      <div className="stat-grid">
        {stats.map((s) => (
          <button
            key={s.status}
            className={`stat-card stat-card--${s.tone} ${filters.status === s.status ? 'stat-card--active' : ''}`}
            onClick={() => set({ status: s.status })}
          >
            <div className="stat-card__value">{s.value}</div>
            <div className="stat-card__label">{s.label}</div>
            <StatCardIcon tone={s.tone} />
          </button>
        ))}
      </div>

      <div className="card">
        <div className="filter-bar">
          <SearchSubmit
            className="ft-search-grow"
            value={filters.keyword}
            placeholder="Tìm mã phiếu, lớp/phòng, tài sản, người thực hiện..."
            label="Tìm kiếm phiếu luân chuyển"
            onSearch={(text) => set({ keyword: text })}
          />
          <FilterMore count={[filters.type !== 'ALL', filters.fromDate, filters.toDate].filter(Boolean).length}>
            <label className="field">
              <span className="field__label">Loại luân chuyển</span>
              <select className="select" value={filters.type} onChange={(e) => set({ type: e.target.value })}>
                <option value="ALL">Tất cả loại luân chuyển</option>
                {Object.values(TRANSFER_TYPES).map((t) => (
                  <option key={t} value={t}>
                    {TRANSFER_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Từ ngày</span>
              <input
                type="date"
                className="input"
                value={filters.fromDate}
                max={filters.toDate || undefined}
                onChange={(e) => set({ fromDate: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field__label">Đến ngày</span>
              <input
                type="date"
                className="input"
                value={filters.toDate}
                min={filters.fromDate || undefined}
                onChange={(e) => set({ toDate: e.target.value })}
              />
            </label>
          </FilterMore>
          <button className="btn" onClick={() => set(EMPTY_FILTERS)} disabled={!dirty}>
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
        </div>
        <FilterChips count={loading ? null : transfers.length} unit="phiếu" chips={chips} />

        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Ngày lập / dự kiến</th>
                  <th>Loại</th>
                  <th>Từ → Đến</th>
                  <th>Bàn giao / Nhận</th>
                  <th className="center">Tài sản</th>
                  <th className="center">Trạng thái</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={6} cols={8} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        icon={FileStack}
                        title={dirty ? 'Không có phiếu phù hợp bộ lọc' : 'Chưa có phiếu luân chuyển'}
                        description={
                          dirty
                            ? 'Thử đổi điều kiện lọc hoặc đặt lại bộ lọc.'
                            : 'Tạo phiếu đầu tiên để điều chuyển tài sản giữa các lớp/phòng.'
                        }
                        action={
                          dirty ? (
                            <button className="btn" onClick={() => set(EMPTY_FILTERS)}>
                              Đặt lại bộ lọc
                            </button>
                          ) : (
                            <Link className="btn btn--primary" to="/facility/transfers/new">
                              <Plus size={16} /> Tạo phiếu
                            </Link>
                          )
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  rows.map((t) => {
                    const inter = t.type === TRANSFER_TYPES.INTER_CAMPUS;
                    const resolve = canResolveDiscrepancy(t, user);
                    return (
                      <tr key={t.id} className="row-click" onClick={() => navigate(`/facility/transfers/${t.id}`)}>
                        <td className="fw-600 text-primary">
                          {t.code}
                          {t.version > 1 && <span className="muted text-xs"> v{t.version}</span>}
                        </td>
                        <td>
                          <div>{formatDate(t.createdDate)}</div>
                          <div className="muted text-xs">Dự kiến {formatDate(t.expectedHandoverDate)}</div>
                        </td>
                        <td className="nowrap" title={TRANSFER_TYPE_LABELS[t.type]}>
                          {TRANSFER_TYPE_SHORT_LABELS[t.type]}
                        </td>
                        <td className="transfer-route">
                          <div>{placeText(md, t.fromLocationId, t.fromCampusId, inter)}</div>
                          <div className="transfer-route__to">
                            <ArrowRight size={14} className="muted" aria-label="đến" />
                            <div>{placeText(md, t.toLocationId, t.toCampusId, inter)}</div>
                          </div>
                        </td>
                        <td className="text-sm">
                          <div>{md.userById(t.handoverUserId)?.fullName || '—'}</div>
                          <div className="muted">{md.userById(t.receiverUserId)?.fullName || '—'}</div>
                        </td>
                        <td className="center">
                          {t.items.length} loại · {t.items.reduce((s, i) => s + i.quantity, 0)}
                        </td>
                        <td className="center">
                          <TransferStatusBadge status={t.status} />
                        </td>
                        <td className="cell--actions" onClick={(e) => e.stopPropagation()}>
                          <div className="row gap-2">
                            {resolve && (
                              <button
                                className="btn btn--primary btn--sm"
                                onClick={() => navigate(`/facility/transfers/${t.id}/discrepancy`)}
                              >
                                <Scale size={15} /> Xử lý chênh lệch
                              </button>
                            )}
                            <RowActions
                              view={resolve ? null : { to: `/facility/transfers/${t.id}`, label: 'Xem chi tiết' }}
                              edit={
                                canEditTransfer(t, user)
                                  ? {
                                      to: `/facility/transfers/${t.id}/edit`,
                                      label: t.status === TRANSFER_STATUS.DRAFT ? 'Sửa nháp' : 'Điều chỉnh',
                                    }
                                  : null
                              }
                              menu={
                                t.status !== TRANSFER_STATUS.DRAFT
                                  ? [{ label: 'In / Xuất phiếu', icon: Printer, to: `/facility/transfers/${t.id}/print` }]
                                  : []
                              }
                              name={t.code}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && transfers.length > 0 && <Pagination page={page} total={transfers.length} onChange={setPage} unit="phiếu" />}
      </div>
    </>
  );
}

/* ---------------- STAFF-01 ---------------- */
const STAFF_TABS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: TRANSFER_STATUS.PENDING_HANDOVER, label: 'Chờ bàn giao' },
  { key: TRANSFER_STATUS.PENDING_RECEIPT, label: 'Chờ xác nhận nhận' },
  { key: TRANSFER_STATUS.REVISION_REQUESTED, label: 'Cần điều chỉnh' },
  { key: TRANSFER_STATUS.COMPLETED, label: 'Hoàn thành' },
];

function StaffList({ user, md }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('ALL');
  const [keyword, setKeyword] = useState('');
  const { transfers, loading, error, reload } = useTransfers({ keyword });

  const count = (key) => (key === 'ALL' ? transfers.length : transfers.filter((t) => t.status === key).length);
  const rows = tab === 'ALL' ? transfers : transfers.filter((t) => t.status === tab);
  const todo = transfers.filter((t) => canHandover(t, user) || canReceive(t, user)).length;

  // Nút nghiệp vụ chính của dòng; không có thì dòng chỉ còn icon Xem
  const actionFor = (t) => {
    if (canHandover(t, user))
      return (
        <button className="btn btn--primary btn--sm" onClick={() => navigate(staffTransferPath(t, user))}>
          <Handshake size={15} /> Bàn giao
        </button>
      );
    if (canReceive(t, user))
      return (
        <button className="btn btn--primary btn--sm" onClick={() => navigate(staffTransferPath(t, user))}>
          <PackageCheck size={15} /> Xác nhận nhận
        </button>
      );
    return null;
  };

  return (
    <>
      <div className="page__head">
        <h1 className="page__title">Phiếu luân chuyển của tôi</h1>
      </div>
      {todo > 0 && (
        <div className="alert alert--info mb-16">
          Bạn có <b>{todo}</b> phiếu cần xử lý. Người bàn giao kiểm tra và ký bàn giao; người nhận chỉ xác nhận được sau khi người bàn giao
          đã ký.
        </div>
      )}
      <div className="card">
        <div className="row row--between ft-tabs-bar">
          <div className="tabs" role="tablist">
            {STAFF_TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                className={`tab ${tab === t.key ? 'tab--active' : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label} <span className="tab__count">{count(t.key)}</span>
              </button>
            ))}
          </div>
          <SearchSubmit
            className="ft-search-staff"
            value={keyword}
            placeholder="Tìm mã phiếu, tài sản..."
            label="Tìm kiếm phiếu luân chuyển"
            onSearch={setKeyword}
          />
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Ngày lập</th>
                  <th>Nơi đi</th>
                  <th>Nơi đến</th>
                  <th>Vai trò của tôi</th>
                  <th className="center">Trạng thái</th>
                  <th>Ngày dự kiến</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={4} cols={8} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        icon={FileStack}
                        title="Không có phiếu nào"
                        description="Các phiếu luân chuyển bạn được phân công bàn giao hoặc nhận sẽ hiển thị tại đây."
                      />
                    </td>
                  </tr>
                ) : (
                  rows.map((t) => {
                    const role = getMyTransferRole(t, user);
                    const inter = t.type === TRANSFER_TYPES.INTER_CAMPUS;
                    const action = actionFor(t);
                    return (
                      <tr key={t.id} className="row-click" onClick={() => navigate(staffTransferPath(t, user))}>
                        <td className="fw-600 text-primary">{t.code}</td>
                        <td>{formatDate(t.createdDate)}</td>
                        <td>{placeText(md, t.fromLocationId, t.fromCampusId, inter)}</td>
                        <td>{placeText(md, t.toLocationId, t.toCampusId, inter)}</td>
                        <td>
                          <span className="chip chip--teal">{MY_TRANSFER_ROLE_LABELS[role]}</span>
                        </td>
                        <td className="center">
                          <TransferStatusBadge status={t.status} />
                        </td>
                        <td>{formatDate(t.expectedHandoverDate)}</td>
                        <td className="cell--actions" onClick={(e) => e.stopPropagation()}>
                          <span className="row gap-1 ft-justify-center">
                            {action}
                            <RowActions
                              view={action ? null : { to: staffTransferPath(t, user) }}
                              menu={[{ label: 'In / Xuất phiếu', icon: Printer, to: `/facility/transfers/${t.id}/print` }]}
                              name={t.code}
                            />
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/** PHT-01 for the Vice Principal, STAFF-01 for teachers / kitchen staff. */
export default function TransferListPage() {
  const { user } = useAuth();
  const md = useMasterData();
  return (
    <div className="page">
      <Breadcrumb items={transferCrumbs()} />
      {isVicePrincipal(user) ? <VicePrincipalList user={user} md={md} /> : <StaffList user={user} md={md} />}
    </div>
  );
}
