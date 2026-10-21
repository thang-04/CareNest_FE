import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Save, Search } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/form/FormField';
import { Avatar } from '@/components/ui/Avatar';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Stepper } from '@/components/ui/Stepper';
import { PermissionStateBadge } from '@/components/permissions/PermissionBadges';
import { PermissionCheckCell, PermissionFixedCell, PermissionTable } from '@/components/permissions/PermissionTable';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { usePermissionStaff } from '@/hooks/account/usePermissions';
import { usePermissionOverrides, useRolePermissionMatrix } from '@/hooks/account/usePermissions';
import { updatePermissionOverrides } from '@/services/account/permissionService';
import { PERMISSION_ROLE_LABELS, PERMISSION_TASKS, REASON_MAX_LENGTH } from '@/models/account/permissionConstants';
import { overridesFromSwitches, permissionDraftRows } from '@/utils/account/personPermissions';
import { permissionTableRows, toggleWithRequires } from '@/utils/account/permissionMatrix';
import { validatePermissionChange } from '@/utils/account/permissionValidation';

const CONFIGURABLE_ROLES = ['VICE_PRINCIPAL', 'TEACHER'];
const taskLabel = (code) => PERMISSION_TASKS[code]?.label || code;
const WIZARD_STEPS = ['Chọn người', 'Thiết lập quyền', 'Xác nhận & Lý do'];

export function OverrideWizardModal({ open, initialStaff = null, onClose, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState(initialStaff ? 2 : 1);
  const [selectedStaff, setSelectedStaff] = useState(initialStaff);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [saving, setSaving] = useState(false);

  // Load danh sách nhân sự cho Bước 1
  const { data: staffData, loading: loadingStaff, error: staffError } = usePermissionStaff({ enabled: open && step === 1 });

  // Lọc nhân sự hợp lệ (chỉ PHT và GV, không bao gồm bản thân user hiện tại)
  const eligibleStaffList = useMemo(() => {
    const list = staffData?.items || [];
    return list.filter((s) => {
      const isSelf = String(s.userId || s.id) === String(user?.id) || String(s.userId || s.id) === String(user?.userId);
      const isConfigurable = CONFIGURABLE_ROLES.includes(s.role);
      const matchesRole = !filterRole || s.role === filterRole;
      const matchesSearch = !searchQuery || s.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) || s.phone?.includes(searchQuery);
      return !isSelf && isConfigurable && matchesRole && matchesSearch;
    });
  }, [staffData?.items, filterRole, searchQuery, user]);

  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setStep(2);
  };

  if (!open) return null;

  return (
    <Modal
      open
      size="lg"
      className="permission-center-modal"
      label="Gán quyền ngoại lệ cho nhân sự"
      title="Gán quyền ngoại lệ cho nhân sự"
      onClose={saving ? undefined : onClose}
    >
      <div className="perm-wizard-header" aria-label="Các bước thực hiện">
        {/* step đếm từ 1; Stepper đếm từ 0. Chuyển bước bằng nút Tiếp/Quay lại nên không cho bấm chấm */}
        <Stepper steps={WIZARD_STEPS} current={step - 1} />
      </div>
      {step === 1 && (
        <StepSelectStaff
          loading={loadingStaff}
          error={staffError}
          staffList={eligibleStaffList}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterRole={filterRole}
          onFilterRoleChange={setFilterRole}
          onSelect={handleSelectStaff}
        />
      )}

      {step === 2 && selectedStaff && (
        <StepConfigurePermissions
          staff={selectedStaff}
          onBack={initialStaff ? null : () => setStep(1)}
          onNext={(overridesPayload, formattedChanges) => {
            setSelectedStaff((curr) => ({
              ...curr,
              overridesPayload,
              formattedChanges,
            }));
            setStep(3);
          }}
        />
      )}

      {step === 3 && selectedStaff && (
        <StepConfirmAndReason
          staff={selectedStaff}
          reason={reason}
          reasonError={reasonError}
          saving={saving}
          onReasonChange={(val) => {
            setReason(val);
            if (reasonError) setReasonError('');
          }}
          onBack={() => setStep(2)}
          onConfirm={async () => {
            if (saving) return;
            const validation = validatePermissionChange({ reason });
            if (validation.reason) {
              setReasonError(validation.reason);
              return;
            }
            setSaving(true);
            try {
              await updatePermissionOverrides(
                selectedStaff.userId || selectedStaff.id,
                {
                  overrides: selectedStaff.overridesPayload,
                  reason: reason.trim(),
                },
                user,
              );
              toast.success(`Đã cập nhật quyền ngoại lệ cho ${selectedStaff.fullName}`);
              onSaved?.();
              onClose();
            } catch (err) {
              toast.error(err.message || 'Không thể lưu quyền ngoại lệ', 'Lỗi lưu phân quyền');
            } finally {
              setSaving(false);
            }
          }}
        />
      )}
    </Modal>
  );
}

