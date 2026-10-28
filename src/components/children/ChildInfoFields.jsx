import { Plus, Trash2, UserCheck } from '@/components/ui/icons';
import { FormField } from '@/components/form/FormField';
import { ParentAccountBadge } from './ChildBadges';
import { GENDER_LABELS } from '@/models/School';
import { GUARDIAN_RELATIONS } from '@/models/children/childrenConstants';
import { emptyGuardian, withGuardianAccounts } from '@/utils/children/childrenHelpers';
import { normalizePhone } from '@/utils/children/childrenValidation';
import { normalizeCitizenId } from '@/utils/citizenId';
import { todayInput } from '@/utils/format';

const MAX_GUARDIANS = 3;

/**
 * CCCD trùng tài khoản phụ huynh có sẵn (BE trả): ai, đang là phụ huynh của trẻ nào; lưu thì liên kết trẻ (user chốt 2026-10-23).
 * Sửa thông tin ở form thì tài khoản đổi theo; SĐT khác tài khoản ⇒ báo trước việc đổi tên đăng nhập, gửi mật khẩu mới (2026-10-28).
 */
function AccountNotice({ account, guardian, childId }) {
  const linkedHere = !!childId && account.children.some((c) => c.id === childId);
  const kids = account.children.map((c) => `${c.fullName}${c.className ? ` (${c.className})` : ''}`);
  if (account.otherChildrenCount) kids.push(`${account.otherChildrenCount} trẻ ở điểm trường khác`);
  return (
    <div className="alert alert--info mt-12">
      <UserCheck size={18} />
      <div className="tr-cell-stack">
        <span className="row row--wrap gap-2">
          <b>CCCD này đã có tài khoản phụ huynh</b> <ParentAccountBadge status={account.status} />
        </span>
        {kids.length > 0 && <span className="text-sm">Đang là phụ huynh của: {kids.join(', ')}.</span>}
        <span className="text-sm muted">
          {linkedHere ? '' : 'Khi lưu, trẻ được liên kết vào tài khoản này, không tạo tài khoản mới. '}Ô trống được điền theo tài khoản; sửa
          ở đây thì tài khoản và hồ sơ các trẻ khác của phụ huynh này đổi theo.
        </span>
        {normalizePhone(guardian.phone) !== normalizePhone(account.phone) && (
          <span className="text-sm">
            <b>Số điện thoại khác tài khoản ({account.phone}).</b> Lưu sẽ đổi tên đăng nhập sang số mới và gửi mật khẩu tạm mới qua SMS tới
            số mới.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Child identity + parents / guardians block (enrollment step 1 and profile edit).
 * value: { fullName, dateOfBirth, gender, guardians[] }; errors keyed like 'guardians.0.phone'.
 * accountGuardianPhones / accountGuardianIds: SĐT, CCCD ban đầu của phụ huynh đã có tài khoản (Sửa hồ sơ) — không xóa ở form
 *   (gỡ ở màn Tài khoản phụ huynh); ô vẫn sửa được, tài khoản đổi theo (user chốt 2026-10-28).
 * accountOf(idNumber): tài khoản phụ huynh có CCCD đó (BE trả) hoặc null — có thì điền ô trống theo tài khoản.
 * childId: hồ sơ đang sửa (để biết tài khoản đã liên kết trẻ này chưa). split: trẻ bên trái, phụ huynh bên phải (tiếp nhận).
 */
export function ChildInfoFields({
  value,
  onChange,
  errors = {},
  onBlurField,
  accountGuardianPhones = [],
  accountGuardianIds = [],
  accountOf = () => null,
  childId = null,
  split = false,
}) {
  const set = (field, v) => onChange({ ...value, [field]: v });
  const setGuardian = (i, field, v) =>
    set(
      'guardians',
      value.guardians.map((g, idx) => (idx === i ? { ...g, [field]: v } : g)),
    );

  const childBlock = (
    <>
      <h2 className="card__title mb-12">Thông tin của trẻ</h2>
      <div className={split ? 'stack gap-4' : 'grid-3'}>
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
          <div className="row gap-5 tr-field-row">
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
    </>
  );

  const guardianBlock = (
    <>
      <div className={`row row--between mb-12 ${split ? '' : 'mt-16'}`}>
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
      <div className="stack gap-3">
        {value.guardians.map((g, i) => {
          const holder =
            accountGuardianPhones.includes(g.phone) || (!!g.idNumber && accountGuardianIds.includes(normalizeCitizenId(g.idNumber)));
          const acc = accountOf(g.idNumber);
          const [shown] = withGuardianAccounts([g], accountOf);
          return (
            <div key={i} className="tr-guardian">
              <div className="tr-guardian__head">
                <span className="fw-600">Phụ huynh {i + 1}</span>
                {value.guardians.length > 1 && !holder && (
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
                <FormField
                  label="Số CCCD"
                  required
                  error={errors[`guardians.${i}.idNumber`]}
                  hint={
                    holder
                      ? 'Đổi CCCD thì tài khoản phụ huynh đổi theo'
                      : '12 chữ số trên căn cước; trùng tài khoản có sẵn thì tự điền thông tin tài khoản'
                  }
                >
                  <input
                    className="input"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={15}
                    value={g.idNumber || ''}
                    onChange={(e) => setGuardian(i, 'idNumber', e.target.value)}
                    onBlur={() => onBlurField?.(`guardians.${i}.idNumber`)}
                  />
                </FormField>
                <FormField
                  label="Họ và tên"
                  required
                  error={errors[`guardians.${i}.fullName`]}
                  hint={acc ? 'Điền theo tài khoản; sửa thì tài khoản đổi theo' : undefined}
                >
                  <input
                    className="input"
                    value={shown.fullName}
                    maxLength={100}
                    onChange={(e) => setGuardian(i, 'fullName', e.target.value)}
                  />
                </FormField>
                <FormField
                  label="Số điện thoại"
                  required
                  error={errors[`guardians.${i}.phone`]}
                  hint={
                    holder || acc
                      ? 'Tên đăng nhập; đổi số thì tên đăng nhập đổi theo, mật khẩu tạm mới gửi SMS tới số mới'
                      : 'Dùng làm tên đăng nhập, nhận mật khẩu qua SMS'
                  }
                >
                  <input
                    className="input"
                    inputMode="tel"
                    placeholder="0912 345 678"
                    value={shown.phone}
                    onChange={(e) => setGuardian(i, 'phone', e.target.value)}
                    onBlur={() => onBlurField?.(`guardians.${i}.phone`)}
                  />
                </FormField>
                <FormField
                  label="Quan hệ với trẻ"
                  required
                  error={errors[`guardians.${i}.relation`]}
                  hint={acc?.relation && acc.relation !== g.relation ? `Hồ sơ trẻ khác ghi: ${acc.relation} – kiểm tra lại` : undefined}
                >
                  <select className="select" value={g.relation} onChange={(e) => setGuardian(i, 'relation', e.target.value)}>
                    <option value="">Chọn quan hệ</option>
                    {GUARDIAN_RELATIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Email" error={errors[`guardians.${i}.email`]}>
                  <input
                    className="input"
                    type="email"
                    placeholder={acc ? '' : 'ten@example.com'}
                    value={shown.email}
                    onChange={(e) => setGuardian(i, 'email', e.target.value)}
                    onBlur={() => onBlurField?.(`guardians.${i}.email`)}
                  />
                </FormField>
              </div>
              {acc && <AccountNotice account={acc} guardian={shown} childId={childId} />}
            </div>
          );
        })}
      </div>
    </>
  );

  if (!split)
    return (
      <>
        {childBlock}
        {guardianBlock}
      </>
    );
  return (
    <div className="tr-info-split">
      <section className="tr-info-split__child">{childBlock}</section>
      <section className="tr-info-split__guardians">{guardianBlock}</section>
    </div>
  );
}
