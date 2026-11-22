import { EmptyState } from '@/components/ui/States';
import { formatDateTime } from '@/utils/format';
import { profileHistoryRows } from '@/utils/children/profileHistory';

/** Tab "Lịch sử sửa hồ sơ" (user chốt 2026-11-22): tiếp nhận, sửa hồ sơ (kể cả đổi "Báo ăn"), nghỉ học, tiếp nhận lại. */
export function ChildProfileHistory({ history }) {
  const rows = profileHistoryRows(history);
  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">Lịch sử sửa hồ sơ</h2>
      </div>
      <div className="card__body">
        {rows.length === 0 ? (
          <EmptyState title="Chưa có lịch sử" description="Mỗi lần tiếp nhận, sửa hồ sơ hoặc cho nghỉ học sẽ được ghi lại ở đây." />
        ) : (
          <ul className="history-list">
            {rows.map((row) => (
              <li key={row.key}>
                <span className="history-list__dot" />
                <div>
                  <div>
                    <b>{row.actionLabel}</b>
                  </div>
                  {/* div, không lồng li: CSS .history-list li vẽ chấm, đường nối cho mọi li con */}
                  {row.changes.map((text) => (
                    <div key={text} className="text-sm">
                      {text}
                    </div>
                  ))}
                  <div className="muted text-sm">
                    {[row.userName, row.at ? formatDateTime(row.at) : '', row.note ? `Lý do: ${row.note}` : ''].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
