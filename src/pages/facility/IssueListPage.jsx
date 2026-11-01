import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RotateCcw, ClipboardCheck, ClipboardList } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useFilterParams } from '@/hooks/useFilterParams';
import { useIssues, useFacilityLocations } from '@/hooks/facility/useFacility';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { FilterChips } from '@/components/ui/FilterChips';
import { FilterMore } from '@/components/ui/FilterMore';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import { IssueStatusBadge, IssueTypeChip, LockChip } from '@/components/facility/FacilityBadges';
import { ManagerLinks } from '@/components/facility/ManagerLinks';
import { locationLabel, locationLabelIn, locationBaseLabel } from '@/models/Location';
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
  const [filters, setFilters, , activeKeys] = useFilterParams(EMPTY);
  const [page, setPage] = useState(1);
  const { issues, loading, error, reload } = useIssues(filters);
  const { issues: all } = useIssues({});
  const { locations } = useFacilityLocations();
  const principal = isPrincipal(user);

  const set = (patch) => {
    setFilters(patch);
    setPage(1);
  };
  const filtered = activeKeys.length > 0;
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
    filters.type && {
      key: 'type',
      label: `Loại sự cố: ${ISSUE_TYPE_LABELS[filters.type] || filters.type}`,
      onRemove: () => set({ type: '' }),
    },
    filters.status !== 'ALL' && {
      key: 'status',
      label: `Trạng thái: ${stats.find((s) => s.key === filters.status)?.label || ISSUE_STATUS_LABELS[filters.status] || filters.status}`,
      onRemove: () => set({ status: 'ALL' }),
    },
  ].filter(Boolean);

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
          <SearchSubmit
            className="flex-1"
            value={filters.keyword}
            placeholder="Tìm mã báo cáo, tài sản, mô tả..."
            label="Tìm kiếm báo cáo sự cố"
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
          <FilterMore count={filters.type ? 1 : 0}>
            <label className="field">
              <span className="field__label">Loại sự cố</span>
              <select className="select" value={filters.type} onChange={(e) => set({ type: e.target.value })}>
                <option value="">Tất cả loại sự cố</option>
                {Object.entries(ISSUE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </FilterMore>
          <button className="btn" onClick={() => set(EMPTY)} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
        </div>
        <FilterChips count={loading ? null : issues.length} unit="báo cáo" chips={chips} />
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tài sản</th>
                  <th>Lớp/phòng</th>
                  <th>Sự cố</th>
                  <th>Người báo</th>
                  <th>Ngày gửi</th>
                  <th className="center">Trạng thái</th>
                  <th className="cell--actions">Thao tác</th>
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
                          <div>{(principal ? locationBaseLabel : locationLabel)(md.locationById(i.locationId))}</div>
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
                        <td className="center">
                          <IssueStatusBadge status={i.status} />
                          {i.proposal && <div className="muted text-xs mt-8">Đề xuất {i.proposal.code}</div>}
                        </td>
                        <td className="cell--actions" onClick={(e) => e.stopPropagation()}>
                          {decide ? (
                            <button className="btn btn--sm btn--primary" onClick={() => navigate(link)}>
                              <ClipboardCheck size={15} /> Xét duyệt
                            </button>
                          ) : (
                            <RowActions view={{ to: link }} name={i.code} />
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
