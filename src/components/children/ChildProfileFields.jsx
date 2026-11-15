import { IntakeChoiceField, IntakeNumberField, IntakeSheet, IntakeSuggestField, IntakeTextField } from './IntakeSheet';
import { ExamChoiceField, ExamNumberField, ExamTextField } from './exam/ExamFields';
import { filterVnProvinces, districtsOfVnProvince, VN_PROVINCES } from '@/data/vnAdministrative';

const PREMATURE_CHOICES = [
  { value: 'NO', label: 'Không' },
  { value: 'YES', label: 'Có' },
];

/**
 * Thông tin hành chính khi tiếp nhận (tiếp nhận bước 1, sửa hồ sơ). Bắt buộc trừ CCCD trẻ, nhóm máu (user chốt 2026-10-22);
 * tuần thai bắt buộc mọi trẻ, khớp ô Sinh non (2026-11-04). Phiếu khám chỉ đọc từ đây, giáo viên không sửa.
 * value: child.profile; errors theo khóa 'profile.x'.
 */
export function ChildProfileFields({ value, onChange, errors = {}, sheet = false }) {
  const TextField = sheet ? IntakeTextField : ExamTextField;
  const NumberField = sheet ? IntakeNumberField : ExamNumberField;
  const ChoiceField = sheet ? IntakeChoiceField : ExamChoiceField;
  const Fields = sheet ? IntakeSheet : 'div';
  const set = (field, v) => onChange({ ...value, [field]: v });
  const setAddress = (field, v) => onChange({ ...value, address: { ...value.address, [field]: v } });
  // Gợi ý tỉnh/thành + phường/xã (vẫn nhập tự do; danh sách chỉ gợi ý, BE là source of truth).
  const provinceSuggestions = VN_PROVINCES.map((p) => p.name);
  const filterProvinces = (q) => filterVnProvinces(q).map((p) => p.name);
  const districtSuggestions = value.address.province
    ? districtsOfVnProvince(value.address.province)
    : VN_PROVINCES.flatMap((p) => p.districts);
  const text = (field, label, extra = {}) => (
    <TextField label={label} value={value[field]} onChange={(v) => set(field, v)} error={errors[`profile.${field}`]} required {...extra} />
  );

  return (
    <>
      {!sheet && <h2 className="card__title">Thông tin hành chính</h2>}
      <Fields {...(sheet ? { title: 'II. Thông tin hành chính' } : { className: 'grid-3 mt-12' })}>
        {text('idNumber', 'Số CC/CCCD/Hộ chiếu/Mã định danh', { maxLength: 20, required: false })}
        <ChoiceField
          name="profile-premature"
          label="Sinh non"
          options={PREMATURE_CHOICES}
          value={value.premature || ''}
          onChange={(v) => set('premature', v)}
          error={errors['profile.premature']}
        />
        <NumberField
          label="Tuần thai khi sinh (tuần)"
          value={value.gestationWeeks}
          onChange={(v) => set('gestationWeeks', v)}
          error={errors['profile.gestationWeeks']}
          required
          min="20"
          max="42"
          step="1"
        />
        {text('ethnicity', 'Dân tộc')}
        {text('beneficiary', 'Đối tượng')}
        {text('bloodType', 'Nhóm máu (nếu có)', { required: false })}
        {sheet ? (
          <IntakeSuggestField
            label="Nơi ở — Tỉnh/thành"
            required
            value={value.address.province}
            onChange={(v) => setAddress('province', v)}
            error={errors['profile.address.province']}
            suggestions={provinceSuggestions}
            filterSuggestions={filterProvinces}
            placeholder="Nhập hoặc chọn (vd: Hà)"
          />
        ) : (
          <TextField
            label="Nơi ở — Tỉnh/thành"
            required
            value={value.address.province}
            onChange={(v) => setAddress('province', v)}
            error={errors['profile.address.province']}
          />
        )}
        {sheet ? (
          <IntakeSuggestField
            label="Nơi ở — Phường/xã"
            required
            value={value.address.ward}
            onChange={(v) => setAddress('ward', v)}
            error={errors['profile.address.ward']}
            suggestions={districtSuggestions}
            placeholder="Nhập hoặc chọn (vd: Lê Chân)"
          />
        ) : (
          <TextField
            label="Nơi ở — Phường/xã"
            required
            value={value.address.ward}
            onChange={(v) => setAddress('ward', v)}
            error={errors['profile.address.ward']}
          />
        )}
        <TextField
          label="Nơi ở — Số nhà/thôn/xóm"
          required
          value={value.address.street}
          onChange={(v) => setAddress('street', v)}
          error={errors['profile.address.street']}
          maxLength={300}
        />
      </Fields>
    </>
  );
}
