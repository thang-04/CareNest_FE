import { useId } from 'react';
import {
  EXAM_STEPS,
  HEAD_STATUS_OPTIONS,
  NUTRITION_STATUS,
  NUTRITION_STATUS_OPTIONS,
  VITAL_ITEMS,
  labelOf,
} from '@/models/children/healthExamForm';
import { formatDecimal, headStatusFor, vitalStatusFor } from '@/utils/children/healthExamHints';
import {
  EXAM_SECTIONS,
  ExamSheetBand,
  ExamSheetCard,
  ExamSheetChecksCell,
  ExamSheetInputCell,
  ExamSheetMeasureCell,
  ExamSheetRows,
  ExamSheetTable,
} from './ExamFields';

/** Dòng "Tham khảo: …" dưới ô số sinh tồn, theo khoảng BE trả cho nhóm tuổi của trẻ. */
export const vitalReferenceText = (item, vitals) => {
  if (item.key === 'temperatureC')
    return `Tham khảo: sốt từ ${formatDecimal(vitals.temperature.feverFrom)} °C, hạ thân nhiệt dưới ${formatDecimal(vitals.temperature.hypothermiaBelow)} °C (đo ở nách)`;
  const range = item.key === 'pulse' ? vitals.pulse : vitals.respiratoryRate;
  return `Tham khảo: ${range.min}–${range.max} ${item.unit} (${vitals.label})`;
};

const SD_NOTE = 'Không bắt buộc. Nhập số bác sĩ đọc từ bảng; hệ thống chưa tự tính.';

