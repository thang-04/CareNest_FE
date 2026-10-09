import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCcw, Eye, ClipboardCheck, ClipboardList } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useIssues, useFacilityLocations } from '@/hooks/facility/useFacility';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { IssueStatusBadge, IssueTypeChip, LockChip } from '@/components/facility/FacilityBadges';
import { ManagerLinks } from '@/components/facility/ManagerLinks';
import { locationLabel } from '@/models/Location';
import { ISSUE_STATUS, ISSUE_STATUS_LABELS, ISSUE_TYPE_LABELS, ISSUE_TYPES } from '@/models/facility/facilityConstants';
import { isPrincipal, canDecideIssue } from '@/utils/facility/facilityPermissions';
import { issueCrumbs } from '@/utils/facility/breadcrumbs';
import { formatDate } from '@/utils/format';
import '@/styles/modules/facility.css';
import { StatCardIcon } from '@/components/ui/StatCardIcon';

const EMPTY = { status: 'ALL', keyword: '', type: '', campusId: '', locationId: '' };

const qtyText = (i) =>
  i.type === ISSUE_TYPES.INSUFFICIENT ? `Có ${i.currentQuantity}, cần thêm ${i.quantity}` : `${i.quantity} ${i.unit.toLowerCase()}`;

/** #117 Facility Issue List: reports of the VP's campus (Principal: both campuses, view only – GBR-FAC-06). */
export default function IssueListPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const { issues, loading, error, reload } = useIssues(filters);
  const { issues: all } = useIssues({});
  const { locations } = useFacilityLocations();
  const principal = isPrincipal(user);

  const set = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const filtered = filters.status !== 'ALL' || filters.keyword || filters.type || filters.campusId || filters.locationId;
  const count = (s) => all.filter((i) => i.status === s).length;
  const waiting = all.filter((i) => canDecideIssue(i, user)).length;
  const stats = [
    { key: 'ALL', label: 'Tổng báo cáo', value: all.length, tone: 'blue' },
    { key: ISSUE_STATUS.SUBMITTED, label: 'Chờ duyệt', value: count(ISSUE_STATUS.SUBMITTED), tone: 'purple' },
    { key: ISSUE_STATUS.APPROVED, label: 'Đã duyệt', value: count(ISSUE_STATUS.APPROVED), tone: 'green' },
    { key: ISSUE_STATUS.REJECTED, label: 'Bị từ chối', value: count(ISSUE_STATUS.REJECTED), tone: 'red' },
  ];
  const pageRows = paginate(issues, page);
  const campusLocations = locations.filter((l) => !filters.campusId || l.campusId === filters.campusId);

  return (
    <div className="page">
      <Breadcrumb items={issueCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Báo cáo sự cố cơ sở vật chất</h1>
        <ManagerLinks user={user} current="issues" />
      </div>
      {waiting > 0 && (
        <div className="alert alert--purple mb-16">
          <ClipboardCheck size={18} />
          <div>
            Có <b>{waiting}</b> báo cáo sự cố đang chờ bạn duyệt.
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
              placeholder="Tìm mã báo cáo, tài sản, mô tả..."
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
          <select className="select" value={filters.type} onChange={(e) => set({ type: e.target.value })} aria-label="Loại sự cố">
            <option value="">Tất cả loại sự cố</option>
            {Object.entries(ISSUE_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select className="select" value={filters.status} onChange={(e) => set({ status: e.target.value })} aria-label="Trạng thái">
            <option value="ALL">Tất cả trạng thái</option>
            {Object.entries(ISSUE_STATUS_LABELS).map(([k, v]) => (
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
                  <th>Tài sản</th>
                  <th>Lớp/phòng</th>
                  <th>Sự cố</th>
                  <th>Người báo</th>
                  <th>Ngày gửi</th>
                  <th>Trạng thái</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={5} cols={8} />
                ) : issues.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      {filtered ? (
                        <EmptyState
                          icon={Search}
                          title="Không có báo cáo phù hợp"
                          action={
                            <button className="btn" onClick={() => set(EMPTY)}>
                              <RotateCcw size={15} /> Đặt lại bộ lọc
                            </button>
                          }
                        />
                      ) : (
                        <EmptyState
                          icon={ClipboardList}
                          title="Chưa có báo cáo sự cố"
                          description="Báo cáo do giáo viên và nhân viên bếp gửi sẽ hiển thị tại đây."
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((i) => {
                    const link = `/facility/issues/${i.id}`;
                    const decide = canDecideIssue(i, user);
                    return (
                      <tr key={i.id} className="row-click" onClick={() => navigate(link)}>
                        <td className="fw-600 text-primary nowrap">{i.code}</td>
                        <td className="bh-cell-wrap">
                          {i.assetName} <span className="muted text-xs">· {i.assetCode}</span>
                        </td>
                        <td className="bh-cell-wrap">
                          <div>{locationLabel(md.locationById(i.locationId))}</div>
                          {principal && <div className="muted text-xs">{md.campusById(i.campusId)?.shortName}</div>}
                          {i.lockedBy && i.status === ISSUE_STATUS.SUBMITTED && (
                            <div className="mt-8">
                              <LockChip code={i.lockedBy} />
                            </div>
                          )}
                        </td>
                        <td>
                          <IssueTypeChip type={i.type} />
                          <div className="muted text-xs mt-8">{qtyText(i)}</div>
                        </td>
                        <td>
                          {md.userById(i.reporterId)?.fullName || '—'}
                          {i.linkedReports.length > 0 && <div className="muted text-xs">+{i.linkedReports.length} người báo trùng</div>}
                        </td>
                        <td className="nowrap">{formatDate(i.createdAt)}</td>
                        <td>
                          <IssueStatusBadge status={i.status} />
                          {i.proposal && <div className="muted text-xs mt-8">Đề xuất {i.proposal.code}</div>}
                        </td>
                        <td className="center nowrap" onClick={(e) => e.stopPropagation()}>
                          {decide ? (
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
        {!loading && issues.length > 0 && <Pagination page={page} total={issues.length} onChange={setPage} unit="báo cáo" />}
      </div>
    </div>
  );
}
