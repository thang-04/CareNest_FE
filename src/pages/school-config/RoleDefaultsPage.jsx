import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Lock } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useRolePermissionMatrix } from '@/hooks/account/usePermissions';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Switch } from '@/components/ui/Switch';
import { ReasonModal } from '@/components/account/StaffDialogs';
import { PermissionTabs } from '@/components/permissions/PermissionTabs';
import { updateRolePermissions } from '@/services/account/permissionService';
import {
  PERMISSION_GROUPS,
  PERMISSION_MODULE_LABELS,
  PERMISSION_ROLE_LABELS,
  PERMISSION_TASKS,
} from '@/models/account/permissionConstants';
import { permissionMatrixRows, PERMISSION_MATRIX_ROLES } from '@/utils/account/permissionMatrix';
import { permissionCrumbs } from '@/utils/school-config/breadcrumbs';
import '@/styles/modules/staff-hub.css';
import '@/styles/modules/permissions.css';

export default function RoleDefaultsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { catalog, roles, loading, error, reload } = useRolePermissionMatrix({ live: false });
  const [values, setValues] = useState({});
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);

  const rows = permissionMatrixRows(catalog, roles);
  const roleEntry = (role) => roles.find((entry) => entry.role === role);
  const valueOf = (role, code) => values[role]?.[code] ?? !!rows.find((row) => row.code === code)?.cells[role]?.checked;
  const isChanged = (role, code) => {
    const original = !!rows.find((row) => row.code === code)?.cells[role]?.checked;
    return role in values && code in values[role] && values[role][code] !== original;
  };

  const changesFor = (role) => rows.filter((row) => row.cells[role]?.configurable && valueOf(role, row.code) !== row.cells[role].checked);

  const labelOf = (code) => PERMISSION_TASKS[code]?.label || catalog.find((permission) => permission.code === code)?.description || code;

  const changedRoles = PERMISSION_MATRIX_ROLES.filter((role) => changesFor(role).length);
  const allChanges = changedRoles.flatMap((role) =>
    changesFor(role).map((row) => `${valueOf(role, row.code) ? 'Bật' : 'Tắt'} “${labelOf(row.code)}” cho ${PERMISSION_ROLE_LABELS[role]}`),
  );

  // Nhóm các quyền theo nhóm chức năng thân thiện
  const groupedRows = useMemo(() => {
    const groups = {};
    rows.forEach((row) => {
      const task = PERMISSION_TASKS[row.code];
      const groupKey = task?.group || row.module || 'other';
      if (!groups[groupKey]) {
        groups[groupKey] = {
          key: groupKey,
          label: PERMISSION_GROUPS[groupKey]?.label || PERMISSION_MODULE_LABELS[groupKey] || 'Nghiệp vụ khác',
          items: [],
        };
      }
      groups[groupKey].items.push(row);
    });
    return Object.values(groups);
  }, [rows]);

  const saveAll = async (reason) => {
    setSaving(true);
    const results = await Promise.allSettled(
      changedRoles.map((role) => {
        const permissions = roleEntry(role).configurablePermissions.filter((code) => valueOf(role, code));
        return updateRolePermissions(role, { permissions, reason }, user);
      }),
    );
    const savedRoles = changedRoles.filter((_, index) => results[index].status === 'fulfilled');
    const failedRoles = changedRoles.filter((_, index) => results[index].status === 'rejected');
    setValues((current) => {
      const next = { ...current };
      savedRoles.forEach((role) => delete next[role]);
      return next;
    });
    setAsking(false);
    if (savedRoles.length) reload({ silent: true });
    if (failedRoles.length) {
      const names = failedRoles.map((role) => PERMISSION_ROLE_LABELS[role]).join(', ');
      const failure = results.find((result) => result.status === 'rejected');
      toast.error(`${failure.reason?.message || 'Có lỗi khi lưu.'} Chưa lưu được: ${names}.`, 'Lưu phân quyền chưa hoàn tất');
    } else {
      toast.success('Đã lưu toàn bộ thay đổi phân quyền theo vai trò.');
    }
    setSaving(false);
  };

  const handleReset = () => {
    setValues({});
  };

  return (
    <div className="page">
      <Breadcrumb items={permissionCrumbs('Quyền theo vai trò')} />
      <PermissionTabs />

      <div className="sh-head permission-page-head">
        <div>
          <h1>Quyền theo vai trò</h1>
          <p className="text-sm text-2">
            Cấu hình quyền mặc định áp dụng chung cho Phó hiệu trưởng và Giáo viên toàn trường. Ngoại lệ cho từng cá nhân được quản lý ở tab
            “Quyền ngoại lệ từng người”.
          </p>
        </div>
        <div className="sh-head__actions">
          <Link className="btn" to="/permissions/history">
            <History size={16} /> Lịch sử thay đổi
          </Link>
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <LoadingState />
      ) : (
        <>
          <div className="card table-wrap permission-matrix-wrap">
            <table className="perm-matrix-v2 permission-matrix">
              <thead>
                <tr>
                  <th>Nghiệp vụ / Quyền được thực hiện</th>
                  {PERMISSION_MATRIX_ROLES.map((role) => (
                    <th key={role} className="perm-col-role">
                      {PERMISSION_ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupedRows.map((group) => (
                  <Fragment key={group.key}>
                    <tr className="perm-group-row">
                      <td colSpan={PERMISSION_MATRIX_ROLES.length + 1}>{group.label}</td>
                    </tr>
                    {group.items.map((row) => {
                      const task = PERMISSION_TASKS[row.code];
                      return (
                        <tr key={row.code}>
                          <td>
                            <strong>{task?.label || row.description}</strong>
                            {task?.hint && <small className="text-muted d-block mt-1">{task.hint}</small>}
                          </td>
                          {PERMISSION_MATRIX_ROLES.map((role) => {
                            const cell = row.cells[role];
                            const rolePermission = roleEntry(role);
                            const changed = isChanged(role, row.code);
                            const currentVal = valueOf(role, row.code);
                            return (
                              <td key={role} className="perm-col-role">
                                <div className={`perm-cell-content ${changed ? 'perm-cell--changed' : ''}`}>
                                  {cell.configurable ? (
                                    <Switch
                                      checked={currentVal}
                                      label={`${labelOf(row.code)} cho ${PERMISSION_ROLE_LABELS[role]}`}
                                      onChange={(next) =>
                                        setValues((current) => ({
                                          ...current,
                                          [role]: { ...current[role], [row.code]: next },
                                        }))
                                      }
                                    />
                                  ) : (
                                    <span className="sh-lock">
                                      <Lock size={14} />{' '}
                                      {rolePermission?.permissions?.includes(row.code) ? 'Cố định theo quy định' : 'Không cấu hình'}
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {allChanges.length > 0 && (
            <div className="perm-floating-bar" role="region" aria-label="Thao tác lưu thay đổi">
              <div className="perm-floating-bar__info">
                <span>
                  Bạn có <strong>{allChanges.length}</strong> thay đổi phân quyền chưa lưu.
                </span>
              </div>
              <div className="perm-floating-bar__actions">
                <button className="btn" type="button" disabled={saving} onClick={handleReset}>
                  Hủy thay đổi
                </button>
                <button className="btn btn--primary" type="button" disabled={saving} onClick={() => setAsking(true)}>
                  Lưu phân quyền
                </button>
              </div>
            </div>
          )}

          {asking && <ReasonModal saving={saving} changes={allChanges} onClose={() => setAsking(false)} onSubmit={saveAll} />}
        </>
      )}
    </div>
  );
}
