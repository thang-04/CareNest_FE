import { MEASUREMENT_SOURCE, MEASUREMENT_SOURCE_LABELS } from '@/models/children/childrenConstants';
import { CAMPAIGN_KIND } from '@/models/children/healthCheckConstants';
import { formatNumber } from '@/utils/children/childrenHelpers';
import { BmiStatusBadge, ConclusionCategoryBadge } from './ChildBadges';

/** Một dòng tóm tắt kết luận bác sĩ BE trả: chuyên khoa được chuyển, vấn đề, hoặc lời dặn. */
export const conclusionNoteOf = (c) => (c?.specialty ? `Chuyển khám: ${c.specialty}` : c?.issueText || c?.adviceText || '');

const NONE = <span className="muted">—</span>;

function DoctorConclusion({ m, prefixed }) {
  if (!m.conclusionCategory) return NONE;
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

/**
 * Kết luận sức khỏe của một lần đo (HLT-19), theo nhãn BE trả, UI không tự xếp mức.
 * variant "conclusion" (cột "Kết luận sức khỏe" của Sổ sức khỏe): theo loại đợt — đợt khám ⇒ kết luận bác sĩ (chưa kết luận ⇒ —);
 * kỳ cân đo, lần đo ngoài đợt ⇒ mức BMI theo tuổi kèm số BMI (user chốt 2026-11-10).
 * variant "warning" (Xu hướng sức khỏe, cạnh cột BMI): theo nguồn kết quả, ghi nguồn "Bác sĩ:"/"BMI:".
 */
export function HealthWarningCell({ measurement: m, variant = 'warning' }) {
  const prefixed = variant === 'warning';
  const byDoctor = prefixed
    ? m.source === MEASUREMENT_SOURCE.EXAM
    : m.source === MEASUREMENT_SOURCE.EXAM || m.campaignKind === CAMPAIGN_KIND.EXAM;
  if (byDoctor) return <DoctorConclusion m={m} prefixed={prefixed} />;
  const legacy = m.source === MEASUREMENT_SOURCE.LEGACY;
  if (!m.bmiStatus && !legacy) return NONE;
  return (
    <div className="tr-cell-stack">
      {m.bmiStatus ? (
        <span className="row row--wrap gap-1-5">
          {prefixed && <span className="muted text-xs">BMI:</span>}
          <BmiStatusBadge status={m.bmiStatus} />
        </span>
      ) : (
        NONE
      )}
      {!prefixed && m.bmi != null && <span className="muted text-xs">BMI {formatNumber(m.bmi)}</span>}
      {legacy && prefixed && <span className="muted text-xs">{MEASUREMENT_SOURCE_LABELS.LEGACY}</span>}
    </div>
  );
}
