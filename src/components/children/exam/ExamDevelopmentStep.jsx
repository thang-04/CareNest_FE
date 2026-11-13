import { useId } from 'react';
import { DEVELOPMENT_ITEMS, EXAM_STEPS, IMMUNIZATION_ITEMS } from '@/models/children/healthExamForm';
import { EXAM_SECTIONS, ExamSheetBand, ExamSheetCard, ExamSheetChoiceCell, ExamSheetRows, ExamSheetTable } from './ExamFields';

/** Bước 3 — Phần IV (phát triển tinh thần – vận động) và V (tiêm chủng). Không chọn sẵn: phải hỏi hoặc xem sổ tiêm chủng. */
export function ExamDevelopmentStep({ form, set, errors, reference, disabled }) {
  const uid = useId();
  const rows = (items, prefix, path) =>
    items.map((item) => ({
      key: item.key,
      label: item.label,
      id: `${uid}-${prefix}-${item.key}`,
      required: true,
      cell: (
        <ExamSheetChoiceCell
          name={`${prefix}-${item.key}`}
          labelledBy={`${uid}-${prefix}-${item.key}`}
          options={item.options}
          value={form.exam[path][item.key]}
          onChange={(v) => set(`exam.${path}.${item.key}`, v)}
          error={errors[`exam.${path}.${item.key}`]}
          disabled={disabled}
        />
      ),
    }));
  return (
    <ExamSheetCard title={EXAM_STEPS[2].label}>
      <ExamSheetTable label={`${EXAM_SECTIONS.development}; ${EXAM_SECTIONS.immunization}`}>
        <ExamSheetBand primary>{EXAM_SECTIONS.development}</ExamSheetBand>
        <ExamSheetRows
          rows={rows(
            DEVELOPMENT_ITEMS.filter((i) => !i.ageMonths || reference.autismQuestion),
            'dev',
            'development',
          )}
        />
        <ExamSheetBand primary>{EXAM_SECTIONS.immunization}</ExamSheetBand>
        <ExamSheetRows rows={rows(IMMUNIZATION_ITEMS, 'imm', 'immunization')} />
      </ExamSheetTable>
    </ExamSheetCard>
  );
}
