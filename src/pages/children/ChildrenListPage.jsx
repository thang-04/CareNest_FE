import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, RotateCcw, Eye, HeartPulse, FileSpreadsheet, Baby, Info, LayoutGrid, KeyRound, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useClasses } from '@/hooks/useSchool';
import { useChildRecords } from '@/hooks/children/useChildRecords';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { ChildStatusBadge } from '@/components/children/ChildBadges';
import { CHILD_STATUS, CHILD_STATUS_LABELS, GENDER_LABELS, ageLabel } from '@/models/School';
import { PARENT_ACCOUNT_STATUS } from '@/models/children/childrenConstants';
import { formatDate, normalizeText } from '@/utils/format';
import { canEnrollChild, isPrincipal, isTeacherRole, isVicePrincipal } from '@/utils/children/childrenPermissions';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

export default function ChildrenListPage() {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const md = useMasterData();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [campusId, setCampusId] = useState('');
  const [classId, setClassId] = useState('');
  const [page, setPage] = useState(1);

  const { children: all, loading, error, reload } = useChildRecords({ schoolYear });
  const { classes } = useClasses(campusId ? { campusId } : {});
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
  const filtered = !!(status || keyword || campusId || classId);
  const resetFilters = () => {
    setStatus('');
    setKeyword('');
    setCampusId('');
    setClassId('');
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
  const allergyPending = all.filter((c) => c.allergyPending).length;
  const showCampus = isPrincipal(user);
  const cols = showCampus ? 9 : 8;

  return (
    <div className="page">
      <Breadcrumb items={childrenCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Danh sách trẻ</h1>
        {canEnrollChild(user) && (
          <div className="row" style={{ gap: 8 }}>
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
          <div className="stack" style={{ gap: 4 }}>
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
      {isPrincipal(user) && allergyPending > 0 && (
        <div className="alert alert--purple mb-16">
          <ShieldAlert size={18} />
          <div>
            Có <b>{allergyPending}</b> hồ sơ khai báo dị ứng thực phẩm chờ bạn xác nhận. Mở hồ sơ trẻ → <i>Khai báo sức khỏe</i> để xác
            nhận.
          </div>
        </div>
      )}

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
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
          </button>
        ))}
      </div>

      <div className="card">
        <div className="filter-bar">
          <label className="search-box" style={{ flex: 1, minWidth: 220 }}>
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
              {md.campuses.map((c) => (
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
                {showCampus && !campusId ? ` – ${md.campusById(c.campusId)?.name?.split(' - ')[0] || ''}` : ''}
              </option>
            ))}
          </select>
          <button className="btn" onClick={resetFilters} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại
          </button>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap tr-table-flat">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã trẻ</th>
                  <th>Họ và tên</th>
                  <th>Ngày sinh</th>
                  <th>Giới tính</th>
                  <th>Lớp</th>
                  {showCampus && <th>Điểm trường</th>}
                  <th>Phụ huynh</th>
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
                      <tr key={c.id} className="row-click" onClick={() => navigate(`/children/${c.id}`)}>
                        <td className="fw-600 text-primary nowrap">{c.code}</td>
                        <td className="fw-600">{c.fullName}</td>
                        <td className="nowrap">
                          <div>{formatDate(c.dateOfBirth)}</div>
                          <div className="muted text-xs">{ageLabel(c.dateOfBirth)}</div>
                        </td>
                        <td>{GENDER_LABELS[c.gender]}</td>
                        <td className="nowrap">{c.className || <span className="muted">Chưa xếp lớp</span>}</td>
                        {showCampus && <td className="text-sm">{md.campusById(c.campusId)?.name?.split(' - ')[0] || '—'}</td>}
                        <td className="text-sm">
                          {g ? (
                            <>
                              <div>
                                {g.fullName} <span className="muted">({g.relation})</span>
                              </div>
                              <div className="muted">{g.phone}</div>
                            </>
                          ) : (
                            <span className="muted">Chưa có</span>
                          )}
                        </td>
                        <td>
                          <ChildStatusBadge status={c.status} />
                        </td>
                        <td className="center nowrap" onClick={(e) => e.stopPropagation()}>
                          <Link className="icon-btn" to={`/children/${c.id}`} title="Xem hồ sơ" aria-label={`Xem hồ sơ ${c.fullName}`}>
                            <Eye size={17} />
                          </Link>
                          <Link
                            className="icon-btn"
                            to={`/children/${c.id}/health`}
                            title="Sổ sức khỏe"
                            aria-label={`Sổ sức khỏe của ${c.fullName}`}
                          >
                            <HeartPulse size={17} />
                          </Link>
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
    </div>
  );
}
