import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useRolePermissionMatrix } from '@/hooks/account/usePermissions';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { ReasonModal } from '@/components/permissions/ReasonModal';
import { PermissionTabs } from '@/components/permissions/PermissionTabs';
import { PermissionCheckCell, PermissionFixedCell, PermissionTable } from '@/components/permissions/PermissionTable';
import { updateRolePermissions } from '@/services/account/permissionService';
import { PERMISSION_ROLE_LABELS, PERMISSION_TASKS } from '@/models/account/permissionConstants';
import {
  codeDiff,
  configurableCheck,
  permissionTableRows,
  PERMISSION_MATRIX_ROLES,
  toggleWithRequires,
} from '@/utils/account/permissionMatrix';
import { permissionCrumbs } from '@/utils/school-config/breadcrumbs';
import '@/styles/modules/permissions.css';

const sameCodes = (a, b) => a.length === b.length && a.every((code) => b.includes(code));
const taskLabel = (code) => PERMISSION_TASKS[code]?.label || code;

export default function RoleDefaultsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { catalog, roles, loading, error, reload } = useRolePermissionMatrix({ live: false });
  const [drafts, setDrafts] = useState({});
  const [notice, setNotice] = useState('');
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => permissionTableRows(catalog), [catalog]);
  const roleEntry = (role) => roles.find((entry) => entry.role === role);
  const originalOf = (role) => roleEntry(role)?.permissions || [];
  const codesOf = (role) => drafts[role] ?? originalOf(role);

  const toggle = (role, code, on) => {
    const result = toggleWithRequires(catalog, codesOf(role), code, on, configurableCheck(roleEntry(role)));
    setDrafts((current) => {
      const copy = { ...current };
      if (sameCodes(result.codes, originalOf(role))) delete copy[role];
      else copy[role] = result.codes;
      return copy;
    });
    // Báo việc tự tick/bỏ tick kèm theo để người dùng không bất ngờ
    const roleName = PERMISSION_ROLE_LABELS[role];
    if (result.added.length)
      setNotice(`Đã tự tick “${result.added.map(taskLabel).join('”, “')}” cho ${roleName} vì “${taskLabel(code)}” cần quyền xem.`);
    else if (result.removed.length)
      setNotice(`Đã tự bỏ tick “${result.removed.map(taskLabel).join('”, “')}” cho ${roleName} vì cần quyền “${taskLabel(code)}”.`);
    else setNotice('');
  };

  const changedRoles = PERMISSION_MATRIX_ROLES.filter((role) => role in drafts);
  // Lưu cần lý do (ReasonModal) ⇒ hộp rời màn không có nút Lưu; Hủy giữ nguyên các tick chưa lưu
  const guard = useLeaveGuard({ when: changedRoles.length > 0 });
  const allChanges = changedRoles.flatMap((role) => {
    const { added, removed } = codeDiff(originalOf(role), codesOf(role));
    const roleName = PERMISSION_ROLE_LABELS[role];
    return [
      ...added.map((code) => `Bật “${taskLabel(code)}” cho ${roleName}`),
      ...removed.map((code) => `Tắt “${taskLabel(code)}” cho ${roleName}`),
    ];
  });

  const saveAll = async (reason) => {
    if (saving) return;
    setSaving(true);
    const results = await Promise.allSettled(
      changedRoles.map((role) => {
        const permissions = roleEntry(role).configurablePermissions.filter((code) => codesOf(role).includes(code));
        return updateRolePermissions(role, { permissions, reason }, user);
      }),
    );
    const savedRoles = changedRoles.filter((_, index) => results[index].status === 'fulfilled');
    const failedRoles = changedRoles.filter((_, index) => results[index].status === 'rejected');
    setDrafts((current) => {
      const next = { ...current };
      savedRoles.forEach((role) => delete next[role]);
      return next;
    });
    setNotice('');
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

  const columns = PERMISSION_MATRIX_ROLES.map((role) => {
    const entry = roleEntry(role);
    const isConfigurable = configurableCheck(entry);
    const fixed = entry?.editable === false;
    return {
      key: role,
      header: PERMISSION_ROLE_LABELS[role],
      note: fixed ? 'Cố định' : null,
      fixed,
      render: (code) => {
        const checked = codesOf(role).includes(code);
        if (!isConfigurable(code)) {
          return (
            <PermissionFixedCell
              has={checked}
              reason={fixed ? 'Quyền của vai trò này cố định, không chỉnh ở đây' : 'Chưa mở cấu hình việc này cho vai trò này'}
            />
          );
        }
        return (
          <PermissionCheckCell
            checked={checked}
            disabled={saving}
            changed={checked !== originalOf(role).includes(code)}
            label={`${taskLabel(code)} — ${PERMISSION_ROLE_LABELS[role]}`}
            onChange={(on) => toggle(role, code, on)}
          />
        );
      },
    };
  });

  return (
    <div className="page permission-center">
      <Breadcrumb items={permissionCrumbs('Quyền theo vai trò')} />
      <div className="page__head permission-page-head">
        <div>
          <h1 className="page__title">Quyền theo vai trò</h1>
          <p className="text-sm text-2">
            Tick việc mà từng vai trò được làm. Áp dụng chung cho Phó hiệu trưởng, Giáo viên và Nhân viên bếp toàn trường; ngoại lệ cho từng
            người ở tab “Quyền ngoại lệ từng người”.
          </p>
        </div>
      </div>
      <PermissionTabs />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading ? (
        <LoadingState />
      ) : (
        <>
          <section className="card perm-table-card">
            <ul className="perm-legend" aria-label="Chú thích">
              <li>
                <span className="perm-legend__box" aria-hidden="true" /> Ô tick: Hiệu trưởng chọn được
              </li>
              <li>
                <PermissionFixedCell has /> Luôn có
              </li>
              <li>
                <PermissionFixedCell has={false} /> Không có
              </li>
              <li>
                <span className="perm-table__arrow" aria-hidden="true">
                  ↳
                </span>{' '}
                Cần quyền xem ở dòng đầu nhóm (tự tick kèm)
              </li>
            </ul>
            <p className="perm-notice" role="status" aria-live="polite">
              {notice}
            </p>
            <PermissionTable groups={groups} catalog={catalog} columns={columns} caption="Việc được làm theo vai trò" />
            <p className="perm-scope-note text-sm text-muted">
              Quyền chỉ cho biết được làm việc đó hay không. Phạm vi dữ liệu (điểm trường, lớp) vẫn theo phân công công tác của từng người.
            </p>
          </section>

          {allChanges.length > 0 && (
            <div className="page-actions permission-save-bar" role="region" aria-label="Thao tác lưu thay đổi">
              <div className="permission-save-bar__info">
                <span>
                  Bạn có <strong>{allChanges.length}</strong> thay đổi phân quyền chưa lưu.
                </span>
              </div>
              <div className="row row--wrap permission-save-bar__actions">
                <button
                  className="btn"
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setDrafts({});
                    setNotice('');
                  }}
                >
                  Hủy thay đổi
                </button>
                <button className="btn btn--primary" type="button" disabled={saving} onClick={() => setAsking(true)}>
                  Lưu phân quyền
                </button>
              </div>
            </div>
          )}

          {asking && <ReasonModal saving={saving} changes={allChanges} onClose={() => setAsking(false)} onSubmit={saveAll} />}
          <LeaveConfirmModal
            {...guard.modal}
            canSave={false}
            message="Bạn còn thay đổi phân quyền chưa lưu. Bấm Hủy để ở lại và Lưu phân quyền (cần nhập lý do); Không lưu thì bỏ các thay đổi."
          />
        </>
      )}
    </div>
  );
}
