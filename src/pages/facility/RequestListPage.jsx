import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCcw, Eye, ClipboardCheck, PackagePlus } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useRequests, useFacilityLocations } from '@/hooks/facility/useFacility';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { RequestStatusBadge } from '@/components/facility/FacilityBadges';
import { ManagerLinks } from '@/components/facility/ManagerLinks';
import { locationLabel } from '@/models/Location';
import { REQUEST_STATUS, REQUEST_STATUS_LABELS, REQUEST_ITEM_MODES } from '@/models/facility/facilityConstants';
import { isPrincipal, canReviewRequest, canPrincipalDecideRequest } from '@/utils/facility/facilityPermissions';
import { requestCrumbs } from '@/utils/facility/breadcrumbs';
import { formatDate } from '@/utils/format';
import '@/styles/modules/facility.css';
import { StatCardIcon } from '@/components/ui/StatCardIcon';

const EMPTY = { status: 'ALL', keyword: '', campusId: '', locationId: '' };

/** Additional facility requests of the VP's campus; the Principal sees both campuses and decides forwarded ones (UC 7.3). */
export default function RequestListPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const navigate = useNavigate();
  const principal = isPrincipal(user);
  const [filters, setFilters] = useState(principal ? { ...EMPTY, status: REQUEST_STATUS.PENDING_PRINCIPAL } : EMPTY);
  const [page, setPage] = useState(1);
  const { requests, loading, error, reload } = useRequests(filters);
  const { requests: all } = useRequests({});
  const { locations } = useFacilityLocations();

  const set = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const filtered = filters.status !== 'ALL' || filters.keyword || filters.campusId || filters.locationId;
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
          <label className="search-box" style={{ flex: 1, minWidth: 200 }}>
            <Search size={17} className="muted" />
            <input
              placeholder="Tìm mã, tên tài sản, lý do..."
              value={filters.keyword}
              onChange={(e) => set({ keyword: e.target.value })}
              aria-label="Tìm kiếm"
            />
          </label>
          {principal && (
            <select
              className="select"
              value={filters.campusId}
              onChange={(e) => set({ campusId: e.target.value, locationId: '' })}
              aria-label="Campus"
            >
              <option value="">Tất cả campus</option>
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
                {locationLabel(l)}
                {principal ? ` – ${md.campusById(l.campusId)?.shortName || ''}` : ''}
              </option>
            ))}
          </select>
          <select className="select" value={filters.status} onChange={(e) => set({ status: e.target.value })} aria-label="Trạng thái">
            <option value="ALL">Tất cả trạng thái</option>
            {Object.entries(REQUEST_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => set(EMPTY)} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại
          </button>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderTop: '1px solid var(--border)', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tài sản đề nghị</th>
                  <th>Lớp/phòng</th>
                  <th className="right">Số lượng</th>
                  <th>Người đề nghị</th>
                  <th>Ngày gửi</th>
                  <th>Trạng thái</th>
                  <th className="center">Thao tác</th>
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
                          {r.itemMode === REQUEST_ITEM_MODES.NEW && (
                            <span className="chip chip--blue" style={{ marginLeft: 6 }}>
                              Tài sản mới
                            </span>
                          )}
                        </td>
                        <td className="bh-cell-wrap">
                          <div>{locationLabel(md.locationById(r.locationId))}</div>
                          {principal && <div className="muted text-xs">{md.campusById(r.campusId)?.shortName}</div>}
                        </td>
                        <td className="right nowrap">
                          {r.quantity} <span className="muted">{r.unit}</span>
                        </td>
                        <td>{md.userById(r.requesterId)?.fullName || '—'}</td>
                        <td className="nowrap">{formatDate(r.createdAt)}</td>
                        <td>
                          <RequestStatusBadge status={r.status} />
                          {r.proposal && <div className="muted text-xs mt-8">Đề xuất {r.proposal.code}</div>}
                        </td>
                        <td className="center nowrap" onClick={(e) => e.stopPropagation()}>
                          {canAct(r) ? (
                            <button className="btn btn--sm btn--primary" onClick={() => navigate(link)}>
                              <ClipboardCheck size={15} /> Xét duyệt
                            </button>
                          ) : (
                            <button className="btn btn--sm" onClick={() => navigate(link)}>
                              <Eye size={15} /> Xem
                            </button>
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
