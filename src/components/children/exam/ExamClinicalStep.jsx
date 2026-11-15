import { Fragment, useId } from 'react';
import { BEHAVIOR_NOTE_TRIGGERS, CLINICAL_GROUPS, EXAM_STEPS, YES_NO } from '@/models/children/healthExamForm';
import {
  EXAM_SECTIONS,
  ExamSheetBand,
  ExamSheetCard,
  ExamSheetChoiceCell,
  ExamSheetInputCell,
  ExamSheetRows,
  ExamSheetTable,
} from './ExamFields';

/** Bước 4 — Phần VI: khám lâm sàng. Các mục chọn sẵn "Bình thường"/"Không"; chỉ đổi mục bác sĩ nói bất thường. */
export function ExamClinicalStep({ form, set, errors, disabled }) {
  const uid = useId();
  const c = form.exam.clinical;
  const needNote = BEHAVIOR_NOTE_TRIGGERS.some((k) => c[k] === YES_NO.YES);
  const lastGroup = CLINICAL_GROUPS[CLINICAL_GROUPS.length - 1].key;
  const itemRow = (item) => ({
    key: item.key,
    label: item.label,
    id: `${uid}-${item.key}`,
    required: true,
    cell: (
      <ExamSheetChoiceCell
        name={`clinical-${item.key}`}
        labelledBy={`${uid}-${item.key}`}
        options={item.options}
        value={c[item.key]}
        onChange={(v) => set(`exam.clinical.${item.key}`, v)}
        error={errors[`exam.clinical.${item.key}`]}
        disabled={disabled}
      />
    ),
  });
  // "Nếu có, ghi rõ" của mẫu đứng sau 2 câu tâm lý, hành vi ở nhóm cuối.
  const noteRow = {
    key: 'behaviorNote',
    label: 'Nếu có, ghi rõ',
    id: `${uid}-behaviorNote`,
    required: needNote,
    cell: (
      <ExamSheetInputCell
        multiline
        maxLength={300}
        labelledBy={`${uid}-behaviorNote`}
        value={c.behaviorNote}
        onChange={(v) => set('exam.clinical.behaviorNote', v)}
        error={errors['exam.clinical.behaviorNote']}
        disabled={disabled}
      />
    ),
  };
  return (
    <ExamSheetCard title={EXAM_STEPS[3].label}>
      <ExamSheetTable label={EXAM_SECTIONS.clinical}>
        <ExamSheetBand primary>{EXAM_SECTIONS.clinical}</ExamSheetBand>
        {CLINICAL_GROUPS.map((group) => (
          <Fragment key={group.key}>
            <ExamSheetBand>{group.title}</ExamSheetBand>
            <ExamSheetRows rows={[...group.items.map(itemRow), group.key === lastGroup && noteRow]} />
          </Fragment>
        ))}
      </ExamSheetTable>
    </ExamSheetCard>
  );
}
