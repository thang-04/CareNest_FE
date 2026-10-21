import { Link } from 'react-router-dom';
import {
  HEAD_CIRCUMFERENCE_STATUS,
  MEASUREMENT_SOURCE,
  MEASUREMENT_SOURCE_LABELS,
  SCREENING_CRITERIA_LABELS,
} from '@/models/children/childrenConstants';
import {
  ISSUE_KIND_LABELS,
  NUTRITION_STATUS_OPTIONS,
  conclusionActionLabelOf,
  conclusionLabelOf,
  labelOf,
} from '@/models/children/healthExamForm';
import { formatNumber } from '@/utils/children/childrenHelpers';
import { ConclusionCategoryBadge, FollowUpLevelBadge, HeadCircumferenceBadge, MotorResultBadge } from './ChildBadges';

const NOT_SET = <span className="muted">Chưa cập nhật</span>;

/** Kết luận bác sĩ của phiếu Phụ lục II (BE trả); mức theo dõi theo kết luận này. */
function ExamConclusion({ m }) {
  const c = m.exam.conclusion;
  return (
    <dl className="info-list mt-16">
      <dt>Kết luận của bác sĩ</dt>
      <dd>
        <div className="tr-cell-stack">
          <ConclusionCategoryBadge status={m.conclusionCategory} />
          <span>
            {conclusionLabelOf(c)}
            {c.issueText ? `: ${c.issueText}` : ''}
          </span>
          {c.issueKind && <span className="muted text-sm">{ISSUE_KIND_LABELS[c.issueKind]}</span>}
        </div>
      </dd>
      <dt>Tư vấn / chuyển khám</dt>
      <dd>
        {conclusionActionLabelOf(c) || '—'}
        {c.adviceText && <div className="muted text-sm mt-8">Lời dặn: {c.adviceText}</div>}
      </dd>
      <dt>Tình trạng dinh dưỡng</dt>
      <dd>{m.exam.nutrition.statuses.map((s) => labelOf(NUTRITION_STATUS_OPTIONS, s)).join(', ') || NOT_SET}</dd>
      <dt>Vòng đầu</dt>
      <dd>{m.headCircumferenceStatus ? <HeadCircumferenceBadge status={m.headCircumferenceStatus} /> : NOT_SET}</dd>
      <dt>Bác sĩ kết luận</dt>
      <dd>{c.doctorName || NOT_SET}</dd>
      <dt>Mức theo dõi</dt>
      <dd>
        {/* Lần khám của trẻ đang có phiếu theo dõi: mức theo phiếu, không phải đề nghị chuyển khám mới. */}
        {c.followUpFinding ? (
          <span>
            Trẻ đang trong phiếu theo dõi.{' '}
            {m.followUpId && (
              <Link className="text-primary text-sm" to={`/children/health-follow-ups/${m.followUpId}`}>
                Mở phiếu theo dõi
              </Link>
            )}
          </span>
        ) : (
          <FollowUpLevelBadge status={m.followUpLevel} />
        )}
        {m.campaignId && (
          <div className="mt-8">
            <Link className="text-primary text-sm" to={`/children/health-checks/${m.campaignId}/exam/${m.childId}`}>
              Xem phiếu khám đầy đủ
            </Link>
          </div>
        )}
      </dd>
    </dl>
  );
}

/** Mẫu cũ (trước phiếu Phụ lục II): vòng đầu, vận động thô/tinh, mức theo 3 tiêu chí. */
function LegacyScreening({ m }) {
  const flagged = (m.criteria || []).filter((c) => c.flagged);
  return (
    <dl className="info-list mt-16">
      <dt>Vòng đầu</dt>
      <dd>
        {m.headCircumferenceStatus ? <HeadCircumferenceBadge status={m.headCircumferenceStatus} /> : NOT_SET}
        {m.headCircumferenceStatus === HEAD_CIRCUMFERENCE_STATUS.NOT_MEASURED && (
          <div className="muted text-sm mt-8">Trẻ trên 60 tháng tuổi tại ngày đo: không đo vòng đầu.</div>
        )}
      </dd>
      <dt>Vận động thô</dt>
      <dd>{m.grossMotor ? <MotorResultBadge status={m.grossMotor} /> : NOT_SET}</dd>
      <dt>Vận động tinh</dt>
      <dd>{m.fineMotor ? <MotorResultBadge status={m.fineMotor} /> : NOT_SET}</dd>
      <dt>Mức theo dõi</dt>
      <dd>
        <FollowUpLevelBadge status={m.followUpLevel} />
        <div className="muted text-sm mt-8">
          {MEASUREMENT_SOURCE_LABELS.LEGACY}
          {flagged.length > 0 && ` · theo tiêu chí: ${flagged.map((c) => SCREENING_CRITERIA_LABELS[c.key] || c.key).join(' · ')}`}
        </div>
      </dd>
    </dl>
  );
}

/** Một kết quả khám: số đo + kết luận bác sĩ (phiếu khám) hoặc sàng lọc mẫu cũ. Không còn nhãn phân loại BMI (user chốt 2026-10-17). */
export function MeasurementSummary({ measurement: m }) {
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
      {m.source === MEASUREMENT_SOURCE.EXAM && m.exam ? (
        <ExamConclusion m={m} />
      ) : m.source === MEASUREMENT_SOURCE.LEGACY ? (
        <LegacyScreening m={m} />
      ) : (
        <p className="muted text-sm mt-16">{MEASUREMENT_SOURCE_LABELS.MEASUREMENT_ONLY}.</p>
      )}
    </>
  );
}
