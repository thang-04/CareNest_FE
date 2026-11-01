import { Link } from 'react-router-dom';
import { EMOTION_LABELS } from '@/models/assessment/assessmentConstants';
import { BEHAVIORS, NAP, NAP_LABELS } from '@/models/assessment/dailyObservationOptions';
import { HEALTH_SYMPTOMS } from '@/utils/dailyHealthValidation';
import { mealsText } from '@/components/assessment/DailyAssessmentCells';
import { formatDate } from '@/utils/format';

const GoalChip = ({ goal, tone }) => (
  <span className={`chip chip--${tone}`} title={goal.description || goal.name}>
    {goal.name}
  </span>
);

/** Đánh giá hằng ngày trong kỳ, mỗi ngày một dòng, cùng cột với màn Đánh giá hằng ngày (căn cứ của bản nháp AI). */
export function DailyDaysTable({ days, mealSessions, classId, linkDays }) {
  if (!days.length) return <div className="muted">Không có đánh giá hằng ngày nào trong kỳ.</div>;
  const dash = <span className="muted">—</span>;
  return (
    <div className="table-wrap">
      <table className="table table--grid dg-days">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Sức khỏe</th>
            <th>Ăn</th>
            <th>Ngủ</th>
            <th>Cảm xúc</th>
            <th>Hành vi</th>
            <th>Kiến thức, kỹ năng</th>
            <th>Nhận xét</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <td className="nowrap">
                {linkDays ? (
                  <Link to={`/assessment/daily?classId=${classId}&date=${d.date}`} title="Mở đánh giá hằng ngày của ngày này">
                    {formatDate(d.date)}
                  </Link>
                ) : (
                  formatDate(d.date)
                )}
              </td>
              <td className={d.health?.signs.length ? 'dg-cell--warn' : ''}>
                {d.health ? (
                  <>
                    {d.health.signs.length ? d.health.signs.map((x) => HEALTH_SYMPTOMS[x] || x).join(', ') : 'Bình thường'}
                    {d.health.note && <div className="muted text-xs">{d.health.note}</div>}
                  </>
                ) : (
                  dash
                )}
              </td>
              <td>{d.meals ? mealsText(d.meals, mealSessions) : dash}</td>
              <td className={d.nap && d.nap !== NAP.NGU_TOT ? 'dg-cell--warn' : ''}>{d.nap ? NAP_LABELS[d.nap] : dash}</td>
              <td>{d.emotion ? EMOTION_LABELS[d.emotion] : dash}</td>
              <td>
                {d.behaviors.length ? d.behaviors.map((x) => BEHAVIORS[x] || x).join(', ') : dash}
                {d.behaviorNote && <div className="muted text-xs">{d.behaviorNote}</div>}
              </td>
              <td>
                {d.met.length || d.effort?.length || d.notMet.length ? (
                  <div className="dg-days__goals">
                    {d.met.map((g) => (
                      <GoalChip key={g.id} goal={g} tone="green" />
                    ))}
                    {(d.effort || []).map((g) => (
                      <GoalChip key={g.id} goal={g} tone="orange" />
                    ))}
                    {d.notMet.map((g) => (
                      <GoalChip key={g.id} goal={g} tone="red" />
                    ))}
                  </div>
                ) : (
                  dash
                )}
              </td>
              <td className="dg-days__comment">{d.comment || dash}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
