import { DEVELOPMENT_ITEMS, IMMUNIZATION_ITEMS } from '@/models/children/healthExamForm';
import { ExamChoiceField } from './ExamFields';

/** Bước 3 — Phần IV (phát triển tinh thần – vận động) và V (tiêm chủng). Không chọn sẵn: phải hỏi hoặc xem sổ tiêm chủng. */
export function ExamDevelopmentStep({ form, set, errors, reference, disabled }) {
  const dev = form.exam.development;
  const imm = form.exam.immunization;
  return (
    <>
      <section className="card wizard-card">
        <h2 className="card__title mb-12">IV. Đánh giá phát triển tinh thần – vận động</h2>
        <p className="muted text-sm mb-12">Hành vi và năng lực của trẻ theo độ tuổi, theo đánh giá của bác sĩ.</p>
        <div className="grid-2">
          {DEVELOPMENT_ITEMS.filter((i) => !i.ageMonths || reference.autismQuestion).map((item) => (
            <ExamChoiceField
              key={item.key}
              name={`dev-${item.key}`}
              label={item.label}
              options={item.options}
              value={dev[item.key]}
              onChange={(v) => set(`exam.development.${item.key}`, v)}
              error={errors[`exam.development.${item.key}`]}
              disabled={disabled}
            />
          ))}
        </div>
        {!reference.autismQuestion && <p className="muted text-sm mt-12">Câu nguy cơ tự kỷ chỉ hỏi với trẻ từ 16 đến 30 tháng tuổi.</p>}
      </section>
      <section className="card wizard-card mt-16">
        <h2 className="card__title mb-12">V. Đánh giá tiêm chủng</h2>
        <p className="muted text-sm mb-12">Kiểm tra sổ tiêm chủng người đi cùng mang theo.</p>
        <div className="grid-2">
          {IMMUNIZATION_ITEMS.map((item) => (
            <ExamChoiceField
              key={item.key}
              name={`imm-${item.key}`}
              label={item.label}
              options={item.options}
              value={imm[item.key]}
              onChange={(v) => set(`exam.immunization.${item.key}`, v)}
              error={errors[`exam.immunization.${item.key}`]}
              disabled={disabled}
            />
          ))}
        </div>
      </section>
    </>
  );
}