/** Bước 2 — Phần II (dấu hiệu sinh tồn) và III (dinh dưỡng). Nhập số thì trạng thái tự chọn theo khoảng tham khảo; bác sĩ đổi được. */
export function ExamMeasureStep({ form, set, setMany, errors, reference, disabled }) {
  const uid = useId();
  const id = (key) => `${uid}-${key}`;
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
  // Một dòng số đo của phần III: ô số, dưới là khoảng nhập / ghi chú.
  const numberRow = ({ key, label, required, value, onChange, error, min, max, step = '0.1', hint }) => ({
    key,
    label,
    id: id(key),
    required,
    cell: (
      <ExamSheetInputCell
        type="number"
        inputMode="decimal"
        size="num"
        labelledBy={id(key)}
        value={value}
        onChange={onChange}
        error={error}
        hint={hint}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      />
    ),
  });

  const vitalRows = VITAL_ITEMS.map((item) => {
    const hint = vitalStatusFor(item.key, v[item.key], reference.vitals);
    return {
      key: item.key,
      label: item.label,
      id: id(item.key),
      required: true,
      cell: (
        <ExamSheetMeasureCell
          labelledBy={id(item.key)}
          value={v[item.key]}
          onChange={(value) => setVital(item, value)}
          error={errors[`exam.vitals.${item.key}`]}
          min={String(item.min)}
          max={String(item.max)}
          step={item.step}
          disabled={disabled}
          reference={vitalReferenceText(item, reference.vitals)}
          status={{
            name: item.statusKey,
            labelledBy: `${id('status')} ${id(item.key)}`,
            options: item.options,
            value: v[item.statusKey],
            onChange: (value) => set(`exam.vitals.${item.statusKey}`, value),
            error: errors[`exam.vitals.${item.statusKey}`],
            hint: hint?.below
              ? 'Thấp hơn khoảng tham khảo; mẫu không có ô "chậm", hệ thống ghi vào điểm cần bác sĩ xem lại.'
              : hint && hint.status !== v[item.statusKey]
                ? `Hệ thống gợi ý: ${labelOf(item.options, hint.status)}`
                : undefined,
          }}
        />
      ),
    };
  });

  const nutritionRows = [
    numberRow({
      key: 'heightCm',
      label: 'Chiều cao/chiều dài (cm)',
      required: true,
      value: form.heightCm,
      onChange: (value) => set('heightCm', value),
      error: errors.heightCm,
      min: '40',
      max: '150',
      hint: 'Từ 40 đến 150 cm',
    }),
    numberRow({
      key: 'lengthForAgeSd',
      label: 'Chiều dài/Tuổi (SD)',
      value: n.lengthForAgeSd,
      onChange: (value) => set('exam.nutrition.lengthForAgeSd', value),
      error: errors['exam.nutrition.lengthForAgeSd'],
      min: '-6',
      max: '6',
      hint: SD_NOTE,
    }),
    numberRow({
      key: 'weightKg',
      label: 'Cân nặng (kg)',
      required: true,
      value: form.weightKg,
      onChange: (value) => set('weightKg', value),
      error: errors.weightKg,
      min: '3',
      max: '60',
      hint: 'Từ 3 đến 60 kg',
    }),
    numberRow({
      key: 'weightForAgeSd',
      label: 'Cân nặng/Tuổi (SD)',
      value: n.weightForAgeSd,
      onChange: (value) => set('exam.nutrition.weightForAgeSd', value),
      error: errors['exam.nutrition.weightForAgeSd'],
      min: '-6',
      max: '6',
      hint: SD_NOTE,
    }),
    reference.headApplies
      ? {
          key: 'head',
          label: 'Vòng đầu (cm)',
          id: id('head'),
          required: true,
          cell: (
            <ExamSheetMeasureCell
              labelledBy={id('head')}
              value={form.headCircumferenceCm}
              onChange={setHead}
              error={errors.headCircumferenceCm}
              min="30"
              max="60"
              step="0.1"
              disabled={disabled}
              reference={`Từ 30 đến 60 cm. Khoảng tham khảo tạm của tuổi này: ${formatDecimal(reference.head.low)}–${formatDecimal(reference.head.high)} cm.`}
              status={{
                name: 'headStatus',
                ariaLabel: 'Đánh giá vòng đầu',
                options: HEAD_STATUS_OPTIONS,
                value: n.headStatus,
                onChange: (value) => set('exam.nutrition.headStatus', value),
                error: errors['exam.nutrition.headStatus'],
              }}
            />
          ),
        }
      : {
          key: 'head',
          label: 'Vòng đầu',
          cell: <td className="muted">Trẻ trên 60 tháng tuổi tại ngày khám: không đo vòng đầu.</td>,
        },
    numberRow({
      key: 'armCircumferenceMm',
      label: 'Chu vi vòng cánh tay (mm)',
      value: n.armCircumferenceMm,
      onChange: (value) => set('exam.nutrition.armCircumferenceMm', value),
      error: errors['exam.nutrition.armCircumferenceMm'],
      min: '50',
      max: '300',
      step: '1',
      hint: 'Không bắt buộc. Từ 50 đến 300 mm.',
    }),
    {
      key: 'statuses',
      label: 'Tình trạng dinh dưỡng (theo bác sĩ)',
      id: id('statuses'),
      required: true,
      cell: (
        <ExamSheetChecksCell
          labelledBy={id('statuses')}
          options={NUTRITION_STATUS_OPTIONS}
          values={n.statuses}
          onToggle={toggleStatus}
          error={errors['exam.nutrition.statuses']}
          hint="Chọn theo lời bác sĩ. Hệ thống không tự gắn các nhãn này."
          disabled={disabled}
        />
      ),
    },
  ];

  return (
    <ExamSheetCard
      title={EXAM_STEPS[1].label}
      info={`Trẻ ${reference.ageMonths} tháng tuổi tại ngày khám. Trạng thái được chọn sẵn theo ${reference.label}. Bác sĩ nói khác thì chọn lại theo bác sĩ.`}
      note={
        reference.headApplies && 'Trạng thái vòng đầu được chọn sẵn theo khoảng tham khảo tạm; bác sĩ nói khác thì chọn lại theo bác sĩ.'
      }
    >
      {/* Tên nhóm trạng thái sinh tồn đọc là "Trạng thái <chỉ số>" như khi còn cột Trạng thái */}
      <span id={id('status')} hidden>
        Trạng thái
      </span>
      <ExamSheetTable label={`${EXAM_SECTIONS.vitals}; ${EXAM_SECTIONS.nutrition}`}>
        <ExamSheetBand primary>{EXAM_SECTIONS.vitals}</ExamSheetBand>
        <ExamSheetRows rows={vitalRows} />
        <ExamSheetBand primary>{EXAM_SECTIONS.nutrition}</ExamSheetBand>
        <ExamSheetRows rows={nutritionRows} />
      </ExamSheetTable>
    </ExamSheetCard>
  );
}
