import { Info } from '@/components/ui/icons';
import { HEAD_STATUS_OPTIONS, NUTRITION_STATUS, NUTRITION_STATUS_OPTIONS, VITAL_ITEMS, labelOf } from '@/models/children/healthExamForm';
import { formatDecimal, headStatusFor, vitalStatusFor } from '@/utils/children/healthExamHints';
import { ExamCheckGroup, ExamChoiceField, ExamNumberField } from './ExamFields';

/** Khoảng tham khảo BE trả cho nhóm tuổi của trẻ, hiện dưới ô số. */
const vitalHint = (item, vitals) => {
  if (item.key === 'temperatureC')
    return `Đo ở nách. Sốt từ ${formatDecimal(vitals.temperature.feverFrom)} °C, hạ thân nhiệt dưới ${formatDecimal(vitals.temperature.hypothermiaBelow)} °C.`;
  const range = item.key === 'pulse' ? vitals.pulse : vitals.respiratoryRate;
  return `Khoảng tham khảo của ${vitals.label}: ${range.min}–${range.max} ${item.unit}.`;
};

/** Bước 2 — Phần II (dấu hiệu sinh tồn) và III (dinh dưỡng). Nhập số thì trạng thái tự chọn theo khoảng tham khảo; bác sĩ đổi được. */
export function ExamMeasureStep({ form, set, setMany, errors, reference, disabled }) {
  const v = form.exam.vitals;
  const n = form.exam.nutrition;
  const setVital = (item, value) => {
    const hint = vitalStatusFor(item.key, value, reference.vitals);
    setMany({ [`exam.vitals.${item.key}`]: value, ...(hint ? { [`exam.vitals.${item.statusKey}`]: hint.status } : {}) });
  };
  const setHead = (value) => {
    const s = headStatusFor(value, reference.head);
    setMany({ headCircumferenceCm: value, ...(s ? { 'exam.nutrition.headStatus': s } : {}) });
  };
  // "Bình thường" không chọn cùng các mục khác.
  const toggleStatus = (value) => {
    const has = n.statuses.includes(value);
    const next =
      value === NUTRITION_STATUS.NORMAL
        ? has
          ? []
          : [NUTRITION_STATUS.NORMAL]
        : has
          ? n.statuses.filter((s) => s !== value)
          : [...n.statuses.filter((s) => s !== NUTRITION_STATUS.NORMAL), value];
    set('exam.nutrition.statuses', next);
  };

  return (
    <>
      <section className="card wizard-card">
        <h2 className="card__title mb-12">II. Đánh giá dấu hiệu sinh tồn</h2>
        <div className="alert alert--info mb-16">
          <Info size={18} />
          <div>
            Trẻ {reference.ageMonths} tháng tuổi tại ngày khám. Trạng thái được chọn sẵn theo {reference.label}. Bác sĩ nói khác thì chọn
            lại theo bác sĩ.
          </div>
        </div>
        <div className="tr-exam-grid">
          {VITAL_ITEMS.map((item) => {
            const hint = vitalStatusFor(item.key, v[item.key], reference.vitals);
            return (
              <div key={item.key} className="tr-exam-pair">
                <ExamNumberField
                  label={item.label}
                  required
                  value={v[item.key]}
                  onChange={(value) => setVital(item, value)}
                  error={errors[`exam.vitals.${item.key}`]}
                  hint={vitalHint(item, reference.vitals)}
                  min={String(item.min)}
                  max={String(item.max)}
                  step={item.step}
                  disabled={disabled}
                />
                <ExamChoiceField
                  name={item.statusKey}
                  label="Trạng thái"
                  options={item.options}
                  value={v[item.statusKey]}
                  onChange={(value) => set(`exam.vitals.${item.statusKey}`, value)}
                  error={errors[`exam.vitals.${item.statusKey}`]}
                  hint={
                    hint?.below
                      ? 'Thấp hơn khoảng tham khảo; mẫu không có ô "chậm", hệ thống ghi vào điểm cần bác sĩ xem lại.'
                      : hint && hint.status !== v[item.statusKey]
                        ? `Hệ thống gợi ý: ${labelOf(item.options, hint.status)}`
                        : undefined
                  }
                  disabled={disabled}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="card wizard-card mt-16">
        <h2 className="card__title mb-12">III. Đánh giá dinh dưỡng</h2>
        <div className="grid-2">
          <ExamNumberField
            label="Chiều cao/chiều dài (cm)"
            required
            value={form.heightCm}
            onChange={(value) => set('heightCm', value)}
            error={errors.heightCm}
            hint="Từ 40 đến 150 cm"
            min="40"
            max="150"
            disabled={disabled}
          />
          <ExamNumberField
            label="Chiều dài/Tuổi (SD)"
            value={n.lengthForAgeSd}
            onChange={(value) => set('exam.nutrition.lengthForAgeSd', value)}
            error={errors['exam.nutrition.lengthForAgeSd']}
            hint="Không bắt buộc. Nhập số bác sĩ đọc từ bảng; hệ thống chưa tự tính."
            min="-6"
            max="6"
            disabled={disabled}
          />
          <ExamNumberField
            label="Cân nặng (kg)"
            required
            value={form.weightKg}
            onChange={(value) => set('weightKg', value)}
            error={errors.weightKg}
            hint="Từ 3 đến 60 kg"
            min="3"
            max="60"
            disabled={disabled}
          />
          <ExamNumberField
            label="Cân nặng/Tuổi (SD)"
            value={n.weightForAgeSd}
            onChange={(value) => set('exam.nutrition.weightForAgeSd', value)}
            error={errors['exam.nutrition.weightForAgeSd']}
            hint="Không bắt buộc. Nhập số bác sĩ đọc từ bảng; hệ thống chưa tự tính."
            min="-6"
            max="6"
            disabled={disabled}
          />
          {reference.headApplies ? (
            <>
              <ExamNumberField
                label="Vòng đầu (cm)"
                required
                value={form.headCircumferenceCm}
                onChange={setHead}
                error={errors.headCircumferenceCm}
                hint={`Từ 30 đến 60 cm. Khoảng tham khảo tạm của tuổi này: ${formatDecimal(reference.head.low)}–${formatDecimal(reference.head.high)} cm.`}
                min="30"
                max="60"
                disabled={disabled}
              />
              <ExamChoiceField
                name="headStatus"
                label="Vòng đầu"
                options={HEAD_STATUS_OPTIONS}
                value={n.headStatus}
                onChange={(value) => set('exam.nutrition.headStatus', value)}
                error={errors['exam.nutrition.headStatus']}
                hint="Chọn sẵn theo khoảng tham khảo tạm; bác sĩ nói khác thì chọn lại."
                disabled={disabled}
              />
            </>
          ) : (
            <div className="field tr-span-2">
              <span className="field__label">Vòng đầu</span>
              <p className="muted text-sm m-0">Trẻ trên 60 tháng tuổi tại ngày khám: không đo vòng đầu.</p>
            </div>
          )}
          <ExamNumberField
            label="Chu vi vòng cánh tay (mm)"
            value={n.armCircumferenceMm}
            onChange={(value) => set('exam.nutrition.armCircumferenceMm', value)}
            error={errors['exam.nutrition.armCircumferenceMm']}
            hint="Không bắt buộc. Từ 50 đến 300 mm."
            min="50"
            max="300"
            step="1"
            disabled={disabled}
          />
        </div>
        <div className="mt-12">
          <ExamCheckGroup
            label="Tình trạng dinh dưỡng (theo bác sĩ)"
            options={NUTRITION_STATUS_OPTIONS}
            values={n.statuses}
            onToggle={toggleStatus}
            error={errors['exam.nutrition.statuses']}
            hint="Chọn theo lời bác sĩ. Hệ thống không tự gắn các nhãn này."
            disabled={disabled}
          />
        </div>
      </section>
    </>
  );
}
