import { Check, Circle } from 'lucide-react';
import { FormField, PasswordInput } from '@/components';
import { passwordRules } from '@/utils/account/accountValidation';

/** Live checklist of the password policy (shown under the new-password field). */
export function PasswordRulesHint({ password }) {
  const rules = passwordRules(password);
  return (
    <ul className="ac-rules" aria-label="Yêu cầu mật khẩu">
      {rules.map((r) => (
        <li key={r.key} className={r.ok ? 'ac-rules__item ac-rules__item--ok' : 'ac-rules__item'}>
          {r.ok ? <Check size={14} aria-hidden="true" /> : <Circle size={14} aria-hidden="true" />}
          <span>{r.label}</span>
          <span className="sr-only">{r.ok ? '(đã đạt)' : '(chưa đạt)'}</span>
        </li>
      ))}
    </ul>
  );
}

/** New password + confirmation, used by Password Reset and Password Change. */
export function NewPasswordFields({ values, errors, onChange, onBlur }) {
  const field = (name) => (e) => onChange({ [name]: e.target.value });
  return (
    <>
      <FormField label="Mật khẩu mới" required error={errors.newPassword}>
        <PasswordInput
          autoComplete="new-password"
          value={values.newPassword}
          onChange={field('newPassword')}
          onBlur={() => onBlur?.('newPassword')}
        />
      </FormField>
      <PasswordRulesHint password={values.newPassword} />
      <FormField label="Nhập lại mật khẩu mới" required error={errors.confirmPassword}>
        <PasswordInput
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={field('confirmPassword')}
          onBlur={() => onBlur?.('confirmPassword')}
        />
      </FormField>
    </>
  );
}
