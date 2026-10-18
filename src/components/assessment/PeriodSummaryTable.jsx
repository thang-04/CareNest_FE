import { EMOTION_LABELS } from '@/models/assessment/assessmentConstants';
import { MEAL_SESSION_SHORT } from '@/models/school-config/schoolConfigConstants';
import { BEHAVIORS, NAP_LABELS, PARTICIPATION_LABELS, POSITIVE_BEHAVIORS } from '@/models/assessment/dailyObservationOptions';
import { TEMPERATURE_LEVELS } from '@/utils/attendance/temperatureLevels';
import { HEALTH_ACTIONS, HEALTH_SYMPTOMS } from '@/utils/dailyHealthValidation';

const LEVEL_LABELS = Object.fromEntries(TEMPERATURE_LEVELS.map((l) => [l.key, l.label]));

const list = (counts, labels) =>
  Object.entries(counts || {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${labels[k] || k} ${n}`)
    .join(' · ') || '—';

/**
 * Bảng số liệu của kỳ, đếm từ ô tích của đánh giá hằng ngày (backend trả về trong summary.structured).
 * Đây cũng là đầu vào gửi AI cùng mục tiêu của giáo án; giáo viên đối chiếu khi duyệt bản nháp.
 */
export function PeriodSummaryTable({ data }) {
  if (!data?.observedDays) return null;
  const goals = Object.entries(data.goals?.byGoal || {});
  const behaviorsGood = Object.fromEntries(Object.entries(data.behaviors).filter(([b]) => POSITIVE_BEHAVIORS.includes(b)));
  const behaviorsConcern = Object.fromEntries(Object.entries(data.behaviors).filter(([b]) => !POSITIVE_BEHAVIORS.includes(b)));
  return (
    <div className="card mt-16">
      <div className="card__header">
        <h2 className="card__title">Số liệu từ đánh giá hằng ngày</h2>
        <span className="muted text-sm">{data.observedDays} ngày có ghi nhận</span>
      </div>
      <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
        <table className="table table--grid">
          <tbody>
            <tr>
              <th scope="row">Sức khỏe (số ngày)</th>
              <td>
                {data.health.days ? (
                  <>
                    <div>
                      Bình thường {data.health.normalDays}/{data.health.days} · biểu hiện: {list(data.health.signDays, HEALTH_SYMPTOMS)}
                    </div>
                    <div>Thân nhiệt khi khám (mức cần chú ý): {list(data.health.feverDays, LEVEL_LABELS)}</div>
                    <div>Xử trí: {list(data.health.actionDays, HEALTH_ACTIONS)}</div>
                  </>
                ) : (
                  '—'
                )}
              </td>
            </tr>
            <tr>
              <th scope="row">Ăn (số ngày)</th>
              <td>
                {Object.entries(data.meals).map(([m, c]) => (
                  <div key={m}>
                    {MEAL_SESSION_SHORT[m] || m}: ăn hết {c.AN_HET} · ăn ít {c.AN_IT} · không ăn {c.KHONG_AN}
                  </div>
                ))}
              </td>
            </tr>
            <tr>
              <th scope="row">Ngủ trưa</th>
              <td>{list(data.nap, NAP_LABELS)}</td>
            </tr>
            <tr>
              <th scope="row">Cảm xúc</th>
              <td>{list(data.emotion, EMOTION_LABELS)}</td>
            </tr>
            <tr>
              <th scope="row">Hành vi</th>
              <td>
                <div>Tích cực: {list(behaviorsGood, BEHAVIORS)}</div>
                <div>Cần lưu ý: {list(behaviorsConcern, BEHAVIORS)}</div>
              </td>
            </tr>
            <tr>
              <th scope="row">Tham gia hoạt động</th>
              <td>{list(data.participation, PARTICIPATION_LABELS)}</td>
            </tr>
            <tr>
              <th scope="row">Mục tiêu, tiêu chí đạt (lượt)</th>
              <td>
                {goals.length === 0
                  ? 'Chưa có mục tiêu được chấm trong kỳ'
                  : goals.map(([g, c]) => (
                      <div key={g}>
                        {g}: đạt {c.dat} · chưa đạt {c.chuaDat}
                      </div>
                    ))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
