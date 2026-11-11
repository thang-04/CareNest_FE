import { ChildAvatar } from '@/components/ChildAvatar';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, RotateCcw, UserMinus, FileSpreadsheet, Baby, Info, LayoutGrid, KeyRound, Pencil } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useChildRecords, useClassOptions } from '@/hooks/children/useChildRecords';
import { sameId } from '@/services/http/idStrings';
import { useFilterParams } from '@/hooks/useFilterParams';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { FilterChips } from '@/components/ui/FilterChips';
import { PeopleTabs } from '@/components/account/PeopleTabs';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import { ChildStatusBadge } from '@/components/children/ChildBadges';
import { WithdrawChildModal } from '@/components/children/WithdrawChildModal';
import { CHILD_STATUS, CHILD_STATUS_LABELS, GENDER_LABELS, ageLabel } from '@/models/School';
import { PARENT_ACCOUNT_STATUS } from '@/models/children/childrenConstants';
import { formatDate, normalizeText } from '@/utils/format';
import { clickableRowProps } from '@/utils/clickableRow';
import {
  canEditChild,
  canEnrollChild,
  canWithdrawChild,
  isTeacherRole,
  isVicePrincipal,
  seesAllCampusChildren,
} from '@/utils/children/childrenPermissions';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import { childrenOfStatus } from '@/utils/children/childrenHelpers';
import '@/styles/modules/children.css';
import { StatCard } from '@/components/ui/StatCard';

// Cảnh báo sức khỏe xem ở Sổ sức khỏe của từng trẻ, không ở danh sách (user yêu cầu 2026-10-31; HLT-19, 2026-11-04).
const FILTER_DEFAULTS = { keyword: '', status: '', campusId: '', classId: '' };

export default function ChildrenListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { schoolYear } = useSchoolYear();
  const md = useMasterData();
  const [filters, setFilters, resetFilterParams, activeKeys] = useFilterParams(FILTER_DEFAULTS);
  const { status, keyword, campusId, classId } = filters;
  const [page, setPage] = useState(1);
  const [withdrawing, setWithdrawing] = useState(null);

  const { children: all, loading, error, reload } = useChildRecords({ schoolYear });
  // PHT được giao "Hồ sơ trẻ" toàn trường: bộ lọc lớp gồm lớp của cả 2 điểm trường
  const allCampuses = isVicePrincipal(user) && seesAllCampusChildren(user);
  // Lớp của năm học đang xem (mock hoặc BE /school-structure); id điểm trường của /campuses là số khi nối BE ⇒ so bằng sameId
  const { classes: yearOptions } = useClassOptions(schoolYear, { all: allCampuses });
  const scopeCampusIds = useMemo(
    () =>
      new Set(
        all
          .map((child) => child.campusId)
          .filter(Boolean)
          .map(String),
      ),
    [all],
  );
  const campusOptions = md.campuses.filter((campus) => scopeCampusIds.has(String(campus.id)));
  const yearClasses = yearOptions.filter((c) => !campusId || sameId(c.campusId, campusId));

  const current = useMemo(() => childrenOfStatus(all, ''), [all]);
  const rows = useMemo(() => {
    const kw = normalizeText(keyword).trim();
    return childrenOfStatus(all, status)
      .filter((c) => !campusId || sameId(c.campusId, campusId))
      .filter((c) => !classId || sameId(c.classId, classId))
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
    { key: '', label: 'Tổng số trẻ', value: current.length, tone: 'blue' },
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
  // Giáo viên không có thao tác dòng (Sửa, Cho nghỉ học) nên bỏ cả cột; bấm dòng mở hồ sơ (DESIGN §6.3)
  const showActions = !isTeacherRole(user);
  const cols = 5 + (showCampus ? 1 : 0) + (showActions ? 1 : 0);
  const chipLabels = {
    keyword: `Từ khóa: ${keyword}`,
    status: `Trạng thái: ${CHILD_STATUS_LABELS[status] || status}`,
    campusId: `Điểm trường: ${md.campusById(campusId)?.name?.split(' - ')[0] || 'đã chọn'}`,
    classId: `Lớp: ${yearClasses.find((c) => sameId(c.id, classId))?.name || 'đã chọn'}`,
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
          <StatCard
            key={s.key || 'all'}
            tone={s.tone}
            label={s.label}
            value={s.value}
            loading={loading}
            active={status === s.key}
            onClick={() => setFilter({ status: s.key })}
          />
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
                  {showActions && <th className="cell--actions">Thao tác</th>}
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
                          description="Không có trẻ đang học hoặc chờ xếp lớp trong phạm vi và năm học đã chọn."
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
                      <tr key={c.id} className="row-click" {...clickableRowProps(() => navigate(`/children/${c.id}`))}>
                        <td>
                          {/* Mã trẻ đặt dưới tên như màn Nhân sự (email dưới tên) để bảng vừa khung 1440px */}
                          <span className="row gap-2-5">
                            <ChildAvatar child={c} size="sm" />
                            <span className="stack gap-0">
                              <span className="fw-600 text-primary tr-child-name">{c.fullName}</span>
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
                        {showActions && (
                          <td className="cell--actions">
                            {/* Mọi thao tác dòng gom vào menu "…" (user chọn 2026-11-11) */}
                            <RowActions
                              menu={[
                                canEditChild(c, user) && { label: 'Sửa hồ sơ', icon: Pencil, to: `/children/${c.id}/edit` },
                                canWithdrawChild(c, user) && {
                                  label: 'Cho nghỉ học',
                                  icon: UserMinus,
                                  danger: true,
                                  onClick: () => setWithdrawing(c),
                                },
                              ].filter(Boolean)}
                              name={c.fullName}
                            />
                          </td>
                        )}
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
