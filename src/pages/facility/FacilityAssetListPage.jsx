import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, RotateCcw, AlertTriangle, PackagePlus, History, Info, Lock, Boxes, ClipboardList } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useFacilityAssets, useFacilityLocations } from '@/hooks/facility/useFacility';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { AssetThumb, ConditionBadge } from '@/components/asset/AssetVisuals';
import { LockChip } from '@/components/facility/FacilityBadges';
import { locationLabel } from '@/models/Location';
import { ASSET_CONDITION_LABELS } from '@/models/Asset';
import { isPrincipal, isManager, canReportIssue, canCreateRequest } from '@/utils/facility/facilityPermissions';
import { assetCrumbs } from '@/utils/facility/breadcrumbs';
import '@/styles/modules/facility.css';
import { StatCardIcon } from '@/components/ui/StatCardIcon';

const EMPTY_FILTERS = { keyword: '', campusId: '', locationId: '', categoryId: '', condition: '' };

/** #109 Facility List: assets of the user's class / kitchen (staff), campus (VP) or school (Principal). */
export default function FacilityAssetListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const md = useMasterData();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [openOnly, setOpenOnly] = useState(false);
  const [page, setPage] = useState(1);
  const { assets, loading, error, reload } = useFacilityAssets(filters);
  const { assets: all } = useFacilityAssets({});
  const { locations } = useFacilityLocations();
  const reporter = canReportIssue(user);
  const manager = isManager(user);

  const rows = useMemo(() => (openOnly ? assets.filter((a) => a.openIssueCount > 0) : assets), [assets, openOnly]);
  const pageRows = paginate(rows, page);
  const lockedRooms = useMemo(() => {
    const map = {};
    all.forEach((a) => {
      if (a.lockedBy) map[a.locationId] = a.lockedBy;
    });
    return Object.entries(map);
  }, [all]);

  const set = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const reset = () => {
    setFilters(EMPTY_FILTERS);
    setOpenOnly(false);
    setPage(1);
  };
  const filtered = openOnly || Object.values(filters).some(Boolean);

  const stats = [
    { key: 'ALL', label: 'Loại tài sản', value: all.length, tone: 'blue', active: !filters.condition && !openOnly },
    {
      key: 'NEED_REPAIR',
      label: 'Cần sửa chữa',
      value: all.filter((a) => a.condition === 'NEED_REPAIR').length,
      tone: 'orange',
      active: filters.condition === 'NEED_REPAIR',
    },
    {
      key: 'BROKEN',
      label: 'Hỏng',
      value: all.filter((a) => a.condition === 'BROKEN').length,
      tone: 'red',
      active: filters.condition === 'BROKEN',
    },
    { key: 'OPEN', label: 'Có báo cáo chờ duyệt', value: all.filter((a) => a.openIssueCount > 0).length, tone: 'purple', active: openOnly },
  ];
  const pickStat = (key) => {
    setOpenOnly(key === 'OPEN');
    set({ condition: ['NEED_REPAIR', 'BROKEN'].includes(key) ? key : '' });
  };

  const campusLocations = locations.filter((l) => !filters.campusId || l.campusId === filters.campusId);
  const colCount = reporter ? 8 : 7;

  return (
    <div className="page">
      <Breadcrumb items={assetCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">{reporter ? 'Tài sản lớp/phòng của tôi' : 'Danh sách tài sản'}</h1>
        <div className="row row--wrap" style={{ gap: 8, marginTop: 6, justifyContent: 'flex-end' }}>
          {reporter && (
            <>
              <Link className="btn" to="/facility/my-reports">
                <History size={16} /> Lịch sử báo cáo
              </Link>
              {canCreateRequest(user) && (
                <Link className="btn" to="/facility/requests/new">
                  <PackagePlus size={16} /> Đề nghị bổ sung
                </Link>
              )}
              <Link className="btn btn--primary" to="/facility/issues/new">
                <AlertTriangle size={16} /> Báo sự cố
              </Link>
            </>
          )}
          {manager && (
            <Link className="btn" to="/facility/issues">
              <ClipboardList size={16} /> Báo cáo sự cố
            </Link>
          )}
        </div>
      </div>

      {reporter && (
        <div className="alert alert--info mb-16">
          <Info size={18} />
          <div>
            Danh sách tài sản của lớp/phòng bạn phụ trách: tên, số lượng và tình trạng. Thấy tài sản hư hỏng, bị mất hoặc không đủ dùng, bấm{' '}
            <b>Báo sự cố</b> ở dòng tài sản đó. Tình trạng chỉ thay đổi sau khi Phó hiệu trưởng duyệt báo cáo.
          </div>
        </div>
      )}
      {lockedRooms.length > 0 && (
        <div className="alert alert--warning mb-16">
          <Lock size={18} />
          <div>
            Đang kiểm kê:{' '}
            {lockedRooms.map(([locId, code], i) => (
              <span key={locId}>
                {i > 0 && ', '}
                <b>{locationLabel(md.locationById(locId))}</b> ({code})
              </span>
            ))}
            . Số lượng, tình trạng của các phòng này tạm khóa đến khi đợt kiểm kê hoàn tất; bạn vẫn báo sự cố được bình thường.
          </div>
        </div>
      )}

      <div className="stat-grid">
        {stats.map((s) => (
          <button
            key={s.key}
            className={`stat-card stat-card--${s.tone} ${s.active ? 'stat-card--active' : ''}`}
            onClick={() => pickStat(s.key)}
            aria-pressed={s.active}
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
              placeholder="Tìm mã hoặc tên tài sản..."
              value={filters.keyword}
              onChange={(e) => set({ keyword: e.target.value })}
              aria-label="Tìm tài sản"
            />
          </label>
          {isPrincipal(user) && (
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
          {campusLocations.length > 1 && (
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
                  {isPrincipal(user) ? ` – ${md.campusById(l.campusId)?.shortName || ''}` : ''}
                </option>
              ))}
            </select>
          )}
          <select
            className="select"
            value={filters.categoryId}
            onChange={(e) => set({ categoryId: e.target.value })}
            aria-label="Nhóm tài sản"
          >
            <option value="">Tất cả nhóm</option>
            {md.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="select" value={filters.condition} onChange={(e) => set({ condition: e.target.value })} aria-label="Tình trạng">
            <option value="">Tất cả tình trạng</option>
            {Object.entries(ASSET_CONDITION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className="btn" onClick={reset} disabled={!filtered}>
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
                  <th>Nhóm</th>
                  <th>Lớp/phòng</th>
                  <th className="right">Số lượng</th>
                  <th>Tình trạng</th>
                  <th>Báo cáo chờ duyệt</th>
                  {reporter && <th className="center">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={5} cols={colCount} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={colCount}>
                      {filtered ? (
                        <EmptyState
                          icon={Search}
                          title="Không có tài sản phù hợp"
                          description="Thử bỏ bớt điều kiện lọc."
                          action={
                            <button className="btn" onClick={reset}>
                              <RotateCcw size={15} /> Đặt lại bộ lọc
                            </button>
                          }
                        />
                      ) : (
                        <EmptyState
                          icon={Boxes}
                          title="Chưa có tài sản"
                          description={
                            reporter
                              ? 'Bạn chưa được phân công lớp/phòng nào có tài sản. Liên hệ Phó hiệu trưởng nếu thông tin chưa đúng.'
                              : 'Chưa có tài sản nào trong phạm vi bạn quản lý.'
                          }
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((a) => (
                    <tr key={a.id}>
                      <td className="fw-600 text-primary nowrap">{a.code}</td>
                      <td>
                        <div className="row" style={{ gap: 10 }}>
                          <AssetThumb asset={a} size="sm" />
                          <span>{a.name}</span>
                        </div>
                      </td>
                      <td className="text-sm">{md.categoryById(a.categoryId)?.name || '—'}</td>
                      <td className="bh-cell-wrap">
                        <div>{locationLabel(md.locationById(a.locationId))}</div>
                        {manager && <div className="muted text-xs">{md.campusById(a.campusId)?.shortName}</div>}
                        {a.lockedBy && (
                          <div className="mt-8">
                            <LockChip code={a.lockedBy} />
                          </div>
                        )}
                      </td>
                      <td className="right nowrap">
                        {a.quantity} <span className="muted">{a.unit}</span>
                      </td>
                      <td>
                        <ConditionBadge value={a.condition} />
                      </td>
                      <td>
                        {a.openIssueCount > 0 ? (
                          <span className="chip chip--purple">{a.openIssueCount} báo cáo</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      {reporter && (
                        <td className="center nowrap">
                          <button
                            className="icon-btn"
                            title="Báo sự cố"
                            aria-label={`Báo sự cố ${a.name}`}
                            onClick={() => navigate(`/facility/issues/new?assetId=${a.id}`)}
                          >
                            <AlertTriangle size={17} />
                          </button>
                          <button
                            className="icon-btn"
                            title="Đề nghị bổ sung"
                            aria-label={`Đề nghị bổ sung ${a.name}`}
                            onClick={() => navigate(`/facility/requests/new?assetId=${a.id}`)}
                          >
                            <PackagePlus size={17} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rows.length > 0 && <Pagination page={page} total={rows.length} onChange={setPage} unit="tài sản" />}
      </div>
    </div>
  );
}
