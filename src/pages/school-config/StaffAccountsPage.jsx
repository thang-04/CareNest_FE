import { useMemo, useState } from 'react';
import { Plus, UserCog, Users, PauseCircle, RotateCcw } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useStaffAccounts } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { PeopleTabs } from '@/components/account/PeopleTabs';
import { Avatar } from '@/components/ui/Avatar';
import { RowActions } from '@/components/ui/RowActions';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { StaffStatusBadge } from '@/components/school-config/SchoolConfigBadges';
import { StaffFormModal, StaffProfileModal, StaffStatusModal } from '@/components/school-config/StaffAccountModals';
import { ROLES, ROLE_LABELS } from '@/models/User';
import { areaAllows, canEditStaffProfile, canManageStaff, canViewStaff } from '@/utils/school-config/schoolConfigPermissions';
import { staffCrumbs } from '@/utils/school-config/breadcrumbs';
import { normalizeText } from '@/utils/format';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { SearchSubmit } from '@/components/ui/SearchSubmit';

const STAFF_PAGE_SIZE = 10;
import '@/styles/modules/school-config.css';

const ROLE_FILTERS = [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.TEACHER, ROLES.KITCHEN_STAFF];
const roleOf = (u) => (u.role === ROLES.TEAM_LEADER ? ROLES.TEACHER : u.role);

/**
 * Staff accounts (PROPOSED 10/10/2026; SRS 4.4 "User account – Create / Edit / Deactivate: Principal ⁸", to confirm).
 * Changing role or campus ends the old assignments of open school years immediately (history kept).
 */
