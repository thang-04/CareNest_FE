import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, RotateCcw, Eye, Pencil, UserMinus, FileSpreadsheet, Baby, Info, LayoutGrid, KeyRound } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useClasses } from '@/hooks/useSchool';
import { useChildRecords } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { PeopleTabs } from '@/components/account/PeopleTabs';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { ChildStatusBadge, FollowUpLevelShortBadge } from '@/components/children/ChildBadges';
import { ChildQuickPanel } from '@/components/children/ChildQuickPanel';
import { WithdrawChildModal } from '@/components/children/WithdrawChildModal';
import { CHILD_STATUS, CHILD_STATUS_LABELS, GENDER_LABELS, ageLabel } from '@/models/School';
import { FOLLOW_UP_LEVEL, FOLLOW_UP_LEVEL_SHORT_LABELS, PARENT_ACCOUNT_STATUS } from '@/models/children/childrenConstants';
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

// Lọc theo mức của lần khám gần nhất có xếp mức (BE trả latestHealth); NO_RESULT: chưa có lần khám nào được xếp mức.
const NO_RESULT = 'NO_RESULT';
const HEALTH_LEVEL_OPTIONS = [FOLLOW_UP_LEVEL.WATCH, FOLLOW_UP_LEVEL.CLOSE_WATCH, FOLLOW_UP_LEVEL.NONE].map((value) => ({
  value,
  label: FOLLOW_UP_LEVEL_SHORT_LABELS[value],
}));

export default function ChildrenListPage() {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const md = useMasterData();
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [campusId, setCampusId] = useState('');
  const [classId, setClassId] = useState('');
  const [healthLevel, setHealthLevel] = useState('');
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
      .filter((c) => !healthLevel || (healthLevel === NO_RESULT ? !c.latestHealth : c.latestHealth?.followUpLevel === healthLevel))
      .filter((c) => !kw || normalizeText(`${c.fullName} ${c.code}`).includes(kw));
  }, [all, status, campusId, classId, healthLevel, keyword]);
  const pageRows = paginate(rows, page);
  const filtered = !!(status || keyword || campusId || classId || healthLevel);
  const resetFilters = () => {
    setStatus('');
    setKeyword('');
    setCampusId('');
    setClassId('');
    setHealthLevel('');
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
  const cols = showCampus ? 8 : 7;

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
            onClick={() => {
              setStatus(s.key);
              setPage(1);
            }}
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
          <label className="search-box flex-1 tr-search-wide">
            <Search size={17} className="muted" />
            <input
              placeholder="Tìm theo họ tên hoặc mã trẻ..."
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              aria-label="Tìm theo họ tên hoặc mã trẻ"
            />
          </label>
          {showCampus && (
            <select
              className="select"
              value={campusId}
              aria-label="Điểm trường"
              onChange={(e) => {
                setCampusId(e.target.value);
                setClassId('');
                setPage(1);
              }}
            >
              <option value="">Tất cả điểm trường</option>
              {campusOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <select
            className="select"
            value={classId}
            aria-label="Lớp"
            onChange={(e) => {
              setClassId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả lớp</option>
            {yearClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {showCampus && !campusId && campusOptions.length > 1 ? ` – ${md.campusById(c.campusId)?.name?.split(' - ')[0] || ''}` : ''}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={healthLevel}
            aria-label="Mức theo dõi sức khỏe"
            title="Theo lần khám gần nhất có kết luận; cân đo ngoài đợt không tính"
            onChange={(e) => {
              setHealthLevel(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả mức theo dõi</option>
            {HEALTH_LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            <option value={NO_RESULT}>Chưa có kết quả khám</option>
          </select>
          <button className="btn" onClick={resetFilters} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại
          </button>
        </div>
        {healthLevel && (
          <div className="alert alert--info tr-alert-flat">
            <Info size={18} />
            <div>
              Mức theo dõi theo lần khám gần nhất có kết luận của bác sĩ (hoặc kết quả mẫu cũ). Cân đo ngoài đợt không đánh giá lại nên
              không tính; trẻ giữ mức tới lần khám sau.
            </div>
          </div>
        )}
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap tr-table-flat">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Họ và tên</th>
                  <th>Ngày sinh</th>
                  <th>Lớp</th>
                  {showCampus && <th>Điểm trường</th>}
                  <th>Phụ huynh</th>
                  <th>Theo dõi sức khỏe</th>
                  <th>Trạng thái</th>
                  <th className="center">Thao tác</th>
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
                        <td>
                          {c.latestHealth ? (
                            <div className="tr-cell-stack">
                              <FollowUpLevelShortBadge status={c.latestHealth.followUpLevel} />
                              <Link className="text-primary text-xs" to={`/children/${c.id}/health`}>
                                Khám {formatDate(c.latestHealth.date)}
                              </Link>
                            </div>
                          ) : (
                            <span className="muted text-sm">Chưa có</span>
                          )}
                        </td>
                        <td>
                          <ChildStatusBadge status={c.status} />
                        </td>
                        <td className="center nowrap">
                          <Link className="icon-btn" to={`/children/${c.id}`} title="Xem hồ sơ" aria-label={`Xem hồ sơ ${c.fullName}`}>
                            <Eye size={17} />
                          </Link>
                          {canEditChild(c, user) && (
                            <Link
                              className="icon-btn"
                              to={`/children/${c.id}/edit`}
                              title="Sửa hồ sơ"
                              aria-label={`Sửa hồ sơ ${c.fullName}`}
                            >
                              <Pencil size={17} />
                            </Link>
                          )}
                          {canWithdrawChild(c, user) && (
                            <button
                              type="button"
                              className="icon-btn"
                              title="Cho nghỉ học"
                              aria-label={`Cho ${c.fullName} nghỉ học`}
                              onClick={() => setWithdrawing(c)}
                            >
                              <UserMinus size={17} />
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
