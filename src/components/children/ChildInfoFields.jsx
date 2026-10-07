import { Plus, Trash2 } from 'lucide-react';
import { FormField } from '@/components/form/FormField';
import { GENDER_LABELS } from '@/models/School';
import { GUARDIAN_RELATIONS } from '@/models/children/childrenConstants';
import { emptyGuardian } from '@/utils/children/childrenHelpers';
import { todayInput } from '@/utils/format';

const MAX_GUARDIANS = 3;

/**
 * Child identity + parents / guardians block (enrollment step 1 and profile edit).
 * value: { fullName, dateOfBirth, gender, guardians[] }; errors keyed like 'guardians.0.phone'.
 */
export function ChildInfoFields({ value, onChange, errors = {}, onBlurField, lockedGuardianPhones = [] }) {
  const set = (field, v) => onChange({ ...value, [field]: v });
  const setGuardian = (i, field, v) =>
    set(
      'guardians',
      value.guardians.map((g, idx) => (idx === i ? { ...g, [field]: v } : g)),
    );

  return (
    <>
      <h2 className="card__title mb-12">Thông tin của trẻ</h2>
      <div className="grid-3">
        <FormField label="Họ và tên trẻ" required error={errors.fullName}>
          <input
            className="input"
            value={value.fullName}
            maxLength={100}
            autoComplete="off"
            onChange={(e) => set('fullName', e.target.value)}
            onBlur={() => onBlurField?.('fullName')}
          />
        </FormField>
        <FormField label="Ngày sinh" required error={errors.dateOfBirth}>
          <input
            type="date"
            className="input"
            value={value.dateOfBirth}
            max={todayInput()}
            onChange={(e) => set('dateOfBirth', e.target.value)}
            onBlur={() => onBlurField?.('dateOfBirth')}
          />
        </FormField>
        <fieldset className="field tr-fieldset">
          <legend className="field__label">
            Giới tính<span className="req">*</span>
          </legend>
          <div className="row" style={{ gap: 20, minHeight: 40 }}>
            {Object.entries(GENDER_LABELS).map(([k, label]) => (
              <label key={k} className="radio">
                <input type="radio" name="tr-gender" value={k} checked={value.gender === k} onChange={() => set('gender', k)} />
                {label}
              </label>
            ))}
          </div>
          {errors.gender && (
            <span className="field__error" role="alert">
              {errors.gender}
            </span>
          )}
        </fieldset>
      </div>

      <div className="row row--between mt-16 mb-12">
        <h2 className="card__title">Phụ huynh / người giám hộ</h2>
        {value.guardians.length < MAX_GUARDIANS && (
          <button type="button" className="btn btn--sm" onClick={() => set('guardians', [...value.guardians, emptyGuardian()])}>
            <Plus size={15} /> Thêm phụ huynh
          </button>
        )}
      </div>
      {errors.guardians && (
        <div className="alert alert--danger mb-12" role="alert">
          {errors.guardians}
        </div>
      )}
      <div className="stack" style={{ gap: 12 }}>
        {value.guardians.map((g, i) => {
          const locked = lockedGuardianPhones.includes(g.phone);
          return (
            <div key={i} className="tr-guardian">
              <div className="tr-guardian__head">
                <span className="fw-600">Phụ huynh {i + 1}</span>
                {value.guardians.length > 1 && !locked && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Xóa phụ huynh ${i + 1}`}
                    title="Xóa phụ huynh"
                    onClick={() =>
                      set(
                        'guardians',
                        value.guardians.filter((_, idx) => idx !== i),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="tr-guardian__grid">
                <FormField label="Họ và tên" required error={errors[`guardians.${i}.fullName`]}>
                  <input
                    className="input"
                    value={g.fullName}
                    maxLength={100}
                    onChange={(e) => setGuardian(i, 'fullName', e.target.value)}
                  />
                </FormField>
                <FormField label="Quan hệ với trẻ" required error={errors[`guardians.${i}.relation`]}>
                  <select className="select" value={g.relation} onChange={(e) => setGuardian(i, 'relation', e.target.value)}>
                    <option value="">Chọn quan hệ</option>
                    {GUARDIAN_RELATIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField
                  label="Số điện thoại"
                  required
                  error={errors[`guardians.${i}.phone`]}
                  hint={locked ? 'Đã có tài khoản – không đổi được số đăng nhập' : 'Dùng làm tên đăng nhập, nhận mật khẩu qua SMS'}
                >
                  <input
                    className="input"
                    inputMode="tel"
                    placeholder="0912 345 678"
                    value={g.phone}
                    disabled={locked}
                    onChange={(e) => setGuardian(i, 'phone', e.target.value)}
                    onBlur={() => onBlurField?.(`guardians.${i}.phone`)}
                  />
                </FormField>
                <FormField label="Email" error={errors[`guardians.${i}.email`]}>
                  <input
                    className="input"
                    type="email"
                    placeholder="ten@example.com"
                    value={g.email}
                    onChange={(e) => setGuardian(i, 'email', e.target.value)}
                    onBlur={() => onBlurField?.(`guardians.${i}.email`)}
                  />
                </FormField>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
