import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, RotateCcw, UserMinus, FileSpreadsheet, Baby, Info, LayoutGrid, KeyRound } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useClasses } from '@/hooks/useSchool';
import { useChildRecords } from '@/hooks/children/useChildRecords';
import { useFilterParams } from '@/hooks/useFilterParams';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { FilterChips } from '@/components/ui/FilterChips';
import { PeopleTabs } from '@/components/account/PeopleTabs';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import { ChildStatusBadge } from '@/components/children/ChildBadges';
import { ChildQuickPanel } from '@/components/children/ChildQuickPanel';
import { WithdrawChildModal } from '@/components/children/WithdrawChildModal';
import { CHILD_STATUS, CHILD_STATUS_LABELS, GENDER_LABELS, ageLabel } from '@/models/School';
import { PARENT_ACCOUNT_STATUS } from '@/models/children/childrenConstants';
import { avatarTone, formatDate, initials, normalizeText } from '@/utils/format';
import {
  canEditChild,
  canEnrollChild,
  canWithdrawChild,
  isTeacherRole,
  isVicePrincipal,
  seesAllCampusChildren,
} from '@/utils/children/childrenPermissions';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';
import { StatCardIcon } from '@/components/ui/StatCardIcon';

// Theo dõi sức khỏe (mức, phiếu theo dõi) xem ở Sổ sức khỏe của từng trẻ, không ở danh sách (user yêu cầu 2026-10-31).
const FILTER_DEFAULTS = { keyword: '', status: '', campusId: '', classId: '' };