/** Bước 1: Chọn nhân sự cần gán quyền */
function StepSelectStaff({ loading, error, staffList, searchQuery, onSearchChange, filterRole, onFilterRoleChange, onSelect }) {
  return (
    <div className="perm-wizard-step">
      <div className="filter-bar mb-12">
        <label className="search-box permission-search">
          <Search size={16} className="muted" aria-hidden="true" />
          <span className="sr-only">Tìm nhân sự để tạo ngoại lệ</span>
          <input
            type="search"
            placeholder="Tìm theo họ tên, số điện thoại nhân sự..."
            aria-label="Tìm nhân sự để tạo ngoại lệ"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </label>
        <select className="select" value={filterRole} onChange={(e) => onFilterRoleChange(e.target.value)} aria-label="Lọc vai trò">
          <option value="">Tất cả chức danh</option>
          {CONFIGURABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {PERMISSION_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} />
      ) : staffList.length === 0 ? (
        <div className="empty-state permission-empty">
          <p className="text-muted">Không tìm thấy nhân sự phù hợp.</p>
        </div>
      ) : (
        <div className="perm-staff-pick-list">
          {staffList.map((staff) => {
            const roleName = PERMISSION_ROLE_LABELS[staff.role] || staff.role;
            const campusText = staff.campusName || staff.assignments?.[0]?.campusName || 'Chưa phân công';
            return (
              <button key={staff.userId || staff.id} type="button" className="perm-staff-pick-card" onClick={() => onSelect(staff)}>
                <Avatar user={staff} size="sm" />
                <div className="perm-staff-pick-info">
                  <strong>{staff.fullName}</strong>
                  <div className="text-sm text-muted">
                    <span>{roleName}</span> · <span>{campusText}</span>
                  </div>
                </div>
                <ArrowRight size={18} className="text-muted" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Bước 2: Thiết lập quyền ngoại lệ */
function StepConfigurePermissions({ staff, onBack, onNext }) {
  const staffId = staff.userId || staff.id;
  const matrix = useRolePermissionMatrix({ live: false });
  const overridesQuery = usePermissionOverrides(staffId, { live: false });

  const roleLabel = PERMISSION_ROLE_LABELS[staff.role] || 'vai trò này';

  const rows = useMemo(() => {
    if (!overridesQuery.data || !matrix.roles.length) return [];
    const roleDefaults = matrix.roles.find((r) => r.role === staff.role)?.permissions || [];
    return permissionDraftRows(overridesQuery.data, roleDefaults, staff.overridesPayload);
  }, [overridesQuery.data, matrix.roles, staff.role, staff.overridesPayload]);

  const [values, setValues] = useState({});

  const currentValues = useMemo(() => {
    return Object.fromEntries(rows.map((r) => [r.code, r.code in values ? values[r.code] : r.on]));
  }, [rows, values]);

  const [notice, setNotice] = useState('');
  const catalog = matrix.catalog;
  const configurableCodes = rows.map((r) => r.code);
  const isConfigurable = (code) => configurableCodes.includes(code);
  const roleCodes = matrix.roles.find((r) => r.role === staff.role)?.permissions || [];
  const personCodes = rows.filter((r) => currentValues[r.code]).map((r) => r.code);

  // Chỉ nhóm có việc cấu hình được cho người này
  const groups = useMemo(
    () =>
      permissionTableRows(catalog)
        .map((group) => ({ ...group, rows: group.rows.filter((row) => rows.some((r) => r.code === row.code)) }))
        .filter((group) => group.rows.length > 0),
    [catalog, rows],
  );

  const toggle = (code, on) => {
    const result = toggleWithRequires(catalog, personCodes, code, on, isConfigurable);
    setValues(Object.fromEntries(configurableCodes.map((c) => [c, result.codes.includes(c)])));
    if (result.added.length) setNotice(`Đã tự tick “${result.added.map(taskLabel).join('”, “')}” vì “${taskLabel(code)}” cần quyền xem.`);
    else if (result.removed.length)
      setNotice(`Đã tự bỏ tick “${result.removed.map(taskLabel).join('”, “')}” vì cần quyền “${taskLabel(code)}”.`);
    else setNotice('');
  };

  const handleContinue = () => {
    const payload = overridesFromSwitches(rows, currentValues);
    const changesFormatted = payload.map((item) => ({
      code: item.permission,
      label: taskLabel(item.permission),
      effect: item.effect,
    }));
    onNext(payload, changesFormatted);
  };

  if (matrix.loading || overridesQuery.loading) return <LoadingState />;
  if (matrix.error || overridesQuery.error) return <ErrorState error={matrix.error || overridesQuery.error} />;

  const grantCount = rows.filter((r) => currentValues[r.code] && !r.roleOn).length;
  const revokeCount = rows.filter((r) => !currentValues[r.code] && r.roleOn).length;
  const columns = [
    {
      key: 'role',
      header: 'Theo vai trò',
      note: roleLabel,
      fixed: true,
      render: (code) => <PermissionFixedCell has={roleCodes.includes(code)} reason={`Mặc định của ${roleLabel}`} />,
    },
    {
      key: 'person',
      header: 'Người này',
      render: (code) => (
        <PermissionCheckCell
          checked={personCodes.includes(code)}
          changed={personCodes.includes(code) !== roleCodes.includes(code)}
          label={`${taskLabel(code)} — ${staff.fullName}`}
          onChange={(on) => toggle(code, on)}
        />
      ),
    },
    {
      key: 'diff',
      header: 'Khác vai trò',
      render: (code) => {
        const on = personCodes.includes(code);
        if (on === roleCodes.includes(code)) return <span className="text-muted text-sm">—</span>;
        return <PermissionStateBadge state={on ? 'GRANT' : 'REVOKE'} signed />;
      },
    },
  ];

  return (
    <div className="perm-wizard-step">
      {/* Banner tóm tắt nhân sự được chọn */}
      <div className="perm-staff-banner">
        <Avatar user={staff} size="sm" />
        <div className="perm-staff-banner__main">
          <h3 className="m-0 text-md">{staff.fullName}</h3>
          <p className="text-sm text-muted m-0">
            {roleLabel} · {staff.campusName || 'Cơ sở trực thuộc'}
          </p>
        </div>
        {onBack && (
          <button className="btn btn--sm" type="button" onClick={onBack}>
            Chọn người khác
          </button>
        )}
      </div>

      <div className="perm-status-summary">
        <span className="text-sm">
          Thiết lập quyền riêng biệt cho cá nhân. Khác với mặc định của <strong>{roleLabel}</strong> sẽ được ghi nhận là ngoại lệ.
        </span>
        <div className="perm-status-summary__badges">
          {grantCount > 0 && <PermissionStateBadge state="GRANT" label={`+${grantCount} Cấp thêm`} />}
          {revokeCount > 0 && <PermissionStateBadge state="REVOKE" label={`−${revokeCount} Thu hồi`} />}
          {grantCount === 0 && revokeCount === 0 && <PermissionStateBadge state="INHERIT" label="Hiện đang hoàn toàn theo vai trò" />}
        </div>
      </div>

      <p className="perm-notice" role="status" aria-live="polite">
        {notice}
      </p>
      <div className="perm-wizard-table">
        <PermissionTable groups={groups} catalog={catalog} columns={columns} caption={`Việc được làm của ${staff.fullName}`} />
      </div>

      <div className="perm-wizard-step__footer">
        {onBack && (
          <button className="btn" type="button" onClick={onBack}>
            <ArrowLeft size={16} /> Quay lại
          </button>
        )}
        <button className="btn btn--primary" type="button" onClick={handleContinue}>
          Tiếp tục <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

/** Bước 3: Xem lại thay đổi và nhập lý do bắt buộc */
function StepConfirmAndReason({ staff, reason, reasonError, saving, onReasonChange, onBack, onConfirm }) {
  const changes = staff.formattedChanges || [];

  return (
    <div className="perm-wizard-step">
      <div className="card permission-confirm-card mb-12">
        <h4 className="m-0 mb-8 text-md">Xác nhận thay đổi cho: {staff.fullName}</h4>
        {changes.length === 0 ? (
          <p className="text-sm text-muted m-0">
            Tất cả các quyền đều khớp với mặc định vai trò. Các ngoại lệ trước đây (nếu có) sẽ được xóa bỏ để người này quay lại tuân thủ
            100% vai trò.
          </p>
        ) : (
          <ul className="permission-change-summary-list m-0">
            {changes.map((c) => (
              <li key={c.code} className="text-sm">
                <span className={`permission-change permission-change--${c.effect === 'GRANT' ? 'grant' : 'revoke'}`}>
                  {c.effect === 'GRANT' ? 'Cấp thêm (+)' : 'Thu hồi (−)'}:
                </span>{' '}
                {c.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <FormField
        label="Lý do thay đổi phân quyền"
        required
        error={reasonError}
        hint={`Lý do được ghi nhận vào lịch sử demo (tối đa ${REASON_MAX_LENGTH} ký tự).`}
      >
        <textarea
          className="textarea"
          rows={4}
          value={reason}
          disabled={saving}
          maxLength={REASON_MAX_LENGTH}
          placeholder="Ví dụ: Giao thêm nhiệm vụ hỗ trợ phụ huynh kích hoạt tài khoản cho khối Mầm non..."
          onChange={(e) => onReasonChange(e.target.value)}
        />
      </FormField>
      <div className="text-right text-xs text-muted mt-1">
        {reason.length}/{REASON_MAX_LENGTH} ký tự
      </div>

      <div className="perm-wizard-step__footer">
        <button className="btn" type="button" disabled={saving} onClick={onBack}>
          <ArrowLeft size={16} /> Quay lại
        </button>
        <button className="btn btn--primary" type="button" disabled={saving || !reason.trim()} onClick={onConfirm}>
          <Save size={16} /> {saving ? 'Đang lưu...' : 'Xác nhận gán quyền'}
        </button>
      </div>
    </div>
  );
}
