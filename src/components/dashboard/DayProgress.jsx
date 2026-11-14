import { Link } from 'react-router-dom';
import { ListChecks } from '@/components/ui/icons';
import { Widget } from '@/components/dashboard/DashboardWidgets';

const BADGE_TONE = { done: 'green', doing: 'blue', late: 'red', todo: 'gray', none: 'gray', unknown: 'gray' };

/** Thanh tiến độ của một bước; tỷ lệ do service trả (value/total hoặc progress), chỉ vẽ. */
function StepBar({ ratio, status }) {
  const pct = ratio == null ? 0 : Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <svg className="db-step__track" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
      <rect className={`db-step__bar db-step__bar--${BADGE_TONE[status]}`} x="0" y="0" width={pct} height="10" />
    </svg>
  );
}

/**
 * "Tiến độ trong ngày" (trang chủ phương án A): 5 bước theo thứ tự trong ngày, mỗi bước là một liên kết mở màn tương ứng.
 * steps = useDayProgress().steps (service buildDayProgress).
 */
export function DayProgress({ q }) {
  return (
    <Widget
      title="Tiến độ trong ngày"
      icon={ListChecks}
      loading={q.loading}
      error={q.error}
      onRetry={q.reload}
      empty={!q.steps.length}
      emptyTitle="Chưa có số liệu hôm nay"
      emptyText="Tiến độ điểm danh, khám đầu ngày, báo ăn, bếp và đánh giá sẽ hiện ở đây."
    >
      <p className="muted text-sm db-steps__note">Bấm một bước để mở màn tương ứng.</p>
      <ol className="db-steps">
        {q.steps.map((s, i) => {
          const ratio = s.progress ?? (s.total ? (s.value ?? 0) / s.total : null);
          return (
            <li key={s.key} className="db-steps__item">
              <Link to={s.to} className="db-step">
                <span className="db-step__head">
                  <span className="db-step__index" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className={`chip chip--${BADGE_TONE[s.status]}`}>{s.badge}</span>
                </span>
                <span className="db-step__label">{s.label}</span>
                <span className="db-step__value">
                  {s.text ?? (s.value == null ? '—' : s.value)}
                  {s.text == null && s.value != null && (
                    <span className="db-step__unit">{s.total ? ` / ${s.total} ${s.unit}` : ` ${s.unit}`}</span>
                  )}
                </span>
                <StepBar ratio={ratio} status={s.status} />
                <span className="db-step__note">{s.note}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </Widget>
  );
}
