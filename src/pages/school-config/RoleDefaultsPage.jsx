import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useEduWorkflowIssues, useRolePermissionMatrix } from '@/hooks/account/usePermissions';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { ReasonModal } from '@/components/permissions/ReasonModal';
import { PermissionTabs } from '@/components/permissions/PermissionTabs';
import {
  PermissionCheckCell,
  PermissionFixedCell,
  PermissionFlowCheckCell,
  PermissionLevelBadge,
  PermissionTable,
} from '@/components/permissions/PermissionTable';
import { updateRolePermissionsBulk } from '@/services/account/permissionService';
import {
  eduApproveToClear,
  eduCellLabel,
  eduCellLock,
  eduCodesChanged,
  eduIssueText,
  eduLocalIssues,
  eduSaveErrorMessage,
  isEduWorkflowCode,
} from '@/utils/account/eduRoleMatrix';
import { PERMISSION_LEVELS, PERMISSION_ROLE_LABELS, PERMISSION_TASKS } from '@/models/account/permissionConstants';
import {
  codeDiff,
  configurableCheck,
  flowCheckState,
  flowCount,
  permissionTableRows,
  PERMISSION_MATRIX_ROLES,
  toggleFlow,
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
  // Lỗi theo loại hồ sơ BE trả khi lưu (7202); bỏ khi bản nháp đổi
  const [saveIssues, setSaveIssues] = useState(null);
  const issuesQuery = useEduWorkflowIssues({ live: false });

  // "Phụ trách chuyên môn" chỉ là ngoại lệ theo PHT (màn Phân công PHT), không có ô ở ma trận vai trò
  const groups = useMemo(() => permissionTableRows(catalog.filter((permission) => permission.code !== 'EDU_ACADEMIC_DUTY')), [catalog]);
  const roleEntry = (role) => roles.find((entry) => entry.role === role);
  const originalOf = (role) => roleEntry(role)?.permissions || [];
  const codesOf = (role) => drafts[role] ?? originalOf(role);
  const matrixBy = (pick) => Object.fromEntries(PERMISSION_MATRIX_ROLES.map((role) => [role, pick(role)]));
  const matrix = matrixBy(codesOf);
  // BE chỉ kiểm luật soạn/duyệt khi lần lưu đổi mã EDU (EDU-110 WF1) ⇒ FE chỉ khóa Lưu trong trường hợp đó
  const eduChanged = eduCodesChanged(matrixBy(originalOf), matrix);
  const localIssues = eduChanged ? eduLocalIssues(matrix) : [];
  const shownIssues = saveIssues ?? (eduChanged ? localIssues : issuesQuery.data?.issues || []);
  const saveBlocked = localIssues.length > 0 ? 'Sửa các lỗi soạn/duyệt ở nhóm Kế hoạch giáo dục trước khi lưu.' : '';
  const notEdu = (check) => (code) => check(code) && !isEduWorkflowCode(code);

  const setRoleCodes = (role, codes) => {
    setSaveIssues(null);
    setDrafts((current) => {
      const copy = { ...current };
      if (sameCodes(codes, originalOf(role))) delete copy[role];
      else copy[role] = codes;
      return copy;
    });
  };

  // Tick cả luồng lớn: mọi việc nhỏ chỉnh được của luồng đổi theo; 8 ô soạn/duyệt tick từng ô theo luật
  const toggleWholeFlow = (role, flow, on) => {
    const result = toggleFlow(catalog, codesOf(role), flow.codes, on, notEdu(configurableCheck(roleEntry(role))));
    setRoleCodes(role, result.codes);
    setNotice(
      `Đã ${on ? 'tick' : 'bỏ tick'} cả luồng “${flow.label}” cho ${PERMISSION_ROLE_LABELS[role]} (${on ? result.added.length : result.removed.length} việc đổi).`,
    );
  };

  const toggle = (role, code, on) => {
    const result = toggleWithRequires(catalog, codesOf(role), code, on, configurableCheck(roleEntry(role)));
    // EDU-110 (8): HT tick Soạn ⇒ bỏ tick mọi ô Duyệt cùng loại
    const cleared = eduApproveToClear(matrix, role, code, on);
    const without = (codes) => codes.filter((c) => c !== cleared.code);
    cleared?.roles.forEach((other) => other !== role && setRoleCodes(other, without(codesOf(other))));
    setRoleCodes(role, cleared ? without(result.codes) : result.codes);
    // Báo việc tự tick/bỏ tick kèm theo để người dùng không bất ngờ
    const roleName = PERMISSION_ROLE_LABELS[role];
    if (cleared)
      setNotice(
        `Hiệu trưởng soạn và ban hành, không cần duyệt: đã tự bỏ tick “${taskLabel(cleared.code)}” của ${cleared.roles
          .map((r) => PERMISSION_ROLE_LABELS[r])
          .join(', ')}.`,
      );
    else if (result.added.length)
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

  // Một lần PUT cho mọi vai trò đổi (BE lưu trong một giao dịch); lỗi ⇒ giữ hộp lý do và bản nháp
  const saveAll = async (reason) => {
    if (saving) return;
    setSaving(true);
    try {
      await updateRolePermissionsBulk(
        {
          reason,
          roles: changedRoles.map((role) => ({
            role,
            permissions: roleEntry(role).configurablePermissions.filter((code) => codesOf(role).includes(code)),
          })),
        },
        user,
      );
      setDrafts({});
      setNotice('');
      setSaveIssues(null);
      setAsking(false);
      reload({ silent: true });
      issuesQuery.reload({ silent: true });
      toast.success('Đã lưu toàn bộ thay đổi phân quyền theo vai trò.');
    } catch (error) {
      if (error?.errorCode === 7202 && Array.isArray(error.details?.issues)) setSaveIssues(error.details.issues);
      toast.error(eduSaveErrorMessage(error), 'Chưa lưu được phân quyền');
    } finally {
      setSaving(false);
    }
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
      renderFlow: (flow) => {
        const state = flowCheckState(flow.codes, codesOf(role), notEdu(isConfigurable));
        const { on, total } = flowCount(flow.codes, codesOf(role));
        const summary = `${on}/${total} việc`;
        if (!state) return <small className="perm-flow-summary">{summary}</small>;
        return (
          <PermissionFlowCheckCell
            state={state}
            disabled={saving}
            summary={summary}
            changed={flow.codes.some((code) => codesOf(role).includes(code) !== originalOf(role).includes(code))}
            label={`Cả luồng ${flow.label} — ${PERMISSION_ROLE_LABELS[role]}`}
            onChange={(checked) => toggleWholeFlow(role, flow, checked)}
          />
        );
      },
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
            label={isEduWorkflowCode(code) ? eduCellLabel(code, role) : `${taskLabel(code)} — ${PERMISSION_ROLE_LABELS[role]}`}
            lockedReason={eduCellLock(matrix, role, code) || undefined}
            onLocked={setNotice}
            onChange={(on) => toggle(role, code, on)}
          />
        );
      },
    };
  });

  return (
    <div className="page permission-center">
      <Breadcrumb items={permissionCrumbs('Mặc định theo vai trò')} />
      <div className="page__head permission-page-head">
        <div>
          <h1 className="page__title">Mặc định theo vai trò</h1>
          <p className="text-sm text-2">
            Tick việc mà từng vai trò được làm. Áp dụng chung cho Phó hiệu trưởng, Tổ trưởng, Giáo viên và Nhân viên bếp toàn trường; ngoại
            lệ cho từng người ở màn Phân công Phó hiệu trưởng hoặc tab “Ngoại lệ giáo viên”. Soạn/duyệt hồ sơ kế hoạch giáo dục đặt ở nhóm
            “Kế hoạch giáo dục – soạn/duyệt”.
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
            <details className="perm-legend-toggle">
              <summary>Chú thích ký hiệu và cấp quyền</summary>
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
              <ul className="perm-legend perm-legend--levels" aria-label="Cấp quyền">
                <li className="perm-legend__title">Cấp quyền:</li>
                {Object.entries(PERMISSION_LEVELS).map(([level, info]) => (
                  <li key={level}>
                    <PermissionLevelBadge level={level} /> {info.hint}
                  </li>
                ))}
              </ul>
            </details>
            <p className="perm-notice" role="status" aria-live="polite">
              {notice}
            </p>
            <PermissionTable groups={groups} catalog={catalog} columns={columns} caption="Việc được làm theo vai trò" collapsible />
            {shownIssues.length > 0 && (
              <div className="alert alert--danger" role="alert">
                <ul>
                  {shownIssues.map((issue) => (
                    <li key={`${issue.docType}-${issue.rule}`}>{eduIssueText(issue)}</li>
                  ))}
                </ul>
              </div>
            )}
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
                <button
                  className="btn btn--primary"
                  type="button"
                  disabled={saving || !!saveBlocked}
                  title={saveBlocked || undefined}
                  onClick={() => setAsking(true)}
                >
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
