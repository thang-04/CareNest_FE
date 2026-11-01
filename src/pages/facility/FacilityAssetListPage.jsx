import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, RotateCcw, AlertTriangle, PackagePlus, History, Info, Lock, Boxes, ClipboardList } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useFacilityAssets, useFacilityLocations } from '@/hooks/facility/useFacility';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { FilterChips } from '@/components/ui/FilterChips';
import { FilterMore } from '@/components/ui/FilterMore';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import { AssetThumb, ConditionBadge } from '@/components/asset/AssetVisuals';
import { LockChip } from '@/components/facility/FacilityBadges';
import { locationBaseLabel, locationLabel } from '@/models/Location';
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
  const [params] = useSearchParams();
  // ?location=<id>: mở từ màn Phòng học để xem tài sản còn trong phòng
  const [filters, setFilters] = useState(() => {
    const locationId = params.get('location') || '';
    const loc = locationId && md.locationById(locationId);
    return { ...EMPTY_FILTERS, locationId, campusId: loc?.campusId || '' };
  });
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
    filters.categoryId && {
      key: 'categoryId',
      label: `Nhóm: ${md.categoryById(filters.categoryId)?.name || ''}`,
      onRemove: () => set({ categoryId: '' }),
    },
    filters.condition && {
      key: 'condition',
      label: `Tình trạng: ${ASSET_CONDITION_LABELS[filters.condition] || filters.condition}`,
      onRemove: () => set({ condition: '' }),
    },
    openOnly && {
      key: 'openOnly',
      label: 'Có báo cáo chờ duyệt',
      onRemove: () => {
        setOpenOnly(false);
        setPage(1);
      },
    },
  ].filter(Boolean);

  return (
    <div className="page">
      <Breadcrumb items={assetCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">{reporter ? 'Tài sản lớp/phòng của tôi' : 'Danh sách tài sản'}</h1>
        <div className="row row--wrap gap-2 bh-head-actions bh-head-actions--tight">
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
          <SearchSubmit
            className="flex-1"
            value={filters.keyword}
            placeholder="Tìm mã hoặc tên tài sản..."
            label="Tìm tài sản"
            onSearch={(text) => set({ keyword: text })}
          />
          {isPrincipal(user) && (
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
                  {/* Hiệu trưởng xem cả 2 campus: luôn kèm campus; Phó HT: campus chỉ thêm khi trùng tên */}
                  {isPrincipal(user) ? `${locationBaseLabel(l)} – ${md.campusById(l.campusId)?.shortName || ''}` : locationLabel(l)}
                </option>
              ))}
            </select>
          )}
          <FilterMore count={[filters.categoryId, filters.condition].filter(Boolean).length}>
            <label className="field">
              <span className="field__label">Nhóm tài sản</span>
              <select className="select" value={filters.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
                <option value="">Tất cả nhóm</option>
                {md.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Tình trạng</span>
              <select className="select" value={filters.condition} onChange={(e) => set({ condition: e.target.value })}>
                <option value="">Tất cả tình trạng</option>
                {Object.entries(ASSET_CONDITION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </FilterMore>
          <button className="btn" onClick={reset} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
        </div>
        <FilterChips count={loading ? null : rows.length} unit="tài sản" chips={chips} />
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tài sản</th>
                  <th>Nhóm</th>
                  <th>Lớp/phòng</th>
                  <th className="num">Số lượng</th>
                  <th>Tình trạng</th>
                  <th>Báo cáo chờ duyệt</th>
                  {reporter && <th className="cell--actions">Thao tác</th>}
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
                        <div className="row gap-2-5">
                          <AssetThumb asset={a} size="sm" />
                          <span>{a.name}</span>
                        </div>
                      </td>
                      <td className="text-sm">{md.categoryById(a.categoryId)?.name || '—'}</td>
                      <td className="bh-cell-wrap">
                        <div>
                          {manager ? locationBaseLabel(md.locationById(a.locationId)) : locationLabel(md.locationById(a.locationId))}
                        </div>
                        {manager && <div className="muted text-xs">{md.campusById(a.campusId)?.shortName}</div>}
                        {a.lockedBy && (
                          <div className="mt-8">
                            <LockChip code={a.lockedBy} />
                          </div>
                        )}
                      </td>
                      <td className="num nowrap">
                        {a.quantity} <span className="muted">{a.unit}</span>
                      </td>
                      <td className="center">
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
                        <td className="cell--actions">
                          <div className="row gap-2">
                            <button
                              className="btn btn--primary btn--sm"
                              aria-label={`Báo sự cố ${a.name}`}
                              onClick={() => navigate(`/facility/issues/new?assetId=${a.id}`)}
                            >
                              <AlertTriangle size={15} /> Báo sự cố
                            </button>
                            <RowActions
                              menu={[{ label: 'Đề nghị bổ sung', icon: PackagePlus, to: `/facility/requests/new?assetId=${a.id}` }]}
                              name={a.name}
                            />
                          </div>
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
