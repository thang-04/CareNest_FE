import { Link } from 'react-router-dom';
import { Eye, FileCheck2 } from '@/components/ui/icons';
import { BMI_STATUS, FOLLOW_UP_LEVEL } from '@/models/children/childrenConstants';
import { formatDate, formatSigned } from '@/utils/format';
import { formatAgeMonths, formatNumber } from '@/utils/children/childrenHelpers';
import { BmiStatusBadge, ConclusionCategoryBadge, FollowUpLevelShortBadge } from './ChildBadges';

// Khối được nhấn mạnh khi mức nặng: bác sĩ kết luận theo dõi sát, hoặc BMI gầy còm nặng / béo phì (BE trả mức, UI chỉ chọn kiểu).
const SEVERE_BMI = [BMI_STATUS.SEVERE_THINNESS, BMI_STATUS.OBESE];

function Panel({ title, subtitle, alert, children }) {
  return (
    <div className={`tr-warn-panel ${alert ? 'tr-warn-panel--alert' : ''}`}>
      <div className="tr-warn-panel__head">
        <h3 className="tr-warn-panel__title">{title}</h3>
        <span className="muted text-xs">{subtitle}</span>
      </div>
      {children}
    </div>
  );
}

/** Kết luận rút gọn của lần khám: chỉ các dòng bác sĩ có ghi. */
const examLines = (c) =>
  [
    ['Chuyển khám chuyên khoa', c?.specialty],
    ['Vấn đề', c?.issueText],
    ['Lời dặn', c?.adviceText],
    ['Bác sĩ', c?.doctorName],
  ].filter(([, text]) => text?.trim());

/**
 * Cảnh báo sức khỏe hiện tại ở đầu Sổ sức khỏe (HLT-19): kết luận bác sĩ của đợt khám gần nhất (latestExam) và mức BMI theo tuổi
 * của kỳ cân đo gần nhất (latestBmi, HLT-18). BE tính khi đọc; không có bước xử lý. onViewBmi(measurementId): mở hộp xem lần đo.
 */
export function HealthWarningsCard({ childId, latestExam: exam, latestBmi: bmi, onViewBmi }) {
  const lines = exam ? examLines(exam.conclusion) : [];
  return (
    <section className="card mb-16" aria-labelledby="health-warnings-title">
      <div className="card__header">
        <h2 className="card__title" id="health-warnings-title">
          Cảnh báo sức khỏe
        </h2>
      </div>
      <div className="card__body">
        <div className="grid-2">
          <Panel title="Kết luận bác sĩ" subtitle="Đợt khám gần nhất" alert={exam?.followUpLevel === FOLLOW_UP_LEVEL.CLOSE_WATCH}>
            {exam ? (
              <>
                <div className="row row--wrap gap-2">
                  {/* Nhãn ngắn: nhãn dài lặp ý với nhóm kết luận bên cạnh và tràn khối ở màn 375px. */}
                  <FollowUpLevelShortBadge status={exam.followUpLevel} />
                  <ConclusionCategoryBadge status={exam.conclusionCategory} />
                </div>
                {lines.length > 0 && (
                  <ul className="tr-warn-lines text-sm">
                    {lines.map(([label, text]) => (
                      <li key={label}>
                        <span className="muted">{label}:</span> {text}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="tr-warn-panel__foot">
                  <span className="muted text-xs">
                    {exam.campaignName || 'Ngoài đợt khám'} · {formatDate(exam.date)}
                  </span>
                  {exam.campaignId && (
                    <Link className="btn btn--sm" to={`/children/health-checks/${exam.campaignId}/exam/${childId}`}>
                      <FileCheck2 size={15} /> Xem phiếu khám
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <p className="muted text-sm m-0">Chưa có kết luận bác sĩ.</p>
            )}
          </Panel>
          <Panel title="BMI theo tuổi" subtitle="Kỳ cân đo gần nhất" alert={SEVERE_BMI.includes(bmi?.bmiStatus)}>
            {bmi ? (
              <>
                <div className="row row--wrap gap-2">
                  <BmiStatusBadge status={bmi.bmiStatus} />
                </div>
                <p className="text-sm m-0">
                  <span className="fw-600">BMI {formatNumber(bmi.bmi)}</span> · Z-score {formatSigned(bmi.bmiZScore)}
                </p>
                <div className="tr-warn-panel__foot">
                  <span className="muted text-xs">
                    {bmi.campaignName || 'Ngoài đợt khám'} · {formatDate(bmi.date)} · {formatAgeMonths(bmi.ageMonths)}
                  </span>
                  {onViewBmi && (
                    <button type="button" className="btn btn--sm" onClick={() => onViewBmi(bmi.measurementId)}>
                      <Eye size={15} /> Xem chi tiết
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p className="muted text-sm m-0">Chưa có số đo của kỳ cân đo.</p>
            )}
          </Panel>
        </div>
        <p className="muted text-xs mt-12">
          Cảnh báo BMI do hệ thống tính theo chuẩn WHO (BMI theo tuổi), chỉ để sàng lọc, không phải chẩn đoán. Kết luận sức khỏe theo bác sĩ
          ở đợt khám.
        </p>
      </div>
    </section>
  );
}
