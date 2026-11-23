import { ChildAvatar } from '@/components/ChildAvatar';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  RotateCcw,
  UserMinus,
  FileSpreadsheet,
  Baby,
  Info,
  LayoutGrid,
  KeyRound,
  Pencil,
  ClipboardCheck,
} from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useChildYearLock } from '@/hooks/children/useChildYearLock';
import { YearLockedNotice } from '@/components/children/YearLockedNotice';
import { useMasterData } from '@/hooks/useMasterData';
import { useChildRecords, useClassOptions, useProfileChanges } from '@/hooks/children/useChildRecords';
import { sameId } from '@/services/http/idStrings';
import { useFilterParams } from '@/hooks/useFilterParams';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { FilterChips } from '@/components/ui/FilterChips';
import { PeopleTabs } from '@/components/account/PeopleTabs';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { RowActions } from '@/components/ui/RowActions';
import { clickableRowProps } from '@/utils/clickableRow';
import { ChildStatusBadge, PlannedAdmissionBadge } from '@/components/children/ChildBadges';
import { WithdrawChildModal } from '@/components/children/WithdrawChildModal';
import { ImportChildrenModal } from '@/components/children/ImportChildrenModal';
import { Button } from '@/components/ui/Button';
import { CHILD_STATUS, CHILD_STATUS_LABELS, GENDER_LABELS, ageLabel } from '@/models/School';
import { PARENT_ACCOUNT_STATUS } from '@/models/children/childrenConstants';
import { formatDate, normalizeText } from '@/utils/format';
import {
  canEditChild,
  canEnrollChild,
  canWithdrawChild,
  isPrincipal,
  isTeacherRole,
  isVicePrincipal,
  seesAllCampusChildren,
} from '@/utils/children/childrenPermissions';
import { childrenCrumbs } from '@/utils/children/breadcrumbs';
import { PLANNED_ADMISSION_FILTER, childrenOfStatus, plannedClassLabel } from '@/utils/children/childrenHelpers';
import '@/styles/modules/children.css';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { hasScheduledTransfer, isNotStarted, notStartedLabel, scheduledTransferLabel } from '@/utils/children/startDate';
import { CampusFilter } from '@/components/ui/CampusFilter';

// Cảnh báo sức khỏe xem ở Sổ sức khỏe của từng trẻ, không ở danh sách (user yêu cầu 2026-10-31; HLT-19, 2026-11-04).
const FILTER_DEFAULTS = { keyword: '', status: '', campusId: '', classId: '' };

