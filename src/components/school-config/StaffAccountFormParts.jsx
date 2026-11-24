import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { ChalkboardTeacher, ChefHat, ShieldCheck } from '@/components/ui/icons';
import { ROLES, ROLE_LABELS } from '@/models/User';
import { SelectField } from '@/components/form/Field';
import { STAFF_ROLES } from '@/utils/school-config/staffImport';

const ROLE_INFO = {
  [ROLES.VICE_PRINCIPAL]: { icon: ShieldCheck, hint: 'Phụ trách một điểm trường' },
  [ROLES.TEACHER]: { icon: ChalkboardTeacher, hint: 'Xếp lớp sau ở Phân công giáo viên' },
  [ROLES.KITCHEN_STAFF]: { icon: ChefHat, hint: 'Tài khoản bếp của điểm trường' },
};

/** Ô "Cơ sở công tác" (BE AUTH-15): mọi vai trò; GV chưa cần lớp, PHT / bếp là điểm trường được phân công. */
export function WorkCampusField({ campuses, role, value, error, onChange, onBlur }) {
  return (
    <SelectField
      label="Cơ sở công tác"
      required
      error={error}
      value={value || ''}
      placeholder="Chọn cơ sở công tác"
      hint={role === ROLES.TEACHER ? 'Giáo viên thuộc cơ sở này kể cả khi chưa xếp lớp.' : undefined}
      options={campuses.map((c) => ({ value: c.id, label: c.shortName || c.name }))}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
    />
  );
}

/** Khối nội dung trong modal tài khoản: tiêu đề có icon, mô tả ngắn, rồi các ô nhập. */
export function StaffFormSection({ icon: Icon, title, description, children }) {
  return (
    <section className="sc-form-section">
      <header className="sc-form-section__head">
        {Icon && (
          <span className="sc-form-section__icon" aria-hidden="true">
            <Icon size={18} />
          </span>
        )}
        <div>
          <h3 className="sc-form-section__title">{title}</h3>
          {description && <p className="sc-form-section__desc">{description}</p>}
        </div>
      </header>
      <div className="sc-form-section__body">{children}</div>
    </section>
  );
}

/** Chọn vai trò bằng thẻ (thay ô select) để thấy luôn khác biệt giữa các vai trò. */
export function StaffRolePicker({ value, onChange, error }) {
  return (
    <div className="field">
      <div className="sc-role-picker" role="radiogroup" aria-label="Vai trò" aria-required="true">
        {STAFF_ROLES.map((role) => {
          const { icon: Icon, hint } = ROLE_INFO[role] || {};
          const selected = value === role;
          return (
            <Button
              key={role}
              variant="link"
              role="radio"
              aria-checked={selected}
              className={`sc-role-option${selected ? ' is-selected' : ''}`}
              onClick={() => onChange(role)}
            >
              {Icon && (
                <span className="sc-role-option__icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
              )}
              <span className="sc-role-option__text">
                <span className="sc-role-option__label">{ROLE_LABELS[role]}</span>
                {hint && <span className="sc-role-option__hint">{hint}</span>}
              </span>
            </Button>
          );
        })}
      </div>
      {error && (
        <div className="field__error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

/** Đầu modal sửa: ảnh đại diện, họ tên, vai trò để biết đang sửa ai. */
export function StaffIdentityCard({ account }) {
  return (
    <div className="sc-identity-card">
      <Avatar user={account} size="md" />
      <div className="sc-identity-card__text">
        <div className="fw-600">{account.fullName}</div>
        <div className="text-sm muted">
          {ROLE_LABELS[account.role] || '—'}
          {account.campusNames?.length ? ` · ${account.campusNames.join(', ')}` : ''}
        </div>
      </div>
    </div>
  );
}
