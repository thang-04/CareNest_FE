import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Save, Search } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/form/FormField';
import { Avatar } from '@/components/ui/Avatar';
import { Switch } from '@/components/ui/Switch';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { usePermissionStaff } from '@/hooks/account/usePermissions';
import { usePermissionOverrides, useRolePermissionMatrix } from '@/hooks/account/usePermissions';
import { updatePermissionOverrides } from '@/services/account/permissionService';
import {
  PERMISSION_GROUPS,
  PERMISSION_MODULE_LABELS,
  PERMISSION_ROLE_LABELS,
  PERMISSION_TASKS,
  REASON_MAX_LENGTH,
} from '@/models/account/permissionConstants';
import { overridesFromSwitches, permissionDraftRows } from '@/utils/account/personPermissions';
import { validatePermissionChange } from '@/utils/account/permissionValidation';

const CONFIGURABLE_ROLES = ['VICE_PRINCIPAL', 'TEACHER'];

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
      <div className="perm-wizard-header">
        <div className="perm-wizard-steps" aria-label="Các bước thực hiện">
          <span className={`perm-step-indicator ${step === 1 ? 'is-active' : step > 1 ? 'is-done' : ''}`}>1. Chọn người</span>
          <span className="perm-step-divider">›</span>
          <span className={`perm-step-indicator ${step === 2 ? 'is-active' : step > 2 ? 'is-done' : ''}`}>2. Thiết lập quyền</span>
          <span className="perm-step-divider">›</span>
          <span className={`perm-step-indicator ${step === 3 ? 'is-active' : ''}`}>3. Xác nhận & Lý do</span>
        </div>
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

  // Nhóm theo nhóm chức năng
  const groupedRows = useMemo(() => {
    const groups = {};
    rows.forEach((row) => {
      const task = PERMISSION_TASKS[row.code];
      const groupKey = task?.group || 'other';
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

  const handleContinue = () => {
    const payload = overridesFromSwitches(rows, currentValues);
    const changesFormatted = rows
      .filter((r) => currentValues[r.code] !== r.roleOn)
      .map((r) => {
        const task = PERMISSION_TASKS[r.code];
        const isGrant = currentValues[r.code];
        return {
          code: r.code,
          label: task?.label || r.code,
          effect: isGrant ? 'GRANT' : 'REVOKE',
          typeText: isGrant ? 'Cấp thêm (+)' : 'Thu hồi (-)',
        };
      });
    onNext(payload, changesFormatted);
  };

  if (matrix.loading || overridesQuery.loading) return <LoadingState />;
  if (matrix.error || overridesQuery.error) return <ErrorState error={matrix.error || overridesQuery.error} />;

  const grantCount = rows.filter((r) => currentValues[r.code] && !r.roleOn).length;
  const revokeCount = rows.filter((r) => !currentValues[r.code] && r.roleOn).length;

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
          {grantCount > 0 && <StatusBadge tone="green" label={`+${grantCount} Cấp thêm`} />}
          {revokeCount > 0 && <StatusBadge tone="orange" label={`−${revokeCount} Thu hồi`} />}
          {grantCount === 0 && revokeCount === 0 && <StatusBadge tone="gray" label="Hiện đang hoàn toàn theo vai trò" />}
        </div>
      </div>

      <div className="perm-override-list">
        {groupedRows.map((group) => (
          <div key={group.key} className="perm-override-group">
            <h4 className="perm-override-group__title">{group.label}</h4>
            <div className="perm-override-items">
              {group.items.map((row) => {
                const task = PERMISSION_TASKS[row.code];
                const active = currentValues[row.code];
                const roleDefaultOn = row.roleOn;
                const isOverridden = active !== roleDefaultOn;

                return (
                  <div key={row.code} className={`perm-override-item ${isOverridden ? 'is-overridden' : ''}`}>
                    <div className="perm-override-item__info">
                      <strong>{task?.label || row.code}</strong>
                      {task?.hint && <small className="text-muted d-block">{task.hint}</small>}
                      <div className="perm-override-item__role-default">
                        Mặc định vai trò:{' '}
                        {roleDefaultOn ? <span className="text-success">Bật</span> : <span className="text-muted">Tắt</span>}
                      </div>
                    </div>

                    <div className="perm-override-item__control">
                      <span className="perm-override-item__badge">
                        {isOverridden ? (
                          active ? (
                            <StatusBadge tone="green" label="+ Cấp thêm" />
                          ) : (
                            <StatusBadge tone="orange" label="− Thu hồi" />
                          )
                        ) : (
                          <StatusBadge tone="gray" label="Theo vai trò" />
                        )}
                      </span>
                      <Switch
                        checked={active}
                        label={task?.label || row.code}
                        onChange={(next) => setValues((curr) => ({ ...curr, [row.code]: next }))}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
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
                <span className={`permission-change permission-change--${c.effect === 'GRANT' ? 'grant' : 'revoke'}`}>{c.typeText}:</span>{' '}
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