export default function StaffAccountsPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const { accounts, loading, error, reload } = useStaffAccounts();
  const [filters, setFilters] = useState({ keyword: '', role: '', campusId: '', status: '' });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // { account | null }
  const [statusOf, setStatusOf] = useState(null);
  const [profileOf, setProfileOf] = useState(null);

  const shown = useMemo(() => {
    const kw = normalizeText(filters.keyword.trim());
    return accounts
      .filter((u) => !kw || normalizeText(`${u.fullName} ${u.email}`).includes(kw))
      .filter((u) => !filters.role || roleOf(u) === filters.role)
      .filter((u) => !filters.campusId || u.campusId === filters.campusId)
      .filter((u) => !filters.status || (u.status || 'ACTIVE') === filters.status);
  }, [accounts, filters]);

  // PHT theo quyền "Hồ sơ nhân sự": xem nhân sự trong phạm vi, có "Được sửa" thì sửa hồ sơ; tạo / khóa / đổi vai trò chỉ Hiệu trưởng
  const manage = canManageStaff(user);
  const scopeCampuses = manage ? md.campuses : md.campuses.filter((c) => areaAllows(user, 'staff', c.id));
  const vpEdits = !manage && accounts.some((u) => canEditStaffProfile(u, user));
  const cols = manage || vpEdits ? 7 : 6;
  const title = manage ? 'Tài khoản nhân sự' : 'Nhân sự điểm trường';
  if (!canViewStaff(user))
    return (
      <div className="page">
        <Breadcrumb items={staffCrumbs()} />
        <h1 className="page__title">Tài khoản nhân sự</h1>
        <ScNoAccess description="Chỉ Hiệu trưởng quản lý tài khoản nhân sự." />
      </div>
    );

  // Đổi tìm kiếm / bộ lọc thì về trang 1
  const setFilter = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const pageRows = paginate(shown, page, STAFF_PAGE_SIZE);
  const close = (setter) => (changed) => {
    setter(null);
    if (changed) reload({ silent: true });
  };

  const duties = (u) => {
    const parts = [];
    u.vpAssignments.forEach((a) =>
      parts.push(`Phụ trách ${md.campusById(a.campusId)?.shortName} (${a.schoolYear})${a.sharedService ? ' · dịch vụ chung' : ''}`),
    );
    if (u.classes.length) parts.push(`Dạy ${u.classes.map((c) => c.name).join(', ')}`);
    u.leads.forEach((a) => parts.push(`Tổ trưởng ${md.campusById(a.campusId)?.shortName}`));
    return parts;
  };

  return (
    <div className="page">
      <Breadcrumb items={staffCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">{title}</h1>
        {manage && (
          <button className="btn btn--primary btn--lg" onClick={() => setEditing({ account: null })}>
            <Plus size={18} /> Thêm tài khoản
          </button>
        )}
      </div>

      <div className="card mb-16">
        <PeopleTabs embedded />
        <div className="filter-bar">
          <SearchSubmit
            className="sc-search"
            value={filters.keyword}
            placeholder="Tìm họ tên, email"
            label="Tìm họ tên hoặc email"
            onSearch={(text) => setFilter({ keyword: text })}
          />
          <select
            className="select sc-inline-select"
            aria-label="Vai trò"
            value={filters.role}
            onChange={(e) => setFilter({ role: e.target.value })}
          >
            <option value="">Tất cả vai trò</option>
            {ROLE_FILTERS.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          {scopeCampuses.length > 1 && (
            <select
              className="select sc-inline-select"
              aria-label="Điểm trường"
              value={filters.campusId}
              onChange={(e) => setFilter({ campusId: e.target.value })}
            >
              <option value="">Tất cả điểm trường</option>
              {scopeCampuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shortName || c.name}
                </option>
              ))}
            </select>
          )}
          <select
            className="select sc-inline-select"
            aria-label="Trạng thái"
            value={filters.status}
            onChange={(e) => setFilter({ status: e.target.value })}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Đã vô hiệu hóa</option>
          </select>
        </div>
      </div>

      <div className="card">
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap sc-table-flat">
            <table className="table table--grid table--compact">
              <thead>
                <tr>
                  <th>Nhân sự</th>
                  <th>Vai trò</th>
                  <th>Điểm trường</th>
                  <th>Đang phụ trách</th>
                  <th>Số điện thoại</th>
                  <th className="center">Trạng thái</th>
                  {cols === 7 && <th className="cell--actions">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={6} cols={cols} />
                ) : shown.length === 0 ? (
                  <tr>
                    <td colSpan={cols}>
                      <EmptyState icon={Users} title="Không có tài khoản phù hợp" description="Thử đổi từ khóa hoặc bộ lọc." />
                    </td>
                  </tr>
                ) : (
                  pageRows.map((u) => {
                    const principal = u.role === ROLES.PRINCIPAL;
                    const active = (u.status || 'ACTIVE') === 'ACTIVE';
                    const list = duties(u);
                    return (
                      <tr key={u.id} className={active ? undefined : 'muted'}>
                        <td>
                          <div className="sc-person">
                            <Avatar user={u} size="sm" />
                            <div className="sc-person__text">
                              <div className="fw-600">{u.fullName}</div>
                              <div className="text-xs muted">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {ROLE_LABELS[u.role]}
                          {u.role === ROLES.VICE_PRINCIPAL && !u.campusId && <div className="text-xs muted">Chưa có điểm trường</div>}
                        </td>
                        <td>{md.campusById(u.campusId)?.shortName || <span className="muted">—</span>}</td>
                        <td className="text-sm sc-wrap">{list.length ? list.join(' · ') : <span className="muted">—</span>}</td>
                        <td className="nowrap">{u.phone || <span className="muted">—</span>}</td>
                        <td className="center">
                          <StaffStatusBadge status={u.status || 'ACTIVE'} />
                        </td>
                        {vpEdits && (
                          <td className="cell--actions">
                            {canEditStaffProfile(u, user) && (
                              <RowActions edit={{ onClick: () => setProfileOf(u), label: 'Sửa hồ sơ' }} name={u.fullName} />
                            )}
                          </td>
                        )}
                        {manage && (
                          <td className="cell--actions">
                            {principal ? (
                              <span className="text-xs muted">Tài khoản Hiệu trưởng</span>
                            ) : (
                              <RowActions
                                edit={{ onClick: () => setEditing({ account: u }), label: 'Sửa / đổi vai trò' }}
                                menu={[
                                  ...(u.role === ROLES.VICE_PRINCIPAL
                                    ? [{ label: 'Phân công Phó hiệu trưởng', icon: UserCog, to: '/school/vice-principals' }]
                                    : []),
                                  active
                                    ? { label: 'Vô hiệu hóa', icon: PauseCircle, danger: true, onClick: () => setStatusOf(u) }
                                    : { label: 'Kích hoạt lại', icon: RotateCcw, onClick: () => setStatusOf(u) },
                                ]}
                                name={u.fullName}
                              />
                            )}
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
        {shown.length > STAFF_PAGE_SIZE && (
          <Pagination page={page} total={shown.length} pageSize={STAFF_PAGE_SIZE} onChange={setPage} unit="người" />
        )}
      </div>

      {editing && <StaffFormModal account={editing.account} campuses={md.campuses} existing={accounts} onClose={close(setEditing)} />}
      {statusOf && <StaffStatusModal account={statusOf} onClose={close(setStatusOf)} />}
      {profileOf && <StaffProfileModal account={profileOf} existing={accounts} onClose={close(setProfileOf)} />}
    </div>
  );
}
