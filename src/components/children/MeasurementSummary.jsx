import { Link } from 'react-router-dom';
import { MEASUREMENT_SOURCE, MEASUREMENT_SOURCE_LABELS } from '@/models/children/childrenConstants';
import { CAMPAIGN_KIND } from '@/models/children/healthCheckConstants';
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
import { ChildInfoTable } from './ChildInfoTable';

const NOT_SET = <span className="muted">Chưa cập nhật</span>;

const hasHead = (m) =>
  m.campaignKind !== CAMPAIGN_KIND.MEASUREMENT &&
  m.source !== MEASUREMENT_SOURCE.MEASUREMENT_ONLY &&
  m.headCircumferenceCm != null &&
  m.headCircumferenceCm !== '';

const headRow = (m) =>
  hasHead(m) && {
    label: 'Vòng đầu',
    value: m.headCircumferenceStatus ? <HeadCircumferenceBadge status={m.headCircumferenceStatus} /> : NOT_SET,
  };

/** Mức BMI theo tuổi BE xếp (HLT-18) cho số đo của kỳ cân đo; null khi không xếp được (thiếu số đo, trẻ ngoài 0–84 tháng). */
const bmiRow = (m) => ({
  label: 'BMI theo tuổi',
  value: m.bmiStatus ? (
    <div className="tr-cell-stack">
      <BmiStatusBadge status={m.bmiStatus} />
      <span className="muted text-xs">
        Z-score {formatSigned(m.bmiZScore)} · hệ thống tính theo chuẩn WHO, chỉ để sàng lọc, không phải chẩn đoán
      </span>
    </div>
  ) : (
    <span className="muted">Không xếp mức (thiếu số đo hoặc trẻ ngoài 0–84 tháng tuổi)</span>
  ),
});

/** Kết luận bác sĩ của phiếu Phụ lục II (BE trả); mức theo dõi theo kết luận này (HLT-10). */
const examRows = (m) => {
  const c = m.exam.conclusion;
  return [
    {
      label: 'Kết luận của bác sĩ',
      value: (
        <div className="tr-cell-stack">
          <ConclusionCategoryBadge status={m.conclusionCategory} />
          <span>
            {conclusionLabelOf(c)}
            {c.issueText ? `: ${c.issueText}` : ''}
          </span>
          {c.issueKind && <span className="muted text-sm">{ISSUE_KIND_LABELS[c.issueKind]}</span>}
        </div>
      ),
    },
    {
      label: 'Tư vấn / chuyển khám',
      value: (
        <>
          {conclusionActionLabelOf(c) || '—'}
          {c.adviceText && <div className="muted text-sm mt-8">Lời dặn: {c.adviceText}</div>}
        </>
      ),
    },
    {
      label: 'Tình trạng dinh dưỡng',
      value: m.exam.nutrition.statuses.map((s) => labelOf(NUTRITION_STATUS_OPTIONS, s)).join(', ') || NOT_SET,
    },
    headRow(m),
    { label: 'Bác sĩ kết luận', value: c.doctorName || NOT_SET },
    {
      label: 'Mức theo dõi',
      value: (
        <>
          <FollowUpLevelBadge status={m.followUpLevel} />
          {m.campaignId && (
            <div className="mt-8">
              <Link className="text-primary text-sm" to={`/children/health-checks/${m.campaignId}/exam/${m.childId}`}>
                Xem phiếu khám đầy đủ
              </Link>
            </div>
          )}
        </>
      ),
    },
  ];
};

/** Mẫu cũ (trước phiếu Phụ lục II, chỉ ở dữ liệu cũ): vòng đầu (khi có số), vận động thô/tinh để xem lại; cảnh báo theo BMI như kỳ cân đo. */
const legacyRows = (m) => [
  bmiRow(m),
  headRow(m),
  { label: 'Vận động thô', value: m.grossMotor ? <MotorResultBadge status={m.grossMotor} /> : NOT_SET },
  { label: 'Vận động tinh', value: m.fineMotor ? <MotorResultBadge status={m.fineMotor} /> : NOT_SET },
  {
    label: 'Mẫu nhập',
    value: (
      <span className="muted text-sm">
        {MEASUREMENT_SOURCE_LABELS.LEGACY}: nhập trước khi có phiếu Phụ lục II, không có kết luận bác sĩ.
      </span>
    ),
  },
];

/**
 * Một kết quả dạng bảng (user yêu cầu 2026-11-11): bảng số đo một hàng (mỗi cột một chỉ số) rồi bảng nhãn | giá trị của kết luận
 * bác sĩ (phiếu khám) hoặc mức BMI theo tuổi (kỳ cân đo, mẫu cũ). Kỳ cân đo không đo vòng đầu (2026-11-04): chỉ hiện vòng đầu của
 * phiếu khám, mẫu cũ ngoài kỳ cân đo khi có số.
 */
export function MeasurementSummary({ measurement: m }) {
  const head = hasHead(m);
  const rows =
    m.source === MEASUREMENT_SOURCE.EXAM && m.exam
      ? examRows(m)
      : m.source === MEASUREMENT_SOURCE.LEGACY
        ? legacyRows(m)
        : [bmiRow(m), { label: 'Loại kết quả', value: <span className="muted">{MEASUREMENT_SOURCE_LABELS.MEASUREMENT_ONLY}</span> }];
  return (
    <div className="stack gap-4">
      <div className="table-wrap">
        <table className="table table--grid tr-metric-table" aria-label="Số đo">
          <thead>
            <tr>
              <th className="num">Chiều cao (cm)</th>
              <th className="num">Cân nặng (kg)</th>
              {head && <th className="num">Vòng đầu (cm)</th>}
              <th className="num">BMI</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="num">{formatNumber(m.heightCm)}</td>
              <td className="num">{formatNumber(m.weightKg)}</td>
              {head && <td className="num">{formatNumber(m.headCircumferenceCm)}</td>}
              <td className="num">{formatNumber(m.bmi)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ChildInfoTable label="Kết quả" rows={rows} />
    </div>
  );
}
