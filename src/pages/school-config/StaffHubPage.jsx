import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Filter, KeyRound, Lock, Search, Unlock, UserPlus, Users } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useStaffAccounts, useStaffStructure } from '@/hooks/account/useStaff';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { PeopleTabs } from '@/components/account/PeopleTabs';
import { StaffSummaryCards } from '@/components/account/StaffSummaryCards';
import { AccountStatusBadge } from '@/components/account/AccountStatusBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StaffPersonSheet } from '@/components/account/StaffPersonSheet';
import { ResetPasswordModal } from '@/components/account/StaffDialogs';
import { StaffFormModal } from '@/pages/school-config/StaffFormPage';
import { PEOPLE_CONTRACT_READY, USE_MOCK } from '@/config/env';
import { PERMISSIONS, PERMISSION_ROLE_LABELS } from '@/models/account/permissionConstants';
import { resetTemporaryPassword, updateAccountStatus } from '@/services/account/staffService';
import { staffCrumbs } from '@/utils/school-config/breadcrumbs';
import '@/styles/modules/staff-hub.css';

const PAGE_SIZE = 20;
const ROLE_OPTIONS = ['PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER', 'KITCHEN_STAFF'];

export default function StaffHubPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const contractReady = USE_MOCK || PEOPLE_CONTRACT_READY;
  const structure = useStaffStructure({ enabled: contractReady });
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [campusId, setCampusId] = useState('');
  const [draft, setDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetStaff, setResetStaff] = useState(null);
  const [statusStaff, setStatusStaff] = useState(null);

  const { data, loading, error, reload } = useStaffAccounts(
    { role, status, campusId, q: keyword, staffOnly: true, page, size: PAGE_SIZE },
    { enabled: contractReady },
  );
  const canAssign = hasPermission(PERMISSIONS.STAFF_ASSIGNMENT_MANAGE);
  const canCreate = hasPermission(PERMISSIONS.ACCOUNT_MANAGE);
  const canReset = hasPermission(PERMISSIONS.ACCOUNT_MANAGE);
  const canStatus = hasPermission(PERMISSIONS.ACCOUNT_STATUS_MANAGE);

  const isSelf = (person) => String(person.userId) === String(user?.id) || String(person.userId) === String(user?.userId);
  const filterClass = `select sh-directory__advanced ${filtersOpen ? 'sh-directory__advanced--open' : ''}`;
  const placeOf = (person) => {
    const places = person.activeAssignments || [];
    return places.length ? places.map(structure.describe).join(', ') : 'Chưa có phân công';
  };
  const changeFilter = (setter, value) => {
    setter(value);
    setPage(0);
  };
  const openStaff = (person) => navigate(`/school/staff/${person.userId}`);
  const handleStaffRowClick = (event, person) => {
    if (event.target.closest('button, a, input, select, textarea')) return;
    openStaff(person);
  };
  const handleStaffRowKeyDown = (event, person) => {
    if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    openStaff(person);
  };

  return (
    <div className="page">
      <Breadcrumb items={staffCrumbs()} />
      <div className="sh-head">
        <div>
          <h1>Nhân sự</h1>
          <p className="text-sm text-2">Xem chức vụ và nơi làm; mở hồ sơ để xem quyền hiệu lực của từng người.</p>
        </div>
        <div className="sh-head__actions">
          {canCreate && (
            <button className="btn btn--primary" type="button" onClick={() => setCreateOpen(true)}>
              <UserPlus size={16} /> Thêm nhân sự
            </button>
          )}
        </div>
      </div>
      {contractReady && <StaffSummaryCards campusId={campusId} />}
      <nav className="sh-views" aria-label="Cách xem nhân sự">
        <span className="sh-views__active" aria-current="page">
          Danh sách nhân sự
        </span>
        {canAssign && <Link to="/school/staff/assignments">Phân công theo nơi</Link>}
      </nav>
      <section className="card people-list-workspace sh-directory">
        <PeopleTabs embedded />
        {!contractReady ? (
          <EmptyState
            icon={Users}
            title="Danh sách nhân sự đang chờ kết nối"
            description="Dữ liệu nhân sự theo khu quản lý mới chưa sẵn sàng trên máy chủ."
          />
        ) : (
          <>
            <form
              className="sh-directory__filters"
              onSubmit={(event) => {
                event.preventDefault();
                changeFilter(setKeyword, draft.trim());
              }}
            >
              <label className="search-box sh-directory__search">
                <Search size={17} className="muted" />
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Tìm tên hoặc tài khoản"
                  aria-label="Tìm tên hoặc tài khoản"
                />
              </label>
              <button className="btn" type="submit">
                Tìm
              </button>
              <button
                className="btn sh-directory__filter-toggle"
                type="button"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <Filter size={16} /> Bộ lọc
              </button>
              <select
                className={filterClass}
                aria-label="Lọc chức vụ"
                value={role}
                onChange={(event) => changeFilter(setRole, event.target.value)}
              >
                <option value="">Mọi chức vụ</option>
                {ROLE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {PERMISSION_ROLE_LABELS[value]}
                  </option>
                ))}
              </select>
              {structure.campuses.length > 1 && (
                <select
                  className={filterClass}
                  aria-label="Lọc điểm trường"
                  value={campusId}
                  onChange={(event) => changeFilter(setCampusId, event.target.value)}
                >
                  <option value="">Cả hai điểm trường</option>
                  {structure.campuses.map((campus) => (
                    <option key={campus.id} value={campus.id}>
                      {campus.name}
                    </option>
                  ))}
                </select>
              )}
              <select
                className={filterClass}
                aria-label="Lọc trạng thái tài khoản"
                value={status}
                onChange={(event) => changeFilter(setStatus, event.target.value)}
              >
                <option value="">Mọi trạng thái</option>
                <option value="ACTIVE">Hoạt động</option>
                <option value="INACTIVE">Đã khóa</option>
              </select>
            </form>
            {error ? (
              <ErrorState error={error} onRetry={reload} />
            ) : loading ? (
              <LoadingState />
            ) : !data?.items?.length ? (
              <EmptyState icon={Users} title="Không có nhân sự phù hợp" description="Thử đổi từ khóa hoặc bộ lọc." />
            ) : (
              <>
                <div className="table-wrap sh-directory__desktop">
                  <table className="table sh-directory__table">
                    <thead>
                      <tr>
                        <th>Nhân sự</th>
                        <th>Chức vụ</th>
                        <th>Nơi làm việc</th>
                        <th>Trạng thái</th>
                        <th>Quyền</th>
                        <th className="text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((person) => {
                        const self = isSelf(person);
                        const active = person.status === 'ACTIVE';
                        return (
                          <tr
                            key={person.userId}
                            tabIndex={0}
                            aria-label={`Mở hồ sơ ${person.fullName}`}
                            onClick={(event) => handleStaffRowClick(event, person)}
                            onKeyDown={(event) => handleStaffRowKeyDown(event, person)}
                          >
                            <td className="sh-directory__person">
                              <button
                                type="button"
                                className="sh-directory__person-link"
                                onClick={() => navigate(`/school/staff/${person.userId}`)}
                              >
                                {person.fullName}
                              </button>
                              <small>{person.username}</small>
                            </td>
                            <td>
                              <StatusBadge tone="teal" label={PERMISSION_ROLE_LABELS[person.role] || 'Chưa rõ'} />
                            </td>
                            <td>{placeOf(person)}</td>
                            <td>
                              <AccountStatusBadge status={person.status} />
                            </td>
                            <td>
                              {hasPermission(PERMISSIONS.PERMISSION_MANAGE) ? (
                                <button
                                  type="button"
                                  className="sh-directory__permission-link"
                                  onClick={() => navigate(`/school/staff/${person.userId}?tab=permissions`)}
                                >
                                  Xem quyền
                                </button>
                              ) : (
                                <span className="text-muted text-xs">Do Hiệu trưởng quản lý</span>
                              )}
                            </td>
                            <td className="text-right">
                              <div className="sh-directory__actions">
                                {canReset && !self && (
                                  <button
                                    type="button"
                                    className="btn btn--sm"
                                    onClick={() => setResetStaff(person)}
                                    title="Cấp lại mật khẩu tạm"
                                  >
                                    <KeyRound size={14} /> Cấp lại MK
                                  </button>
                                )}
                                {canStatus && !self && (
                                  <button
                                    type="button"
                                    className={`btn btn--sm ${active ? 'btn--outline-danger' : 'btn--outline-success'}`}
                                    onClick={() => setStatusStaff(person)}
                                    title={active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                                  >
                                    {active ? <Lock size={14} /> : <Unlock size={14} />} {active ? 'Khóa' : 'Mở'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ul className="sh-directory__mobile">
                  {data.items.map((person) => {
                    const self = isSelf(person);
                    const active = person.status === 'ACTIVE';
                    return (
                      <li
                        key={person.userId}
                        className="sh-directory__mobile-card"
                        tabIndex={0}
                        aria-label={`Mở hồ sơ ${person.fullName}`}
                        onClick={(event) => handleStaffRowClick(event, person)}
                        onKeyDown={(event) => handleStaffRowKeyDown(event, person)}
                      >
                        <div className="sh-directory__mobile-head">
                          <button
                            type="button"
                            className="sh-directory__person-link"
                            onClick={() => navigate(`/school/staff/${person.userId}`)}
                          >
                            {person.fullName}
                          </button>
                          <AccountStatusBadge status={person.status} />
                        </div>
                        <small>
                          {person.username} · {PERMISSION_ROLE_LABELS[person.role] || 'Chưa rõ'}
                        </small>
                        <p>{placeOf(person)}</p>
                        <div className="sh-directory__mobile-actions mt-2">
                          {canReset && !self && (
                            <button type="button" className="btn btn--sm" onClick={() => setResetStaff(person)}>
                              <KeyRound size={14} /> Cấp lại MK
                            </button>
                          )}
                          {canStatus && !self && (
                            <button
                              type="button"
                              className={`btn btn--sm ${active ? 'btn--outline-danger' : 'btn--outline-success'}`}
                              onClick={() => setStatusStaff(person)}
                            >
                              {active ? <Lock size={14} /> : <Unlock size={14} />} {active ? 'Khóa' : 'Mở'}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <Pagination
                  page={page + 1}
                  total={data.totalElements}
                  pageSize={PAGE_SIZE}
                  onChange={(next) => setPage(next - 1)}
                  unit="nhân sự"
                />
              </>
            )}
          </>
        )}
      </section>

      {/* Modal hồ sơ nhân sự */}
      {userId && (
        <Modal open={!!userId} size="lg" className="sh-person-modal" onClose={() => navigate('/school/staff')}>
          <StaffPersonSheet
            key={userId}
            userId={userId}
            structure={structure}
            onClose={() => navigate('/school/staff')}
            onChanged={() => reload({ silent: true })}
            isModal
          />
        </Modal>
      )}

      {/* Modal tạo mới nhân sự */}
      {createOpen && (
        <StaffFormModal
          onClose={() => setCreateOpen(false)}
          onCreated={(account) => {
            setCreateOpen(false);
            navigate(`/school/staff/${account.userId}`);
          }}
        />
      )}

      {/* Modal cấp lại mật khẩu tạm */}
      {resetStaff && (
        <ResetPasswordModal
          name={resetStaff.fullName}
          onClose={() => setResetStaff(null)}
          onSubmit={async (password) => {
            try {
              await resetTemporaryPassword(resetStaff.userId, password, user);
              toast.success(`Đã đặt mật khẩu tạm cho ${resetStaff.fullName}.`);
              setResetStaff(null);
              reload({ silent: true });
            } catch (err) {
              toast.error(err.message || 'Không thể cấp lại mật khẩu', 'Lỗi cấp lại mật khẩu');
            }
          }}
        />
      )}

      {/* Modal xác nhận khóa / mở khóa tài khoản */}
      {statusStaff && (
        <ConfirmationModal
          open={!!statusStaff}
          title={statusStaff.status === 'ACTIVE' ? 'Khóa tài khoản nhân sự' : 'Mở khóa tài khoản nhân sự'}
          message={
            statusStaff.status === 'ACTIVE'
              ? `Khóa tài khoản ${statusStaff.fullName}? Người này sẽ bị đăng xuất ngay và không thể đăng nhập cho tới khi mở lại.`
              : `Mở khóa tài khoản ${statusStaff.fullName}?`
          }
          danger={statusStaff.status === 'ACTIVE'}
          confirmLabel={statusStaff.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa'}
          onConfirm={async () => {
            const nextStatus = statusStaff.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
            try {
              await updateAccountStatus(statusStaff.userId, nextStatus, user);
              toast.success(
                nextStatus === 'INACTIVE' ? `Đã khóa tài khoản ${statusStaff.fullName}.` : `Đã mở khóa tài khoản ${statusStaff.fullName}.`,
              );
              setStatusStaff(null);
              reload({ silent: true });
            } catch (err) {
              toast.error(err.message || 'Không thể cập nhật trạng thái', 'Lỗi trạng thái tài khoản');
            }
          }}
          onClose={() => setStatusStaff(null)}
        />
      )}
    </div>
  );
}
