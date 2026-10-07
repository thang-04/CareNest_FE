import { MEAL_SESSION_LABELS, PREP_STATUS_LABELS } from '@/models/kitchen/kitchenConstants';
import { formatDateTime } from '@/utils/format';
import { MealCountStatusBadge, PrepStatusBadge } from '@/components/kitchen/KitchenBadges';

/** One meal session: preparation status, servings per class and the status history (UC 6.12 / 6.17). */
export function PreparationCard({ item, md, classId = 'ALL', showHistory = true }) {
  const record = item.record;
  const classes = classId === 'ALL' ? item.classes : item.classes.filter((c) => c.classId === classId);
  return (
    <div className="card">
      <div className="card__header row row--between">
        <div className="card__title">{MEAL_SESSION_LABELS[item.session]}</div>
        <PrepStatusBadge status={record?.status || 'NOT_STARTED'} />
      </div>
      <div className="card__body stack">
        {!item.hasMenu ? (
          <div className="muted">Không có thực đơn đã công bố cho bữa này.</div>
        ) : (
          <>
            <dl className="info-list">
              <dt>Số suất ăn</dt>
              <dd>
                {item.mealCountStatus === 'CONFIRMED' ? (
                  <>
                    {item.totals.normal} suất thường · {item.totals.substitute} suất thay thế
                  </>
                ) : (
                  <MealCountStatusBadge status={item.mealCountStatus} />
                )}
              </dd>
              <dt>Cập nhật gần nhất</dt>
              <dd>
                {record ? `${md.userById(record.updatedBy)?.fullName || '—'} · ${formatDateTime(record.updatedAt)}` : 'Bếp chưa cập nhật'}
              </dd>
              {record?.note && (
                <>
                  <dt>Ghi chú của bếp</dt>
                  <dd>{record.note}</dd>
                </>
              )}
            </dl>
            {classes.length > 0 && (
              <div className="table-wrap">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Lớp</th>
                      <th className="right">Suất thường</th>
                      <th className="right">Suất thay thế</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classes.map((c) => (
                      <tr key={c.classId}>
                        <td>{c.className}</td>
                        <td className="right">{c.normal}</td>
                        <td className="right">{c.substitute}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {showHistory && record?.history?.length > 0 && (
              <div>
                <div className="subsection-title mb-8">Diễn biến</div>
                <ul className="history-list">
                  {[...record.history].reverse().map((h, i) => (
                    <li key={`${h.at}-${i}`}>
                      <div className="history-list__dot" />
                      <div>
                        <div>
                          <b>{PREP_STATUS_LABELS[h.status]}</b> · {md.userById(h.userId)?.fullName || ''}
                        </div>
                        {h.note && <div className="text-2">“{h.note}”</div>}
                        <div className="muted text-xs">{formatDateTime(h.at)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
