import { MEASUREMENT_SOURCE, MEASUREMENT_SOURCE_LABELS } from '@/models/children/childrenConstants';
import { formatNumber } from '@/utils/children/childrenHelpers';
import { BmiStatusBadge, ConclusionCategoryBadge } from './ChildBadges';

/** Một dòng tóm tắt kết luận bác sĩ BE trả: chuyên khoa được chuyển, vấn đề, hoặc lời dặn. */
export const conclusionNoteOf = (c) => (c?.specialty ? `Chuyển khám: ${c.specialty}` : c?.issueText || c?.adviceText || '');

/**
 * Cảnh báo của một lần đo (HLT-19): phiếu khám theo kết luận bác sĩ; số đo của kỳ cân đo (và kết quả mẫu cũ) theo mức BMI theo tuổi
 * BE trả (HLT-18). UI không tự xếp mức. variant "warning" (Xu hướng sức khỏe, cạnh cột BMI): ghi nguồn "Bác sĩ:"/"BMI:";
 * "conclusion" (cột "Kết luận sức khỏe" của Sổ sức khỏe, không có cột BMI, nhãn "Mẫu cũ" đã ở cột tên đợt): chỉ nhãn, số đo kèm
 * dòng BMI.
 */
export function HealthWarningCell({ measurement: m, variant = 'warning' }) {
  const prefixed = variant === 'warning';
  if (m.source === MEASUREMENT_SOURCE.EXAM) {
    if (!m.conclusionCategory) return <span className="muted">—</span>;
    const note = conclusionNoteOf(m.conclusion || m.exam?.conclusion);
    return (
      <div className="tr-cell-stack">
        <span className="row row--wrap gap-1-5">
          {prefixed && <span className="muted text-xs">Bác sĩ:</span>}
          <ConclusionCategoryBadge status={m.conclusionCategory} />
        </span>
        {note && <span className="muted text-xs tr-note">{note}</span>}
      </div>
    );
  }
  const legacy = m.source === MEASUREMENT_SOURCE.LEGACY;
  if (!m.bmiStatus && !legacy) return <span className="muted">—</span>;
  return (
    <div className="tr-cell-stack">
      {m.bmiStatus ? (
        <span className="row row--wrap gap-1-5">
          {prefixed && <span className="muted text-xs">BMI:</span>}
          <BmiStatusBadge status={m.bmiStatus} />
        </span>
      ) : (
        <span className="muted">—</span>
      )}
      {!prefixed && m.bmi != null && <span className="muted text-xs">Theo BMI {formatNumber(m.bmi)}</span>}
      {legacy && prefixed && <span className="muted text-xs">{MEASUREMENT_SOURCE_LABELS.LEGACY}</span>}
    </div>
  );
}
