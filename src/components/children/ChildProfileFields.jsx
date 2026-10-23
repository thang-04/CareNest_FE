import { ExamChoiceField, ExamNumberField, ExamTextField } from './exam/ExamFields';

const PREMATURE_CHOICES = [
  { value: 'NO', label: 'Không' },
  { value: 'YES', label: 'Có' },
];

/**
 * Thông tin hành chính khi tiếp nhận (tiếp nhận bước 1, sửa hồ sơ). Bắt buộc trừ CCCD trẻ, nhóm máu (user chốt 2026-10-22);
 * phiếu khám chỉ đọc từ đây, giáo viên không sửa.
 * value: child.profile; errors theo khóa 'profile.x'.
 */
export function ChildProfileFields({ value, onChange, errors = {} }) {
  const set = (field, v) => onChange({ ...value, [field]: v });
  const setAddress = (field, v) => onChange({ ...value, address: { ...value.address, [field]: v } });
  const text = (field, label, extra = {}) => (
    <ExamTextField
      label={label}
      value={value[field]}
      onChange={(v) => set(field, v)}
      error={errors[`profile.${field}`]}
      required
      {...extra}
    />
  );

  return (
    <>
      <h2 className="card__title">Thông tin hành chính</h2>
      <p className="muted text-sm mt-8 mb-12">
        Phiếu khám sức khỏe dùng đúng các thông tin này và giáo viên không sửa được khi khám. Hỏi đủ phụ huynh khi nhập học.
      </p>
      <div className="grid-3">
        {text('idNumber', 'Số CC/CCCD/Hộ chiếu/Mã định danh', {
          maxLength: 20,
          hint: 'Không bắt buộc. 12 chữ số, hoặc số hộ chiếu',
          required: false,
        })}
        <ExamChoiceField
          name="profile-premature"
          label="Sinh non"
          options={PREMATURE_CHOICES}
          value={value.premature || ''}
          onChange={(v) => set('premature', v)}
          error={errors['profile.premature']}
        />
        <ExamNumberField
          label="Tuần thai khi sinh (tuần)"
          value={value.gestationWeeks}
          onChange={(v) => set('gestationWeeks', v)}
          error={errors['profile.gestationWeeks']}
          required={value.premature === 'YES'}
          min="20"
          max="42"
          step="1"
          hint="Từ 20 đến 42 tuần"
        />
        {text('ethnicity', 'Dân tộc')}
        {text('beneficiary', 'Đối tượng')}
        {text('paymentSource', 'Nguồn chi trả')}
        {text('bloodType', 'Nhóm máu (nếu có)', { required: false })}
        <ExamTextField
          label="Nơi ở — Tỉnh/thành"
          required
          value={value.address.province}
          onChange={(v) => setAddress('province', v)}
          error={errors['profile.address.province']}
        />
        <ExamTextField
          label="Nơi ở — Phường/xã"
          required
          value={value.address.ward}
          onChange={(v) => setAddress('ward', v)}
          error={errors['profile.address.ward']}
        />
        <ExamTextField
          label="Nơi ở — Số nhà/thôn/xóm"
          required
          value={value.address.street}
          onChange={(v) => setAddress('street', v)}
          error={errors['profile.address.street']}
          maxLength={300}
        />
      </div>
    </>
  );
}