export default function ChildrenListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // prepLocked: năm sắp diễn ra chưa tới ngày mở chuẩn bị (CHD-12) — quyết định thẻ, câu "Sắp nhập học"
  const { schoolYear, yearLocked: prepLocked, preparingYear } = useSchoolYear();
  const yearLocked = useChildYearLock();
  const md = useMasterData(schoolYear);
  const [filters, setFilters, resetFilterParams, activeKeys] = useFilterParams(FILTER_DEFAULTS);
  const { status, keyword, campusId, classId } = filters;
  const [page, setPage] = useState(1);
  const [withdrawing, setWithdrawing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  // Năm đã kết thúc hoặc năm sắp diễn ra chưa tới ngày mở chuẩn bị (CFG-YR-01, CHD-12): chỉ xem
  const canImport = canEnrollChild(user) && !yearLocked;

  // ?import=1 (từ Tiếp nhận trẻ, Xếp lớp, hoặc màn xem trước khi mất bản xem trước) ⇒ mở hộp nhập Excel rồi bỏ tham số khỏi URL.
  useEffect(() => {
    if (searchParams.get('import') !== '1') return;
    if (canImport) setImportOpen(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('import');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams, canImport]);

  const { children: all, loading, error, reload } = useChildRecords({ schoolYear });
  // PHT được giao "Hồ sơ trẻ" toàn trường: bộ lọc lớp gồm lớp của cả 2 điểm trường
  const allCampuses = isVicePrincipal(user) && seesAllCampusChildren(user);
  // Lớp của năm học đang xem (mock hoặc BE /school-structure); id điểm trường của /campuses là số khi nối BE ⇒ so bằng sameId
  const { classes: yearOptions, loading: classesLoading } = useClassOptions(schoolYear, { all: allCampuses });
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
  // Chỉ xem được một lớp (vd. GV phụ trách một lớp) ⇒ không ô lọc lớp, hiện tên lớp và số trẻ; GV chưa có lớp trong năm ⇒ báo
  const singleClass = yearOptions.length === 1 ? yearOptions[0] : null;
  const singleClassCount = singleClass ? current.filter((c) => sameId(c.classId, singleClass.id)).length : 0;
  const noClassAssigned = isTeacherRole(user) && !classesLoading && yearOptions.length === 0;
  const rows = useMemo(() => {
    const kw = normalizeText(keyword).trim();
    return (
      childrenOfStatus(all, status)
        .filter((c) => !campusId || sameId(c.campusId, campusId))
        .filter((c) => !classId || sameId(c.classId, classId))
        .filter((c) => !kw || normalizeText(`${c.fullName} ${c.code}`).includes(kw))
        // G94-180/CHD-14: trẻ đã tới ngày bắt đầu đi học mà chưa có lớp lên đầu (cờ startDue do BE tính)
        .sort((a, b) => Number(!!b.startDue) - Number(!!a.startDue))
    );
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

  const count = (s) => childrenOfStatus(all, s).length;
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
  // Năm sắp diễn ra: danh sách là trẻ Sắp nhập học của năm đó (CHD-09, CHD-11); thẻ chỉ hiện khi có trẻ hoặc năm đang chuẩn bị
  const plannedCount = count(PLANNED_ADMISSION_FILTER);
  if (plannedCount > 0 || preparingYear || prepLocked)
    stats.splice(3, 0, { key: PLANNED_ADMISSION_FILTER, label: 'Sắp nhập học', value: plannedCount, tone: 'blue' });
  const pendingPlacement = count(CHILD_STATUS.PENDING_PLACEMENT);
  const startDueCount = all.filter((c) => c.startDue).length;
  // G94-180/CHD-14: dòng nhắc xếp lớp cho cả HT và PHT; nhắc kích hoạt tài khoản giữ cho PHT như trước
  const remindsPlacement = isVicePrincipal(user) || isPrincipal(user);
  const notActivated = all.filter(
    (c) => c.status !== CHILD_STATUS.LEFT && c.guardians.some((g) => g.accountStatus === PARENT_ACCOUNT_STATUS.NOT_ACTIVATED),
  ).length;
  // G94-180/CHD-11 (Cần chốt 19/11, BUG-43): trẻ đã tiếp nhận cho năm sau phải có lớp trước khi kích hoạt năm học
  const plannedWithoutClass = all.filter((c) => c.plannedAdmission && !c.plannedAdmission.classId).length;
  const showCampus = seesAllCampusChildren(user);
  // Giáo viên, năm bị khóa (CFG-YR-01, CHD-12) không có thao tác dòng (Sửa, Cho nghỉ học) nên bỏ cả cột; bấm dòng mở hồ sơ (DESIGN §6.3)
  const showActions = !isTeacherRole(user) && !yearLocked;
  // BE:CHD-11 — yêu cầu sửa hồ sơ GV gửi mà người xem duyệt được (BE trả canDecide)
  const { requests: profileChanges } = useProfileChanges('PENDING', { enabled: showActions });
  const changesToDecide = profileChanges.filter((r) => r.canDecide).length;
  const cols = 5 + (showCampus ? 1 : 0) + (showActions ? 1 : 0);
  const chipLabels = {
    keyword: `Từ khóa: ${keyword}`,
    status: `Trạng thái: ${status === PLANNED_ADMISSION_FILTER ? 'Sắp nhập học' : CHILD_STATUS_LABELS[status] || status}`,
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
      </div>

      <YearLockedNotice action="Tiếp nhận, sửa hồ sơ trẻ" subject="hồ sơ trẻ" />
      {changesToDecide > 0 && (
        <div className="alert alert--info mb-16" role="status">
          <ClipboardCheck size={18} />
          <span>
            <b>{changesToDecide}</b> yêu cầu sửa hồ sơ của giáo viên đang chờ duyệt.{' '}
            <Link to="/children/profile-changes" className="text-primary">
              Xem và duyệt
            </Link>
          </span>
        </div>
      )}

      {!isTeacherRole(user) && plannedWithoutClass > 0 && (
        <div className="alert alert--warning mb-16" role="status">
          <Info size={18} />
          <span>
            <b>{plannedWithoutClass}</b> trẻ Sắp nhập học chưa có lớp. Phải xếp lớp trước khi kích hoạt năm học.{' '}
            <Link to="/school/placement?tab=new" className="text-primary">
              <LayoutGrid size={14} /> Xếp lớp năm học mới
            </Link>
          </span>
        </div>
      )}

      {!yearLocked && remindsPlacement && (pendingPlacement > 0 || (isVicePrincipal(user) && notActivated > 0)) && (
        <div className="alert alert--warning mb-16">
          <Info size={18} />
          <div className="stack gap-1">
            {pendingPlacement > 0 && (
              <span>
                <b>{pendingPlacement}</b> trẻ chưa được xếp lớp
                {startDueCount > 0 && (
                  <>
                    , trong đó <b>{startDueCount}</b> trẻ đã tới ngày bắt đầu đi học
                  </>
                )}
                .{' '}
                <Link to="/children/placement" className="text-primary">
                  <LayoutGrid size={14} /> Xếp lớp
                </Link>
              </span>
            )}
            {isVicePrincipal(user) && notActivated > 0 && (
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
            <CampusFilter campuses={campusOptions} value={campusId} onChange={(v) => setFilter({ campusId: v, classId: '' })} hideLabel />
          )}
          {yearOptions.length > 1 && (
            <select className="select" value={classId} aria-label="Lớp" onChange={(e) => setFilter({ classId: e.target.value })}>
              <option value="">Tất cả lớp</option>
              {yearClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {showCampus && !campusId && campusOptions.length > 1
                    ? ` – ${md.campusById(c.campusId)?.name?.split(' - ')[0] || ''}`
                    : ''}
                </option>
              ))}
            </select>
          )}
          {singleClass && (
            <p className="tr-class-scope">
              <strong>{singleClass.name}</strong> · {singleClassCount} trẻ
            </p>
          )}
          {noClassAssigned && <p className="tr-class-scope muted">Bạn chưa được phân công lớp trong năm học này.</p>}
          <button className="btn" onClick={resetFilters} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
          {canImport && (
            <div className="filter-bar__end">
              <Button icon={FileSpreadsheet} onClick={() => setImportOpen(true)}>
                Nhập từ Excel
              </Button>
              <Link to="/children/new" className="btn btn--primary">
                <Plus size={16} /> Tiếp nhận trẻ
              </Link>
            </div>
          )}
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
                          description={
                            preparingYear || prepLocked
                              ? 'Chưa có trẻ Sắp nhập học trong phạm vi và năm học đã chọn.'
                              : 'Không có trẻ đang học hoặc chờ xếp lớp trong phạm vi và năm học đã chọn.'
                          }
                          action={
                            canImport && (
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
                              {c.startDue && <StatusBadge tone="orange" size="sm" label="Đã tới ngày đi học, chưa có lớp" />}
                            </span>
                          </span>
                        </td>
                        <td className="nowrap">
                          <div>{formatDate(c.dateOfBirth)}</div>
                          <div className="muted text-xs">
                            {ageLabel(c.dateOfBirth)} · {GENDER_LABELS[c.gender]}
                          </div>
                        </td>
                        <td className="nowrap">
                          {c.plannedAdmission
                            ? plannedClassLabel(c.plannedAdmission)
                            : c.className || <span className="muted">Chưa xếp lớp</span>}
                          {isNotStarted(c) && <span className="muted text-xs"> ({notStartedLabel(c)})</span>}
                          {hasScheduledTransfer(c) && <div className="text-xs">{scheduledTransferLabel(c)}</div>}
                        </td>
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
                          {c.plannedAdmission ? <PlannedAdmissionBadge /> : <ChildStatusBadge status={c.status} />}
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
      {importOpen && <ImportChildrenModal onClose={() => setImportOpen(false)} onChecked={() => navigate('/children/import')} />}
    </div>
  );
}
