import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCcw, ClipboardCheck, PackagePlus } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useFilterParams } from '@/hooks/useFilterParams';
import { useRequests, useFacilityLocations } from '@/hooks/facility/useFacility';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { FilterChips } from '@/components/ui/FilterChips';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import { RequestStatusBadge } from '@/components/facility/FacilityBadges';
import { ManagerLinks } from '@/components/facility/ManagerLinks';
import { locationLabel, locationLabelIn, locationBaseLabel } from '@/models/Location';
import { REQUEST_STATUS, REQUEST_STATUS_LABELS, REQUEST_ITEM_MODES } from '@/models/facility/facilityConstants';
import { isPrincipal, canReviewRequest, canPrincipalDecideRequest } from '@/utils/facility/facilityPermissions';
import { requestCrumbs } from '@/utils/facility/breadcrumbs';
import { formatDate } from '@/utils/format';
import { activeFilterKeys } from '@/utils/filterParams';
import '@/styles/modules/facility.css';
import { StatCardIcon } from '@/components/ui/StatCardIcon';

const EMPTY = { status: 'ALL', keyword: '', campusId: '', locationId: '' };

/** Additional facility requests of the VP's campus; the Principal sees both campuses and decides forwarded ones (UC 7.3). */
export default function RequestListPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const navigate = useNavigate();
  const principal = isPrincipal(user);
  const [filters, setFilters] = useFilterParams(principal ? { ...EMPTY, status: REQUEST_STATUS.PENDING_PRINCIPAL } : EMPTY);
  const [page, setPage] = useState(1);
  const { requests, loading, error, reload } = useRequests(filters);
  const { requests: all } = useRequests({});
  const { locations } = useFacilityLocations();

  const set = (patch) => {
    setFilters(patch);
    setPage(1);
  };
  // So với EMPTY (không phải mặc định theo vai trò) để "Chờ Hiệu trưởng" của Hiệu trưởng vẫn hiện chip và đặt lại được
  const filtered = activeFilterKeys(filters, EMPTY).length > 0;
  const count = (s) => all.filter((r) => r.status === s).length;
  const canAct = (r) => canReviewRequest(r, user) || canPrincipalDecideRequest(r, user);
  const waiting = all.filter(canAct).length;
  const stats = [
    { key: 'ALL', label: 'Tổng đề nghị', value: all.length, tone: 'blue' },
    { key: REQUEST_STATUS.SUBMITTED, label: 'Chờ PHT duyệt', value: count(REQUEST_STATUS.SUBMITTED), tone: 'purple' },
    { key: REQUEST_STATUS.PENDING_PRINCIPAL, label: 'Chờ Hiệu trưởng', value: count(REQUEST_STATUS.PENDING_PRINCIPAL), tone: 'purple' },
    { key: REQUEST_STATUS.APPROVED, label: 'Đã duyệt', value: count(REQUEST_STATUS.APPROVED), tone: 'green' },
    { key: REQUEST_STATUS.REJECTED, label: 'Bị từ chối', value: count(REQUEST_STATUS.REJECTED), tone: 'red' },
  ];
  const pageRows = paginate(requests, page);
  const campusLocations = locations.filter((l) => !filters.campusId || l.campusId === filters.campusId);
  const chips = [
    filters.keyword && { key: 'keyword', label: `Từ khóa: ${filters.keyword}`, onRemove: () => set({ keyword: '' }) },
    filters.campusId && {
      key: 'campusId',
      label: `Điểm trường: ${md.campusById(filters.campusId)?.shortName || ''}`,
      onRemove: () => set({ campusId: '' }),
    },
    filters.locationId && {
      key: 'locationId',
      label: `Lớp/phòng: ${locationLabel(md.locationById(filters.locationId))}`,
      onRemove: () => set({ locationId: '' }),
    },
    filters.status !== 'ALL' && {
      key: 'status',
      label: `Trạng thái: ${stats.find((s) => s.key === filters.status)?.label || REQUEST_STATUS_LABELS[filters.status] || filters.status}`,
      onRemove: () => set({ status: 'ALL' }),
    },
  ].filter(Boolean);

  return (
    <div className="page">
      <Breadcrumb items={requestCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Đề nghị bổ sung cơ sở vật chất</h1>
        <ManagerLinks user={user} current="requests" />
      </div>
      {waiting > 0 && (
        <div className="alert alert--purple mb-16">
          <ClipboardCheck size={18} />
          <div>
            Có <b>{waiting}</b> đề nghị bổ sung đang chờ bạn quyết định.
          </div>
        </div>
      )}
      <div className="stat-grid">
        {stats.map((s) => (
          <button
            key={s.key}
            className={`stat-card stat-card--${s.tone} ${filters.status === s.key ? 'stat-card--active' : ''}`}
            onClick={() => set({ status: s.key })}
            aria-pressed={filters.status === s.key}
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
            className="flex-1"
            value={filters.keyword}
            placeholder="Tìm mã, tên tài sản, lý do..."
            label="Tìm kiếm đề nghị bổ sung"
            onSearch={(text) => set({ keyword: text })}
          />
          {principal && (
            <select
              className="select"
              value={filters.campusId}
              onChange={(e) => set({ campusId: e.target.value, locationId: '' })}
              aria-label="Điểm trường"
            >
              <option value="">Tất cả điểm trường</option>
              {md.campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shortName}
                </option>
              ))}
            </select>
          )}
          <select
            className="select"
            value={filters.locationId}
            onChange={(e) => set({ locationId: e.target.value })}
            aria-label="Lớp/phòng"
          >
            <option value="">Tất cả lớp/phòng</option>
            {campusLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {locationLabelIn(l, filters.campusId ? '' : md.campusById(l.campusId)?.shortName)}
                {principal ? ` – ${md.campusById(l.campusId)?.shortName || ''}` : ''}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => set(EMPTY)} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
        </div>
        <FilterChips count={loading ? null : requests.length} unit="đề nghị" chips={chips} />
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tài sản đề nghị</th>
                  <th>Lớp/phòng</th>
                  <th className="num">Số lượng</th>
                  <th>Người đề nghị</th>
                  <th>Ngày gửi</th>
                  <th className="center">Trạng thái</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={5} cols={8} />
                ) : requests.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      {filtered ? (
                        <EmptyState
                          icon={Search}
                          title="Không có đề nghị phù hợp"
                          action={
                            <button className="btn" onClick={() => set(EMPTY)}>
                              <RotateCcw size={15} /> Đặt lại bộ lọc
                            </button>
                          }
                        />
                      ) : (
                        <EmptyState
                          icon={PackagePlus}
                          title="Chưa có đề nghị bổ sung"
                          description="Đề nghị do giáo viên và nhân viên bếp gửi sẽ hiển thị tại đây."
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => {
                    const link = `/facility/requests/${r.id}`;
                    return (
                      <tr key={r.id} className="row-click" onClick={() => navigate(link)}>
                        <td className="fw-600 text-primary nowrap">{r.code}</td>
                        <td className="bh-cell-wrap">
                          {r.itemName}
                          {r.itemMode === REQUEST_ITEM_MODES.NEW && <span className="chip chip--blue bh-ml-1-5">Tài sản mới</span>}
                        </td>
                        <td className="bh-cell-wrap">
                          <div>{(principal ? locationBaseLabel : locationLabel)(md.locationById(r.locationId))}</div>
                          {principal && <div className="muted text-xs">{md.campusById(r.campusId)?.shortName}</div>}
                        </td>
                        <td className="num nowrap">
                          {r.quantity} <span className="muted">{r.unit}</span>
                        </td>
                        <td>{md.userById(r.requesterId)?.fullName || '—'}</td>
                        <td className="nowrap">{formatDate(r.createdAt)}</td>
                        <td className="center">
                          <RequestStatusBadge status={r.status} />
                          {r.proposal && <div className="muted text-xs mt-8">Đề xuất {r.proposal.code}</div>}
                        </td>
                        <td className="cell--actions" onClick={(e) => e.stopPropagation()}>
                          {canAct(r) ? (
                            <button className="btn btn--primary btn--sm" onClick={() => navigate(link)}>
                              <ClipboardCheck size={15} /> Xét duyệt
                            </button>
                          ) : (
                            <RowActions view={{ to: link }} name={r.code} />
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && requests.length > 0 && <Pagination page={page} total={requests.length} onChange={setPage} unit="đề nghị" />}
      </div>
    </div>
  );
}
