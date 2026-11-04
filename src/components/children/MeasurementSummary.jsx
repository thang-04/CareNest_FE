import { Link } from 'react-router-dom';
import { MEASUREMENT_SOURCE, MEASUREMENT_SOURCE_LABELS } from '@/models/children/childrenConstants';
import {
  ISSUE_KIND_LABELS,
  NUTRITION_STATUS_OPTIONS,
  conclusionActionLabelOf,
  conclusionLabelOf,
  labelOf,
} from '@/models/children/healthExamForm';
import { formatSigned } from '@/utils/format';
import { formatNumber } from '@/utils/children/childrenHelpers';
import { BmiStatusBadge, ConclusionCategoryBadge, FollowUpLevelBadge, HeadCircumferenceBadge, MotorResultBadge } from './ChildBadges';

const NOT_SET = <span className="muted">Chưa cập nhật</span>;

const hasHead = (m) => m.headCircumferenceCm != null && m.headCircumferenceCm !== '';

/** Kết luận bác sĩ của phiếu Phụ lục II (BE trả); mức theo dõi theo kết luận này (HLT-10). */
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
      {hasHead(m) && (
        <>
          <dt>Vòng đầu</dt>
          <dd>{m.headCircumferenceStatus ? <HeadCircumferenceBadge status={m.headCircumferenceStatus} /> : NOT_SET}</dd>
        </>
      )}
      <dt>Bác sĩ kết luận</dt>
      <dd>{c.doctorName || NOT_SET}</dd>
      <dt>Mức theo dõi</dt>
      <dd>
        <FollowUpLevelBadge status={m.followUpLevel} />
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

/** Mức BMI theo tuổi BE xếp (HLT-18) cho số đo của kỳ cân đo; null khi không xếp được (thiếu số đo, trẻ ngoài 0–84 tháng). */
function BmiResult({ m }) {
  return (
    <>
      <dt>BMI theo tuổi</dt>
      <dd>
        {m.bmiStatus ? (
          <div className="tr-cell-stack">
            <BmiStatusBadge status={m.bmiStatus} />
            <span className="muted text-sm">
              Z-score {formatSigned(m.bmiZScore)} · hệ thống tính theo chuẩn WHO, chỉ để sàng lọc, không phải chẩn đoán
            </span>
          </div>
        ) : (
          <span className="muted">Không xếp mức (thiếu số đo hoặc trẻ ngoài 0–84 tháng tuổi)</span>
        )}
      </dd>
    </>
  );
}

/** Mẫu cũ (trước phiếu Phụ lục II, chỉ ở dữ liệu cũ): vòng đầu (khi có số), vận động thô/tinh để xem lại; cảnh báo theo BMI như kỳ cân đo. */
function LegacyResult({ m }) {
  return (
    <dl className="info-list mt-16">
      <BmiResult m={m} />
      {hasHead(m) && (
        <>
          <dt>Vòng đầu</dt>
          <dd>{m.headCircumferenceStatus ? <HeadCircumferenceBadge status={m.headCircumferenceStatus} /> : NOT_SET}</dd>
        </>
      )}
      <dt>Vận động thô</dt>
      <dd>{m.grossMotor ? <MotorResultBadge status={m.grossMotor} /> : NOT_SET}</dd>
      <dt>Vận động tinh</dt>
      <dd>{m.fineMotor ? <MotorResultBadge status={m.fineMotor} /> : NOT_SET}</dd>
      <dt>Mẫu nhập</dt>
      <dd className="muted text-sm">{MEASUREMENT_SOURCE_LABELS.LEGACY}: nhập trước khi có phiếu Phụ lục II, không có kết luận bác sĩ.</dd>
    </dl>
  );
}

/**
 * Một kết quả: số đo + kết luận bác sĩ (phiếu khám) hoặc mức BMI theo tuổi (kỳ cân đo, mẫu cũ). Kỳ cân đo không đo vòng đầu
 * (2026-11-04): ô vòng đầu chỉ hiện khi lần đo có số (phiếu khám, dữ liệu cũ).
 */
export function MeasurementSummary({ measurement: m }) {
  const head = hasHead(m);
  return (
    <>
      <div className={head ? 'tr-metrics tr-metrics--4' : 'tr-metrics'}>
        <div>
          <div className="tr-metric__value">{formatNumber(m.heightCm)}</div>
          <div className="muted text-sm">Chiều cao (cm)</div>
        </div>
        <div>
          <div className="tr-metric__value">{formatNumber(m.weightKg)}</div>
          <div className="muted text-sm">Cân nặng (kg)</div>
        </div>
        {head && (
          <div>
            <div className="tr-metric__value">{formatNumber(m.headCircumferenceCm)}</div>
            <div className="muted text-sm">Vòng đầu (cm)</div>
          </div>
        )}
        <div>
          <div className="tr-metric__value">{formatNumber(m.bmi)}</div>
          <div className="muted text-sm">BMI</div>
        </div>
      </div>
      {m.source === MEASUREMENT_SOURCE.EXAM && m.exam ? (
        <ExamConclusion m={m} />
      ) : m.source === MEASUREMENT_SOURCE.LEGACY ? (
        <LegacyResult m={m} />
      ) : (
        <dl className="info-list mt-16">
          <BmiResult m={m} />
          <dt>Loại kết quả</dt>
          <dd className="muted">{MEASUREMENT_SOURCE_LABELS.MEASUREMENT_ONLY}</dd>
        </dl>
      )}
    </>
  );
}
