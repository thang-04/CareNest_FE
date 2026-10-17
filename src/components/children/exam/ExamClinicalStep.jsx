import { BEHAVIOR_NOTE_TRIGGERS, CLINICAL_GROUPS, YES_NO } from '@/models/children/healthExamForm';
import { ExamChoiceField, ExamTextField } from './ExamFields';

/** Bước 4 — Phần VI: khám lâm sàng. Các mục chọn sẵn "Bình thường"/"Không"; chỉ đổi mục bác sĩ nói bất thường. */
export function ExamClinicalStep({ form, set, errors, disabled }) {
  const c = form.exam.clinical;
  const needNote = BEHAVIOR_NOTE_TRIGGERS.some((k) => c[k] === YES_NO.YES);
  return (
    <section className="card wizard-card">
      <h2 className="card__title mb-12">VI. Khám lâm sàng</h2>
      <p className="muted text-sm mb-16">
        Quan sát nét mặt, tư thế, tỷ lệ, sự đối xứng và chuyển động của trẻ. Các mục đã chọn sẵn kết quả bình thường; chỉ đổi mục bác sĩ nói
        bất thường.
      </p>
      {CLINICAL_GROUPS.map((group) => (
        <div key={group.key} className="tr-exam-group">
          <h3 className="subsection-title">{group.title}</h3>
          <div className="grid-2">
            {group.items.map((item) => (
              <ExamChoiceField
                key={item.key}
                name={`clinical-${item.key}`}
                label={item.label}
                options={item.options}
                value={c[item.key]}
                onChange={(v) => set(`exam.clinical.${item.key}`, v)}
                error={errors[`exam.clinical.${item.key}`]}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      ))}
      <ExamTextField
        label="Nếu có, ghi rõ"
        required={needNote}
        multiline
        maxLength={300}
        value={c.behaviorNote}
        onChange={(v) => set('exam.clinical.behaviorNote', v)}
        error={errors['exam.clinical.behaviorNote']}
        hint="Bắt buộc khi trẻ có biểu hiện buồn bã, lo âu, mất ngủ kéo dài hoặc hành vi bất thường. Ghi đúng lời bác sĩ."
        disabled={disabled}
      />
    </section>
  );
}
