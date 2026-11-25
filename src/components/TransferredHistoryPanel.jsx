import { DataTable } from '@/components/ui/DataTable';
import { ErrorState } from '@/components/ui/States';
import { ChildNameCell } from '@/components/assessment/ChildNameCell';
import { useTransferredHistory } from '@/hooks/assessment/useAssessment';
import { EMOTION_LABELS } from '@/models/assessment/assessmentConstants';
import { BEHAVIORS, EATING_LABELS, NAP_LABELS } from '@/models/assessment/dailyObservationOptions';
import { MEAL_SESSION_SHORT } from '@/models/school-config/schoolConfigConstants';
import { HEALTH_SYMPTOMS } from '@/utils/dailyHealthValidation';
import { formatDate } from '@/utils/format';
import {
  attendanceText,
  historyChildren,
  historyOfDate,
  recordedText,
  stayText,
  weeklyCommentsOf,
} from '@/utils/assessment/transferredHistory';

const NO_DATA = <span className="muted">Chưa có dữ liệu</span>;

const Line = ({ label, children }) => (
  <div className="text-sm">
    <span className="muted">{label}: </span>
    {children}
  </div>
);

const Recorded = ({ text }) => (text ? <div className="muted text-xs">{text}</div> : null);

const Chips = ({ goals, tone }) =>
  (goals || []).map((g) => (
    <span key={g.id} className={`chip chip--${tone}`} title={g.description || g.name}>
      {g.name}
    </span>
  ));

// Đánh giá hằng ngày ở lớp cũ: hiện đúng giá trị đã ghi, thiếu mục nào ghi "Chưa có dữ liệu"
function DayCell({ entry }) {
  if (!entry?.day) return NO_DATA;
  const d = entry.day;
  const meals = Object.entries(d.meals || {});
  const goals = (d.met || []).length + (d.effort || []).length + (d.notMet || []).length;
  return (
    <div className="stack">
      <Line label="Sức khỏe">
        {d.health ? (d.health.signs || []).map((x) => HEALTH_SYMPTOMS[x] || x).join(', ') || 'Không ghi dấu hiệu' : NO_DATA}
        {d.health?.note && <span className="muted"> · {d.health.note}</span>}
      </Line>
      <Line label="Ăn">
        {meals.length ? meals.map(([s, v]) => `${MEAL_SESSION_SHORT[s] || s}: ${EATING_LABELS[v] || v}`).join(' · ') : NO_DATA}
      </Line>
      <Line label="Ngủ">{d.nap ? NAP_LABELS[d.nap] || d.nap : NO_DATA}</Line>
      <Line label="Cảm xúc">{d.emotion ? EMOTION_LABELS[d.emotion] || d.emotion : NO_DATA}</Line>
      <Line label="Hành vi">
        {(d.behaviors || []).length ? d.behaviors.map((x) => BEHAVIORS[x] || x).join(', ') : NO_DATA}
        {d.behaviorNote && <span className="muted"> · {d.behaviorNote}</span>}
      </Line>
      <Line label="Kiến thức, kỹ năng">
        {goals ? (
          <span className="dg-days__goals">
            <Chips goals={d.met} tone="green" />
            <Chips goals={d.effort} tone="orange" />
            <Chips goals={d.notMet} tone="red" />
          </span>
        ) : (
          NO_DATA
        )}
      </Line>
      <Line label="Nhận xét">{d.comment || NO_DATA}</Line>
      <Recorded
        text={recordedText({
          className: d.className,
          name: entry.recordedByName || d.recordedByName,
          at: entry.recordedAt || d.recordedAt,
        })}
      />
    </div>
  );
}

function AttendanceCell({ attendance, health }) {
  if (!attendance.length && !health.length) return NO_DATA;
  return (
    <div className="stack">
      {attendance.map((a, i) => (
        <div key={`a${i}`}>
          <div className="text-sm">{attendanceText(a)}</div>
          <Recorded text={recordedText({ className: a.className, name: a.recordedByName })} />
        </div>
      ))}
      {health.map((h, i) => (
        <div key={`h${i}`}>
          <div className="text-sm">
            {[
              h.temperature != null && `Thân nhiệt ${h.temperature}°C`,
              (h.symptoms || []).length && (h.symptoms || []).map((x) => HEALTH_SYMPTOMS[x] || x).join(', '),
              h.note,
            ]
              .filter(Boolean)
              .join(' · ') || 'Ghi nhận sức khỏe không có nội dung'}
          </div>
          <Recorded text={recordedText({ className: h.className, name: h.recordedByName, at: h.recordedAt })} />
        </div>
      ))}
    </div>
  );
}

