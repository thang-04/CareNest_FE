import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, KeyRound, PauseCircle, Plus, RotateCcw, Users } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolStructure, useStaffAccountPage } from '@/hooks/school-config/useSchoolConfig';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Avatar } from '@/components/ui/Avatar';
import { RowActions } from '@/components/ui/RowActions';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, SkeletonRows, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { Pagination } from '@/components/ui/Pagination';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { ScNoAccess } from '@/components/school-config/ScNoAccess';
import { StaffStatusBadge } from '@/components/school-config/SchoolConfigBadges';
import { StaffImportPanel } from '@/components/school-config/StaffImportPanel';
import { ROLES, ROLE_LABELS } from '@/models/User';
import {
  createStaffAccount,
  listAllStaffAccounts,
  resetStaffPassword,
  setStaffAccountStatus,
} from '@/services/school-config/schoolConfigService';
import { STAFF_ROLES, normalizePhone, staffExportRows, toCreatePayload, validateStaffAccount } from '@/utils/school-config/staffImport';
import { staffCrumbs } from '@/utils/school-config/breadcrumbs';
import { downloadCsv } from '@/utils/exportCsv';
import { todayInput } from '@/utils/format';

const PAGE_SIZE = 10;
const ROLE_FILTERS = [ROLES.PRINCIPAL, ...STAFF_ROLES];
const EMPTY_FORM = { fullName: '', phone: '', email: '', role: ROLES.TEACHER, campusId: '', classroomId: '' };

/** Đổi dòng BE sang dạng màn hiển thị: SĐT = tên đăng nhập (AUTH-21), điểm trường / lớp / tổ trưởng từ phân công đang hiệu lực. */
export const toStaffRow = (a, { campusById, classById, groupById }) => {
  const campusIds = new Set();
  const classNames = [];
  const duties = [];
  (a.activeAssignments || []).forEach((s) => {
    const cls = s.classroomId ? classById(s.classroomId) : null;
    const campusId = s.campusId || cls?.campusId;
    if (campusId) campusIds.add(String(campusId));
    if (s.staffRole === ROLES.VICE_PRINCIPAL) duties.push(`Phụ trách ${campusById(campusId)?.shortName || 'điểm trường'}`);
    else if (s.staffRole === ROLES.TEAM_LEADER) duties.push(`Tổ trưởng ${groupById(s.ageGroupId)?.name || 'nhóm tuổi'}`);
    else if (cls) {
      classNames.push(cls.name);
      duties.push(`Dạy ${cls.name}`);
    }
  });
  return {
    ...a,
    id: a.userId,
    phone: normalizePhone(a.username) || '',
    campusNames: [...campusIds].map((id) => campusById(id)?.shortName || campusById(id)?.name).filter(Boolean),
    classNames,
    duties,
  };
};

