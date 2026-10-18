import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building, Check, History, KeyRound, Lock, MapPin, Pencil, Unlock } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useStaffAccount } from '@/hooks/account/useStaff';
import { usePermissionOverrides, useRolePermissionMatrix } from '@/hooks/account/usePermissions';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AssignModal, EndAssignmentModal, ResetPasswordModal } from '@/components/account/StaffDialogs';
import { OverrideWizardModal } from '@/components/permissions/OverrideWizardModal';
import { assignStaff, endAssignment, resetTemporaryPassword, updateAccountStatus } from '@/services/account/staffService';
import { ACCOUNT_STATUS_LABELS, PERMISSIONS, PERMISSION_ROLE_LABELS, PERMISSION_TASKS } from '@/models/account/permissionConstants';
import { STAFF_ROLE_LABELS } from '@/models/account/accountConstants';
import { assignmentTargetOf } from '@/utils/account/staffValidation';
import { personPermissionRows } from '@/utils/account/personPermissions';
import { avatarTone, formatDate, initials, todayInput } from '@/utils/format';

/** Tờ của một nhân sự: Làm ở đâu? · Được làm những gì? · Tài khoản (BE AUTH-10, AUTH-16, AUTH-17). */
export function StaffPersonSheet({ userId, structure, onChanged, _onClose, isModal = false }) {
  const { user, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { data: account, loading, error, reload } = useStaffAccount(userId);
  const [dialog, setDialog] = useState(null);

  const isSelf = String(userId) === String(user?.id) || String(userId) === String(user?.userId);
  const canStatus = hasPermission(PERMISSIONS.ACCOUNT_STATUS_MANAGE) && !isSelf;
  const canReset = hasPermission(PERMISSIONS.ACCOUNT_MANAGE) && !isSelf;
  const canAssign = hasPermission(PERMISSIONS.STAFF_ASSIGNMENT_MANAGE) && !isSelf;
  const canPermissions = hasPermission(PERMISSIONS.PERMISSION_MANAGE);
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState(requestedTab || 'assignments');
  const activeTab = tab === 'permissions' && canPermissions ? 'permissions' : tab === 'account' ? 'account' : 'assignments';

  const handleTabChange = (nextTab) => {
    setTab(nextTab);
    setSearchParams({ tab: nextTab }, { replace: true });
  };

  const run = async (action, success) => {
    try {
      await action();
      toast.success(success);
      setDialog(null);
      reload({ silent: true });
      onChanged?.();
    } catch (err) {
      toast.error(err.message, 'Không thực hiện được');
    }
  };

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !account) return <LoadingState />;

  const active = account.status === 'ACTIVE';
  const today = todayInput();
  const current = account.assignments.filter((a) => !a.validTo || a.validTo >= today);
  const past = account.assignments.filter((a) => a.validTo && a.validTo < today);
  const roleLabel = PERMISSION_ROLE_LABELS[account.role] || 'Chưa rõ vai trò';

  return (
    <div className={`sh-sheet ${isModal ? 'sh-sheet--modal' : 'card'}`}>
      {!isModal && (
        <Link className="sh-back" to="/school/staff">
          <ArrowLeft size={16} /> Nhân sự
        </Link>
      )}
      <div className="sh-sheet__top">
        <span className={`avatar avatar--lg avatar--tone-${avatarTone(account.fullName)}`}>{initials(account.fullName)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="sh-sheet__name">{account.fullName}</h2>
          <div className="sh-sheet__meta">{roleLabel}</div>
        </div>
        {canPermissions && (
          <Link className="link-btn" to={`/permissions/history?userId=${account.userId}`}>
            <History size={16} /> Lịch sử thay đổi
          </Link>
        )}
      </div>

      <nav className="sh-detail-tabs" aria-label="Hồ sơ nhân sự">
        {[['assignments', 'Phân công'], ...(canPermissions ? [['permissions', 'Quyền']] : []), ['account', 'Tài khoản']].map(
          ([key, label]) => (
            <button key={key} type="button" aria-current={activeTab === key ? 'page' : undefined} onClick={() => handleTabChange(key)}>
              {label}
            </button>
          ),
        )}
      </nav>

      {activeTab === 'assignments' && (
        <div className="sh-q">
          <div className="sh-q__head">
            <h3 className="sh-q__title">Làm ở đâu?</h3>
            {canAssign && assignmentTargetOf(account.role) && (
              <button className="btn btn--sm" onClick={() => setDialog({ type: 'assign' })}>
                <MapPin size={15} /> Thêm nơi làm
              </button>
            )}
          </div>
          {current.length === 0 ? (
            <p className="text-sm text-2" style={{ margin: 0 }}>
              Chưa có nơi làm việc, nên người này chưa xem được dữ liệu của điểm trường hay lớp nào.
            </p>
          ) : (
            current.map((a) => (
              <div key={a.id} className="sh-place">
                <span className="sh-place__icon">
                  <Building size={18} />
                </span>
                <div className="sh-place__main">
                  <div className="fw-600">{structure.describe(a)}</div>
                  <div className="text-sm text-2">
                    {STAFF_ROLE_LABELS[a.staffRole] || a.staffRole} · từ {formatDate(a.validFrom)}
                    {a.validTo ? ` đến ${formatDate(a.validTo)}` : ''}
                  </div>
                </div>
                {canAssign && a.staffRole !== 'PRINCIPAL' && (
                  <button className="btn btn--sm" onClick={() => setDialog({ type: 'end', assignment: a })}>
                    Kết thúc
                  </button>
                )}
              </div>
            ))
          )}
          {past.length > 0 && (
            <details className="sh-past">
              <summary>{past.length} nơi làm đã kết thúc</summary>
              <ul>
                {past.map((a) => (
                  <li key={a.id}>
                    {structure.describe(a)} · {formatDate(a.validFrom)} – {formatDate(a.validTo)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {activeTab === 'permissions' && <PersonPermissions key={account.userId} account={account} isSelf={isSelf} onSaved={onChanged} />}

      {activeTab === 'account' && (
        <div className="sh-q">
          <div className="sh-q__head">
            <h3 className="sh-q__title">Tài khoản</h3>
          </div>
          <div className="sh-acc">
            <dl>
              <div>
                <dt>Tên đăng nhập</dt>
                <dd>{account.username}</dd>
              </div>
              <div>
                <dt>Trạng thái</dt>
                <dd>{ACCOUNT_STATUS_LABELS[account.status] || account.status}</dd>
              </div>
              {account.email && (
                <div>
                  <dt>Email</dt>
                  <dd>{account.email}</dd>
                </div>
              )}
            </dl>
            <div className="sh-actions">
              {canReset && (
                <button className="btn btn--sm" onClick={() => setDialog({ type: 'password' })}>
                  <KeyRound size={15} /> Cấp lại mật khẩu
                </button>
              )}
              {canStatus && (
                <button className={`btn btn--sm ${active ? 'btn--outline-danger' : ''}`} onClick={() => setDialog({ type: 'status' })}>
                  {active ? <Lock size={15} /> : <Unlock size={15} />} {active ? 'Khóa' : 'Mở khóa'}
                </button>
              )}
            </div>
          </div>
          {isSelf && <p className="text-sm text-2 mt-12">Đây là tài khoản của bạn; đổi mật khẩu ở mục Hồ sơ cá nhân.</p>}
        </div>
      )}

      <ConfirmationModal
        open={dialog?.type === 'status'}
        title={active ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
        message={
          active
            ? `Khóa tài khoản ${account.fullName}? Người này bị đăng xuất và không đăng nhập được cho tới khi mở lại.`
            : `Mở khóa tài khoản ${account.fullName}?`
        }
        danger={active}
        confirmLabel={active ? 'Khóa' : 'Mở khóa'}
        onConfirm={() =>
          run(
            () => updateAccountStatus(account.userId, active ? 'INACTIVE' : 'ACTIVE', user),
            active ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.',
          )
        }
        onClose={() => setDialog(null)}
      />
      {dialog?.type === 'password' && (
        <ResetPasswordModal
          name={account.fullName}
          onClose={() => setDialog(null)}
          onSubmit={(password) =>
            run(
              () => resetTemporaryPassword(account.userId, password, user),
              'Đã đặt mật khẩu tạm; người dùng phải đổi ở lần đăng nhập kế tiếp.',
            )
          }
        />
      )}
      {dialog?.type === 'assign' && (
        <AssignModal
          role={account.role}
          structure={structure}
          onClose={() => setDialog(null)}
          onSubmit={(payload) => run(() => assignStaff({ userId: account.userId, ...payload }, user), 'Đã thêm nơi làm việc.')}
        />
      )}
      {dialog?.type === 'end' && (
        <EndAssignmentModal
          assignment={dialog.assignment}
          scope={structure.describe(dialog.assignment)}
          onClose={() => setDialog(null)}
          onSubmit={(validTo) => run(() => endAssignment(dialog.assignment.id, validTo, user), 'Đã kết thúc nơi làm việc.')}
        />
      )}
    </div>
  );
}

/** "Được làm những gì?": Chế độ xem nhanh (Read-only) quyền hiệu lực kèm nút mở Wizard chỉnh sửa (BE AUTH-10). */
function PersonPermissions({ account, isSelf, onSaved }) {
  const { hasPermission } = useAuth();
  const matrix = useRolePermissionMatrix({ live: false });
  const overrides = usePermissionOverrides(account.userId, { live: false });
  const [showWizard, setShowWizard] = useState(false);

  const canPermissions = hasPermission(PERMISSIONS.PERMISSION_MANAGE);
  const roleLabel = PERMISSION_ROLE_LABELS[account.role] || 'vai trò này';
  const rows = useMemo(() => {
    if (!overrides.data) return [];
    const roleDefaults = matrix.roles.find((r) => r.role === account.role)?.permissions || [];
    return personPermissionRows({
      configurable: overrides.data.configurablePermissions,
      roleDefaults,
      overrides: overrides.data.overrides,
      effectivePermissions: overrides.data.effectivePermissions,
    });
  }, [overrides.data, matrix.roles, account.role]);

  const task = (code) => PERMISSION_TASKS[code] || { label: matrix.catalog.find((p) => p.code === code)?.description || code };

  if (overrides.error || matrix.error)
    return (
      <ErrorState
        error={overrides.error || matrix.error}
        onRetry={() => {
          if (overrides.error) overrides.reload();
          if (matrix.error) matrix.reload();
        }}
      />
    );
  if (overrides.loading || matrix.loading || !overrides.data) return <LoadingState />;

  const customOverridesCount = overrides.data.overrides?.length || 0;

  return (
    <div className="sh-q">
      <div className="sh-q__head">
        <div>
          <h3 className="sh-q__title">Quyền hiệu lực của nhân sự</h3>
          <p className="text-xs text-muted m-0 mt-1">Quyền thực tế người này được phép thực hiện trên hệ thống.</p>
        </div>
        <div className="d-flex align-items-center gap-2">
          {canPermissions && !isSelf && (
            <button className="btn btn--primary btn--sm" type="button" onClick={() => setShowWizard(true)}>
              <Pencil size={14} /> Chỉnh sửa ngoại lệ
            </button>
          )}
          <Link className="btn btn--sm" to={`/permissions/history?userId=${account.userId}`}>
            <History size={14} /> Xem lịch sử
          </Link>
        </div>
      </div>

      <div className="mb-3">
        {customOverridesCount > 0 ? (
          <StatusBadge tone="orange" label={`Đang có ${customOverridesCount} quyền ngoại lệ riêng so với vai trò ${roleLabel}`} />
        ) : (
          <StatusBadge tone="green" label={`100% tuân thủ quyền mặc định theo vai trò ${roleLabel}`} />
        )}
      </div>

      {!rows.length ? (
        <p className="text-sm text-2" style={{ margin: 0 }}>
          {account.role === 'KITCHEN_STAFF'
            ? 'Nhân viên bếp làm việc ở bếp; không có quyền cấu hình riêng.'
            : `Quyền của ${roleLabel} do hệ thống cố định theo quy định.`}
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table sh-permission-table">
            <thead>
              <tr>
                <th>Nghiệp vụ / Việc được làm</th>
                <th>Trạng thái hiệu lực</th>
                <th>Nguồn gốc quyền</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const t = task(row.code);
                const isOverridden = row.on !== row.roleOn;
                return (
                  <tr key={row.code}>
                    <td>
                      <strong>{t.label}</strong>
                      {t.hint && <small className="text-muted d-block">{t.hint}</small>}
                    </td>
                    <td>
                      {row.effective ? (
                        <StatusBadge tone="green" icon={Check} label="Có quyền thực hiện" />
                      ) : (
                        <StatusBadge tone="gray" label="Không có quyền" />
                      )}
                    </td>
                    <td>
                      {isOverridden ? (
                        row.on ? (
                          <StatusBadge tone="green" label="+ Cấp riêng" />
                        ) : (
                          <StatusBadge tone="orange" label="− Thu hồi riêng" />
                        )
                      ) : (
                        <StatusBadge tone="gray" label={`Theo vai trò (${roleLabel})`} />
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td>
                  <strong>{PERMISSION_TASKS.PERMISSION_MANAGE.label}</strong>
                  <small className="text-muted d-block">Phân quyền cho người khác</small>
                </td>
                <td>
                  {overrides.data.effectivePermissions.includes(PERMISSIONS.PERMISSION_MANAGE) ? (
                    <StatusBadge tone="green" icon={Check} label="Có quyền thực hiện" />
                  ) : (
                    <StatusBadge tone="gray" label="Không có quyền" />
                  )}
                </td>
                <td>
                  <span className="sh-lock">
                    <Lock size={14} /> Cố định (Chỉ Hiệu trưởng)
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {showWizard && (
        <OverrideWizardModal
          open
          initialStaff={{
            userId: account.userId,
            fullName: account.fullName,
            role: account.role,
            campusName: account.assignments?.[0]?.campusName,
          }}
          onClose={() => setShowWizard(false)}
          onSaved={() => {
            setShowWizard(false);
            overrides.reload({ silent: true });
            onSaved?.();
          }}
        />
      )}
    </div>
  );
}
