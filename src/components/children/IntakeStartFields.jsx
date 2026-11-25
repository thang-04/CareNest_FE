import { FormField } from '@/components/form/FormField';
import { SelectField } from '@/components/form/Field';
import { DateInput } from '@/components/form/DateInput';
import { sameId } from '@/services/http/idStrings';
import { intakeYearOptions } from '@/utils/schoolYearPrep';
import { todayInput } from '@/utils/format';

/**
 * Năm học tiếp nhận (bắt buộc, không chọn sẵn) và ngày bắt đầu đi học (G94-180/CHD-14) cho tiếp nhận, mở lại hồ sơ, nhập Excel.
 * Năm đang học: từ hôm nay tới cuối năm; năm sau: trong năm. Đổi năm ⇒ người gọi đặt lại ngày mặc định.
 */
export function IntakeStartFields({ schoolYears, yearId, onYearChange, startDate, onStartDateChange, errors = {}, className = '' }) {
  const year = schoolYears.find((y) => sameId(y.id, yearId)) || null;
  const planned = year?.status === 'PLANNED';
  return (
    <div className={className}>
      <SelectField
        label="Năm học tiếp nhận"
        required
        error={errors.schoolYearId}
        value={year?.id || ''}
        options={[
          { value: '', label: 'Chọn năm học' },
          ...intakeYearOptions(schoolYears).map((y) => ({
            value: y.id,
            label: `${y.label} · ${y.status === 'ACTIVE' ? 'Đang hoạt động' : 'Sắp diễn ra'}`,
          })),
        ]}
        onChange={(e) => onYearChange(schoolYears.find((y) => sameId(y.id, e.target.value)) || null)}
      />
      {year && (
        <FormField label="Ngày bắt đầu đi học" required error={errors.startDate}>
          <DateInput value={startDate} min={planned ? year.startDate : todayInput()} max={year.endDate} onChange={onStartDateChange} />
        </FormField>
      )}
    </div>
  );
}
