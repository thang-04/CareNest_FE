import { HEAD_CIRCUMFERENCE_STATUS, SCREENING_CRITERIA_LABELS } from '@/models/children/childrenConstants';
import { formatNumber } from '@/utils/children/childrenHelpers';
import { BmiStatusBadge, FollowUpLevelBadge, HeadCircumferenceBadge, MotorResultBadge } from './ChildBadges';

const NOT_SET = <span className="muted">Chưa cập nhật</span>;

/** Một kết quả khám: số đo + kết quả sàng lọc BE trả (phân loại BMI, vòng đầu, vận động, mức theo dõi). */
export function MeasurementSummary({ measurement: m }) {
  const flagged = (m.criteria || []).filter((c) => c.flagged);
  return (
    <>
      <div className="tr-metrics tr-metrics--4">
        <div>
          <div className="tr-metric__value">{formatNumber(m.heightCm)}</div>
          <div className="muted text-sm">Chiều cao (cm)</div>
        </div>
        <div>
          <div className="tr-metric__value">{formatNumber(m.weightKg)}</div>
          <div className="muted text-sm">Cân nặng (kg)</div>
        </div>
        <div>
          <div className="tr-metric__value">{formatNumber(m.headCircumferenceCm)}</div>
          <div className="muted text-sm">Vòng đầu (cm)</div>
        </div>
        <div>
          <div className="tr-metric__value">{formatNumber(m.bmi)}</div>
          <div className="muted text-sm">BMI</div>
        </div>
      </div>
      <dl className="info-list mt-16">
        <dt>Phân loại BMI</dt>
        <dd>
          <BmiStatusBadge status={m.bmiStatus} />
        </dd>
        <dt>Vòng đầu</dt>
        <dd>
          {m.headCircumferenceStatus ? <HeadCircumferenceBadge status={m.headCircumferenceStatus} /> : NOT_SET}
          {m.headCircumferenceStatus === HEAD_CIRCUMFERENCE_STATUS.NOT_MEASURED && (
            <div className="muted text-sm mt-8">Trẻ trên 60 tháng tuổi tại ngày đo: không đo vòng đầu, chỉ xét 2 tiêu chí vận động.</div>
          )}
        </dd>
        <dt>Vận động thô</dt>
        <dd>{m.grossMotor ? <MotorResultBadge status={m.grossMotor} /> : NOT_SET}</dd>
        <dt>Vận động tinh</dt>
        <dd>{m.fineMotor ? <MotorResultBadge status={m.fineMotor} /> : NOT_SET}</dd>
        <dt>Mức theo dõi</dt>
        <dd>
          <FollowUpLevelBadge status={m.followUpLevel} />
          {flagged.length > 0 && (
            <div className="muted text-sm mt-8">
              Theo tiêu chí: {flagged.map((c) => SCREENING_CRITERIA_LABELS[c.key] || c.key).join(' · ')}
            </div>
          )}
        </dd>
      </dl>
    </>
  );
}