/** Tài khoản nhân sự nối BE thật: quyền theo ma trận dev (ACCOUNT_MANAGE tạo / cấp lại mật khẩu, ACCOUNT_STATUS_MANAGE khóa / mở). */
export function StaffAccountsBeView({ tabs = null }) {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const { schoolYear: yearId } = useSchoolYear();
  const { structure } = useSchoolStructure(yearId, '');
  const [filters, setFilters] = useState({ q: '', role: '', campusId: '', status: '' });
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useStaffAccountPage(filters, page);
  const [creating, setCreating] = useState(false);
  const [statusOf, setStatusOf] = useState(null);
  const [passwordOf, setPasswordOf] = useState(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const canCreate = hasPermission('ACCOUNT_MANAGE');
  const canLock = hasPermission('ACCOUNT_STATUS_MANAGE');
  const canView = hasPermission('ACCOUNT_MANAGE', 'ACCOUNT_STATUS_MANAGE', 'STAFF_ASSIGNMENT_MANAGE', 'PERMISSION_MANAGE');
  const classes = useMemo(() => structure?.classes || [], [structure]);
  const lookups = useMemo(() => {
    const cls = Object.fromEntries(classes.map((c) => [String(c.id), c]));
    const groups = Object.fromEntries((structure?.ageGroups || []).map((g) => [String(g.id), g]));
    return { campusById: (id) => md.campusById(String(id)), classById: (id) => cls[String(id)], groupById: (id) => groups[String(id)] };
  }, [classes, structure, md]);
  const rows = (data?.items || []).map((a) => toStaffRow(a, lookups));

  if (!canView)
    return (
      <div className="page">
        <Breadcrumb items={staffCrumbs()} />
        <h1 className="page__title">Tài khoản nhân sự</h1>
        <ScNoAccess description="Bạn chưa được cấp quyền quản lý tài khoản nhân sự." />
      </div>
    );

  const setFilter = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };
  const exportExcel = async () => {
    setExporting(true);
    try {
      const all = (await listAllStaffAccounts(filters)).map((a) => toStaffRow(a, lookups));
      downloadCsv(staffExportRows(all), `tai-khoan-nhan-su-${todayInput()}.csv`);
    } catch (err) {
      toast.error(err, 'Không xuất được danh sách');
    } finally {
      setExporting(false);
    }
  };
  const done = (setter) => (changed) => {
    setter(null);
    if (changed) reload({ silent: true });
  };
  const actions = canCreate || canLock;

  return (
    <div className="page">
      <Breadcrumb items={staffCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Tài khoản nhân sự</h1>
        <div className="row">
          <button className="btn" onClick={exportExcel} disabled={exporting}>
            {exporting ? <Spinner small /> : <Download size={16} />} Xuất Excel
          </button>
          {canCreate && (
            <>
              <button className="btn" onClick={() => setImporting(true)}>
                <FileSpreadsheet size={16} /> Nhập từ Excel
              </button>
              <button className="btn btn--primary btn--lg" onClick={() => setCreating(true)}>
                <Plus size={18} /> Thêm tài khoản
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card mb-16">
        {tabs}
        <div className="filter-bar">
          <SearchSubmit
            className="sc-search"
            value={filters.q}
            placeholder="Tìm họ tên, SĐT, email"
            label="Tìm họ tên, số điện thoại hoặc email"
            onSearch={(q) => setFilter({ q })}
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
          {md.campuses.length > 1 && (
            <select
              className="select sc-inline-select"
              aria-label="Điểm trường"
              value={filters.campusId}
              onChange={(e) => setFilter({ campusId: e.target.value })}
            >
              <option value="">Tất cả điểm trường</option>
              {md.campuses.map((c) => (
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
                  {actions && <th className="cell--actions">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={6} cols={actions ? 7 : 6} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={actions ? 7 : 6}>
                      <EmptyState icon={Users} title="Không có tài khoản phù hợp" description="Thử đổi từ khóa hoặc bộ lọc." />
                    </td>
                  </tr>
                ) : (
                  rows.map((u) => {
                    const active = u.status !== 'INACTIVE';
                    const self = String(u.userId) === String(user?.id);
                    const manageable = !self && u.role !== ROLES.PRINCIPAL;
                    return (
                      <tr key={u.userId} className={active ? undefined : 'muted'}>
                        <td>
                          <div className="sc-person">
                            <Avatar user={u} size="sm" />
                            <div className="sc-person__text">
                              <div className="fw-600">{u.fullName}</div>
                              <div className="text-xs muted">{u.email || u.username}</div>
                            </div>
                          </div>
                        </td>
                        <td>{ROLE_LABELS[u.role] || <span className="muted">—</span>}</td>
                        <td>{u.campusNames.join(', ') || <span className="muted">—</span>}</td>
                        <td className="text-sm sc-wrap">{u.duties.join(' · ') || <span className="muted">—</span>}</td>
                        <td className="nowrap">{u.phone || <span className="muted">—</span>}</td>
                        <td className="center">
                          <StaffStatusBadge status={u.status || 'ACTIVE'} />
                        </td>
                        {actions && (
                          <td className="cell--actions">
                            {manageable && (
                              <RowActions
                                menu={[
                                  ...(canCreate
                                    ? [{ label: 'Cấp lại mật khẩu tạm', icon: KeyRound, onClick: () => setPasswordOf(u) }]
                                    : []),
                                  ...(canLock
                                    ? [
                                        active
                                          ? { label: 'Vô hiệu hóa', icon: PauseCircle, danger: true, onClick: () => setStatusOf(u) }
                                          : { label: 'Kích hoạt lại', icon: RotateCcw, onClick: () => setStatusOf(u) },
                                      ]
                                    : []),
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
        {(data?.totalElements || 0) > PAGE_SIZE && (
          <Pagination page={page} total={data.totalElements} pageSize={PAGE_SIZE} onChange={setPage} unit="người" />
        )}
      </div>

      {creating && <StaffCreateModal campuses={md.campuses} classes={classes} onClose={done(setCreating)} />}
      {statusOf && <StaffStatusConfirm account={statusOf} onClose={done(setStatusOf)} />}
      {passwordOf && <StaffPasswordModal account={passwordOf} onClose={done(setPasswordOf)} />}
      <StaffImportPanel
        open={importing}
        campuses={md.campuses}
        classes={classes}
        onClose={(changed) => {
          setImporting(false);
          if (changed) reload({ silent: true });
        }}
      />
    </div>
  );
}

function StaffCreateModal({ campuses, classes, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in patch))));
  };
  const blur = (field) => {
    const e = validateStaffAccount(form, { campuses, classes });
    if (e[field]) setErrors((prev) => ({ ...prev, [field]: e[field] }));
  };
  const save = async () => {
    const e = validateStaffAccount(form, { campuses, classes });
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      const res = await createStaffAccount(toCreatePayload(form));
      toast.success(
        res?.setupEmailSent ? 'Đã gửi email đặt mật khẩu cho nhân sự.' : 'Chưa gửi được email: hãy cấp mật khẩu tạm cho nhân sự.',
        `Đã tạo tài khoản ${form.fullName}`,
      );
      onClose(true);
    } catch (err) {
      setErrors(err.details || { _form: err.message });
      setSaving(false);
    }
  };
  const teacher = form.role === ROLES.TEACHER;
  return (
    <Modal
      open
      title="Thêm tài khoản nhân sự"
      onClose={() => onClose(false)}
      footer={
        <>
          <button className="btn" onClick={() => onClose(false)} disabled={saving}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={save} disabled={saving}>
            {saving ? <Spinner small /> : <Plus size={16} />} Tạo tài khoản
          </button>
        </>
      }
    >
      {errors._form && (
        <div className="alert alert--danger mb-12" role="alert">
          {errors._form}
        </div>
      )}
      <div className="grid-2">
        <FormField label="Họ tên" required error={errors.fullName}>
          <input
            className="input"
            maxLength={150}
            value={form.fullName}
            onChange={(e) => set({ fullName: e.target.value })}
            onBlur={() => blur('fullName')}
          />
        </FormField>
        <FormField label="Số điện thoại (tên đăng nhập)" required error={errors.phone}>
          <input
            className="input"
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => set({ phone: e.target.value })}
            onBlur={() => blur('phone')}
          />
        </FormField>
        <FormField label="Email" error={errors.email}>
          <input
            className="input"
            type="email"
            maxLength={255}
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
            onBlur={() => blur('email')}
          />
        </FormField>
        <FormField label="Vai trò" required error={errors.role}>
          <select className="select" value={form.role} onChange={(e) => set({ role: e.target.value, campusId: '', classroomId: '' })}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </FormField>
        {teacher ? (
          <FormField label="Lớp" required error={errors.classroomId}>
            <select
              className="select"
              value={form.classroomId}
              onChange={(e) => set({ classroomId: e.target.value })}
              onBlur={() => blur('classroomId')}
            >
              <option value="">Chọn lớp</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>
        ) : (
          <FormField label="Điểm trường" required error={errors.campusId}>
            <select
              className="select"
              value={form.campusId}
              onChange={(e) => set({ campusId: e.target.value })}
              onBlur={() => blur('campusId')}
            >
              <option value="">Chọn điểm trường</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shortName || c.name}
                </option>
              ))}
            </select>
          </FormField>
        )}
      </div>
    </Modal>
  );
}

function StaffStatusConfirm({ account, onClose }) {
  const toast = useToast();
  const [error, setError] = useState('');
  const locking = account.status !== 'INACTIVE';
  const confirm = async () => {
    try {
      await setStaffAccountStatus(account.userId, locking ? 'INACTIVE' : 'ACTIVE');
      toast.success(locking ? 'Đã vô hiệu hóa tài khoản.' : 'Đã kích hoạt lại tài khoản.', account.fullName);
      onClose(true);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <ConfirmationModal
      open
      danger={locking}
      title={locking ? `Vô hiệu hóa tài khoản ${account.fullName}?` : `Kích hoạt lại tài khoản ${account.fullName}?`}
      message={locking ? 'Nhân sự bị đăng xuất và không đăng nhập được cho tới khi kích hoạt lại.' : 'Nhân sự đăng nhập lại được.'}
      confirmLabel={locking ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
      error={error}
      onConfirm={confirm}
      onClose={() => onClose(false)}
    />
  );
}

function StaffPasswordModal({ account, onClose }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (password.length < 8 || password.length > 128) return setError('Mật khẩu tạm từ 8 đến 128 ký tự');
    setSaving(true);
    try {
      await resetStaffPassword(account.userId, password);
      toast.success('Nhân sự phải đổi mật khẩu ở lần đăng nhập tới.', 'Đã cấp mật khẩu tạm');
      onClose(true);
    } catch (err) {
      setError(err.details?.temporaryPassword || err.message);
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      title={`Cấp lại mật khẩu tạm cho ${account.fullName}`}
      onClose={() => onClose(false)}
      footer={
        <>
          <button className="btn" onClick={() => onClose(false)} disabled={saving}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={save} disabled={saving}>
            {saving ? <Spinner small /> : <KeyRound size={16} />} Cấp mật khẩu
          </button>
        </>
      }
    >
      <FormField label="Mật khẩu tạm" required error={error}>
        <input
          className="input"
          type="text"
          autoComplete="off"
          maxLength={128}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
        />
      </FormField>
    </Modal>
  );
}