export default function ChildrenListPage() {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const md = useMasterData();
  const [filters, setFilters, resetFilterParams, activeKeys] = useFilterParams(FILTER_DEFAULTS);
  const { status, keyword, campusId, classId } = filters;
  const [page, setPage] = useState(1);
  const [quickViewId, setQuickViewId] = useState(null);
  const [withdrawing, setWithdrawing] = useState(null);

  const { children: all, loading, error, reload } = useChildRecords({ schoolYear });
  // PHT được giao "Hồ sơ trẻ" toàn trường: bộ lọc lớp gồm lớp của cả 2 điểm trường
  const allCampuses = isVicePrincipal(user) && seesAllCampusChildren(user);
  const { classes } = useClasses({ ...(campusId ? { campusId } : {}), ...(allCampuses ? { all: true } : {}) });
  const scopeCampusIds = useMemo(() => new Set(all.map((child) => child.campusId).filter(Boolean)), [all]);
  const campusOptions = md.campuses.filter((campus) => scopeCampusIds.has(campus.id));
  const yearClasses = classes.filter((c) => c.schoolYear === schoolYear);

  const rows = useMemo(() => {
    const kw = normalizeText(keyword).trim();
    return all
      .filter((c) => !status || c.status === status)
      .filter((c) => !campusId || c.campusId === campusId)
      .filter((c) => !classId || c.classId === classId)
      .filter((c) => !kw || normalizeText(`${c.fullName} ${c.code}`).includes(kw));
  }, [all, status, campusId, classId, keyword]);
  const pageRows = paginate(rows, page);
  const filtered = activeKeys.length > 0;
  const setFilter = (patch) => {
    setFilters(patch);
    setPage(1);
  };
  const resetFilters = () => {
    resetFilterParams();
    setPage(1);
  };

  const count = (s) => all.filter((c) => c.status === s).length;
  const stats = [
    { key: '', label: 'Tổng số trẻ', value: all.length, tone: 'blue' },
    { key: CHILD_STATUS.ACTIVE, label: CHILD_STATUS_LABELS.ACTIVE, value: count(CHILD_STATUS.ACTIVE), tone: 'green' },
    {
      key: CHILD_STATUS.PENDING_PLACEMENT,
      label: CHILD_STATUS_LABELS.PENDING_PLACEMENT,
      value: count(CHILD_STATUS.PENDING_PLACEMENT),
      tone: 'orange',
    },
    { key: CHILD_STATUS.LEFT, label: CHILD_STATUS_LABELS.LEFT, value: count(CHILD_STATUS.LEFT), tone: 'purple' },
  ];
  const pendingPlacement = count(CHILD_STATUS.PENDING_PLACEMENT);
  const notActivated = all.filter(
    (c) => c.status !== CHILD_STATUS.LEFT && c.guardians.some((g) => g.accountStatus === PARENT_ACCOUNT_STATUS.NOT_ACTIVATED),
  ).length;
  const showCampus = seesAllCampusChildren(user);
  const cols = showCampus ? 7 : 6;
  const chipLabels = {
    keyword: `Từ khóa: ${keyword}`,
    status: `Trạng thái: ${CHILD_STATUS_LABELS[status] || status}`,
    campusId: `Điểm trường: ${md.campusById(campusId)?.name?.split(' - ')[0] || 'đã chọn'}`,
    classId: `Lớp: ${yearClasses.find((c) => c.id === classId)?.name || 'đã chọn'}`,
  };
  // Bỏ điểm trường thì bỏ luôn lớp như khi đổi ô chọn điểm trường
  const chips = activeKeys.map((key) => ({
    key,
    label: chipLabels[key],
    onRemove: () => setFilter(key === 'campusId' ? { campusId: '', classId: '' } : { [key]: '' }),
  }));

  return (
    <div className="page">
      <Breadcrumb items={childrenCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Danh sách trẻ</h1>
        {canEnrollChild(user) && (
          <div className="row gap-2">
            <Link to="/children/import" className="btn">
              <FileSpreadsheet size={16} /> Nhập từ Excel
            </Link>
            <Link to="/children/new" className="btn btn--primary">
              <Plus size={16} /> Tiếp nhận trẻ
            </Link>
          </div>
        )}
      </div>

      {isTeacherRole(user) && (
        <div className="alert alert--info mb-16">
          <Info size={18} />
          <div>Danh sách chỉ gồm trẻ của lớp bạn đang được phân công.</div>
        </div>
      )}
      {isVicePrincipal(user) && (pendingPlacement > 0 || notActivated > 0) && (
        <div className="alert alert--warning mb-16">
          <Info size={18} />
          <div className="stack gap-1">
            {pendingPlacement > 0 && (
              <span>
                <b>{pendingPlacement}</b> trẻ chưa được xếp lớp.{' '}
                <Link to="/children/placement" className="text-primary">
                  <LayoutGrid size={14} /> Xếp lớp
                </Link>
              </span>
            )}
            {notActivated > 0 && (
              <span>
                <b>{notActivated}</b> trẻ có phụ huynh chưa được kích hoạt tài khoản.{' '}
                <Link to="/children/activation" className="text-primary">
                  <KeyRound size={14} /> Kích hoạt tài khoản
                </Link>
              </span>
            )}
          </div>
        </div>
      )}

      <div className="stat-grid">
        {stats.map((s) => (
          <button
            key={s.key || 'all'}
            className={`stat-card stat-card--${s.tone} ${status === s.key ? 'stat-card--active' : ''}`}
            aria-pressed={status === s.key}
            onClick={() => setFilter({ status: s.key })}
          >
            <div className="stat-card__value">{s.value}</div>
            <div className="stat-card__label">{s.label}</div>
            <StatCardIcon tone={s.tone} />
          </button>
        ))}
      </div>

      <div className="card">
        <PeopleTabs embedded />
        <div className="filter-bar">
          <SearchSubmit
            className="flex-1 tr-search-wide"
            value={keyword}
            placeholder="Tìm theo họ tên hoặc mã trẻ..."
            label="Tìm theo họ tên hoặc mã trẻ"
            onSearch={(text) => setFilter({ keyword: text })}
          />
          {showCampus && (
            <select
              className="select"
              value={campusId}
              aria-label="Điểm trường"
              onChange={(e) => setFilter({ campusId: e.target.value, classId: '' })}
            >
              <option value="">Tất cả điểm trường</option>
              {campusOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <select className="select" value={classId} aria-label="Lớp" onChange={(e) => setFilter({ classId: e.target.value })}>
            <option value="">Tất cả lớp</option>
            {yearClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {showCampus && !campusId && campusOptions.length > 1 ? ` – ${md.campusById(c.campusId)?.name?.split(' - ')[0] || ''}` : ''}
              </option>
            ))}
          </select>
          <button className="btn" onClick={resetFilters} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
        </div>
        <FilterChips count={loading ? null : rows.length} unit="trẻ" chips={chips} />
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap tr-table-flat">
            <table className="table table--grid table--wrap-head">
              <thead>
                <tr>
                  <th>Họ và tên</th>
                  <th>Ngày sinh</th>
                  <th>Lớp</th>
                  {showCampus && <th>Điểm trường</th>}
                  <th>Phụ huynh</th>
                  <th className="center">Trạng thái</th>
                  <th className="cell--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={5} cols={cols} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={cols}>
                      {filtered ? (
                        <EmptyState
                          icon={Search}
                          title="Không có trẻ phù hợp"
                          description="Không có hồ sơ nào trong phạm vi và bộ lọc đã chọn."
                          action={
                            <button className="btn" onClick={resetFilters}>
                              <RotateCcw size={15} /> Đặt lại bộ lọc
                            </button>
                          }
                        />
                      ) : (
                        <EmptyState
                          icon={Baby}
                          title="Chưa có hồ sơ trẻ"
                          description="Không có hồ sơ trẻ nào trong phạm vi và năm học đã chọn."
                          action={
                            canEnrollChild(user) && (
                              <Link to="/children/new" className="btn btn--primary">
                                <Plus size={16} /> Tiếp nhận trẻ
                              </Link>
                            )
                          }
                        />
                      )}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((c) => {
                    const g = c.guardians[0];
                    return (
                      <tr key={c.id}>
                        <td>
                          {/* Mã trẻ đặt dưới tên như màn Nhân sự (email dưới tên) để bảng vừa khung 1440px */}
                          <span className="row gap-2-5">
                            <span className={`avatar avatar--sm avatar--tone-${avatarTone(c.fullName)}`} aria-hidden="true">
                              {initials(c.fullName)}
                            </span>
                            <span className="stack gap-0">
                              {/* Bấm tên: xem nhanh trong panel; nút Xem ở cột thao tác mở trang hồ sơ đầy đủ */}
                              <button
                                type="button"
                                className="link-btn fw-600 tr-name-btn"
                                title="Xem nhanh"
                                aria-label={`Xem nhanh hồ sơ ${c.fullName}`}
                                onClick={() => setQuickViewId(c.id)}
                              >
                                {c.fullName}
                              </button>
                              <span className="text-xs muted">{c.code}</span>
                            </span>
                          </span>
                        </td>
                        <td className="nowrap">
                          <div>{formatDate(c.dateOfBirth)}</div>
                          <div className="muted text-xs">
                            {ageLabel(c.dateOfBirth)} · {GENDER_LABELS[c.gender]}
                          </div>
                        </td>
                        <td className="nowrap">{c.className || <span className="muted">Chưa xếp lớp</span>}</td>
                        {showCampus && <td className="text-sm">{md.campusById(c.campusId)?.name?.split(' - ')[0] || '—'}</td>}
                        <td className="text-sm">
                          {g ? (
                            <>
                              <div>
                                {g.fullName} <span className="muted">({g.relation})</span>
                              </div>
                              <div className="muted nowrap">{g.phone}</div>
                            </>
                          ) : (
                            <span className="muted">Chưa có</span>
                          )}
                        </td>
                        <td className="center">
                          <ChildStatusBadge status={c.status} />
                        </td>
                        <td className="cell--actions">
                          <RowActions
                            view={{ to: `/children/${c.id}`, label: 'Xem hồ sơ' }}
                            edit={canEditChild(c, user) ? { to: `/children/${c.id}/edit`, label: 'Sửa hồ sơ' } : null}
                            menu={
                              canWithdrawChild(c, user)
                                ? [{ label: 'Cho nghỉ học', icon: UserMinus, danger: true, onClick: () => setWithdrawing(c) }]
                                : []
                            }
                            name={c.fullName}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rows.length > 0 && <Pagination page={page} total={rows.length} onChange={setPage} unit="trẻ" />}
      </div>
      <ChildQuickPanel childId={quickViewId} onClose={() => setQuickViewId(null)} />
      {withdrawing && (
        <WithdrawChildModal
          key={withdrawing.id}
          child={withdrawing}
          onClose={() => setWithdrawing(null)}
          onDone={() => reload({ silent: true })}
        />
      )}
    </div>
  );
}