function WeeklyCell({ comments }) {
  if (!comments.length) return NO_DATA;
  return (
    <div className="stack">
      {comments.map((c, i) => (
        <div key={i}>
          <div className="text-sm">{c.content || NO_DATA}</div>
          <div className="muted text-xs">
            Tuần từ {formatDate(c.weekStart)} ·{' '}
            {recordedText({ className: c.className, name: c.sentByName, at: c.sentAt, nameLabel: 'người gửi' })}
          </div>
        </div>
      ))}
    </div>
  );
}

const GOAL_TONE = (met) => (met === true ? 'green' : met === false ? 'red' : 'gray');

function ThemesCell({ results }) {
  if (!results.length) return NO_DATA;
  return (
    <div className="stack">
      {results.map((t) => (
        <div key={`${t.themeId}-${t.classId}`}>
          <div className="text-sm fw-600">
            {t.themeName} ({formatDate(t.startDate)} – {formatDate(t.endDate)})
          </div>
          <div className="text-sm">
            Đạt {t.met} · Chưa đạt {t.notMet}
            {t.rate != null && ` · ${t.rate}%`}
            {t.passed === true && ' · Đạt chủ đề'}
            {t.passed === false && ' · Chưa đạt chủ đề'}
          </div>
          {(t.goals || []).length > 0 && (
            <div className="dg-days__goals">
              {t.goals.map((g) => (
                <span key={g.goalId} className={`chip chip--${GOAL_TONE(g.met)}`} title={g.text}>
                  MT{g.goalNo}
                  {g.met == null && ' · chưa có kết quả'}
                </span>
              ))}
            </div>
          )}
          <Recorded
            text={recordedText({ className: t.className, name: t.confirmedByName, at: t.confirmedAt, nameLabel: 'người xác nhận' })}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * "Lịch sử lớp cũ (chỉ xem)" của trẻ chuyển đến lớp (BE OBS-35). Chỉ hiển thị, không có ô nhập hay nút ghi,
 * không đưa vào dữ liệu lưu / gửi của màn. BE không trả trẻ nào ⇒ không hiện gì.
 * sections: 'day' (đánh giá ngày), 'attendance' (điểm danh, sức khỏe), 'weekly' (nhận xét tuần), 'themes' (cuối chủ đề).
 */
export function TransferredHistoryPanel({ classId, range, date, weekStart, sections = ['day', 'attendance'] }) {
  const { history, error, reload } = useTransferredHistory(classId, range);
  if (error) {
    // Không có quyền / không thấy lớp: phần phụ này ẩn đi, màn chính đã tự báo
    if (error.status === 403 || error.status === 404) return null;
    return (
      <div className="card mt-16">
        <div className="card__body">
          <ErrorState error={error} onRetry={reload} />
        </div>
      </div>
    );
  }
  const children = historyChildren(history);
  if (!children.length) return null;

  const columns = [
    {
      key: 'child',
      header: 'Trẻ',
      render: (c) => <ChildNameCell child={{ fullName: c.childName }} sub={(c.stays || []).map(stayText).join('; ') || null} />,
    },
    sections.includes('day') && {
      key: 'day',
      header: `Đánh giá ngày ${formatDate(date)}`,
      render: (c) => <DayCell entry={historyOfDate(c, date).day} />,
    },
    sections.includes('attendance') && {
      key: 'attendance',
      header: `Điểm danh, sức khỏe ${formatDate(date)}`,
      render: (c) => <AttendanceCell {...historyOfDate(c, date)} />,
    },
    sections.includes('weekly') && {
      key: 'weekly',
      header: 'Nhận xét tuần đã gửi',
      render: (c) => <WeeklyCell comments={weeklyCommentsOf(c, weekStart)} />,
    },
    sections.includes('themes') && {
      key: 'themes',
      header: 'Kết quả cuối chủ đề',
      render: (c) => <ThemesCell results={c.themeResults || []} />,
    },
  ].filter(Boolean);

  return (
    <section className="card mt-16" aria-label="Lịch sử lớp cũ">
      <div className="card__header">
        <div className="card__title">Lịch sử lớp cũ (chỉ xem)</div>
      </div>
      <div className="card__body">
        <p className="muted text-sm mb-8">Dữ liệu ghi ở lớp cũ của trẻ chuyển đến lớp này, chỉ để xem.</p>
        <DataTable columns={columns} rows={children} rowKey="childId" />
      </div>
    </section>
  );
}
