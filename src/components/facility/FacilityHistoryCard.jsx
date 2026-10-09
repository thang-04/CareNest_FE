import { History } from '@/components/ui/icons';
import { formatDateTime } from '@/utils/format';
import { FACILITY_HISTORY } from '@/models/facility/facilityConstants';

/** Processing log of an issue, request or proposal (newest first). */
export function FacilityHistoryCard({ history = [], userById }) {
  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title row" style={{ gap: 8 }}>
          <History size={17} /> Lịch sử xử lý
        </h2>
      </div>
      <div className="card__body">
        {history.length === 0 ? (
          <div className="muted">Chưa có thao tác nào.</div>
        ) : (
          <ul className="history-list">
            {[...history].reverse().map((h) => (
              <li key={h.id}>
                <div className="history-list__dot" />
                <div>
                  <div>
                    <b>{FACILITY_HISTORY[h.action] || h.action}</b> · {userById(h.userId)?.fullName || '—'}
                  </div>
                  {h.note && <div className="text-2">“{h.note}”</div>}
                  <div className="muted text-xs">{formatDateTime(h.at)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
