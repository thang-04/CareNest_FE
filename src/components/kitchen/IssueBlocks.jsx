import { ISSUE_HISTORY_LABELS, MEAL_SESSION_LABELS } from '@/models/kitchen/kitchenConstants';
import { formatDateTime } from '@/utils/format';
import { fmtQty } from '@/components/kitchen/KitchenFilters';

/** Cooking plan sent with the issue slip: servings and dishes per meal session. */
export function CookingPlan({ sessions }) {
  if (!sessions?.length) return null;
  return (
    <div className="card mb-16">
      <div className="card__header">
        <div className="card__title">Kế hoạch nấu</div>
      </div>
      <div className="card__body kb-sessions">
        {sessions.map((s) => (
          <div key={s.session} className="kb-menu">
            <div className="kb-menu__head">
              <div className="subsection-title">{MEAL_SESSION_LABELS[s.session]}</div>
              <div className="kb-totals">
                <span className="chip chip--blue">{s.normal} suất thường</span>
                <span className="chip chip--orange">{s.substitute} suất thay thế</span>
              </div>
            </div>
            {s.dishes.length === 0 ? (
              <div className="muted text-sm">Chưa có số suất đã xác nhận.</div>
            ) : (
              <ul className="kb-dishes text-sm">
                {s.dishes.map((d) => (
                  <li key={d.dishId}>
                    <b>{d.name}</b> – {d.normal + d.substitute} suất
                    {d.substitute > 0 && <span className="muted"> (gồm {d.substitute} suất thay thế)</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** UC 6.25: issued vs received quantities confirmed by the kitchen. */
export function ReceiptReconciliation({ receipt, md }) {
  return (
    <div className="card mb-16">
      <div className="card__header row row--between">
        <div className="card__title">Đối chiếu bếp nhận thực phẩm</div>
        {receipt.hasDifference ? (
          <span className="chip chip--orange">Có chênh lệch</span>
        ) : (
          <span className="chip chip--green">Khớp phiếu</span>
        )}
      </div>
      <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Thực phẩm</th>
              <th className="right">Xuất kho</th>
              <th className="right">Bếp thực nhận</th>
              <th className="right">Chênh lệch</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((it) => (
              <tr key={it.foodId}>
                <td>{it.name}</td>
                <td className="right nowrap">
                  {fmtQty(it.issuedQty)} {it.unit}
                </td>
                <td className="right nowrap">{fmtQty(it.receivedQty)}</td>
                <td className={`right nowrap ${it.difference < 0 ? 'kb-short' : it.difference > 0 ? 'kb-over' : 'muted'}`}>
                  {it.difference === 0 ? '—' : `${it.difference > 0 ? '+' : ''}${fmtQty(it.difference)}`}
                </td>
                <td className="kb-cell-wrap">{it.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card__body muted text-sm">
        Xác nhận bởi {md.userById(receipt.confirmedBy)?.fullName || '—'} lúc {formatDateTime(receipt.confirmedAt)}.
      </div>
    </div>
  );
}

export function IssueHistory({ history, md }) {
  return (
    <div className="card mb-16">
      <div className="card__header">
        <div className="card__title">Nhật ký phiếu</div>
      </div>
      <div className="card__body">
        <ul className="history-list">
          {[...history].reverse().map((h, i) => (
            <li key={`${h.action}-${i}`}>
              <div className="history-list__dot" />
              <div>
                <div>
                  <b>{ISSUE_HISTORY_LABELS[h.action] || h.action}</b> · {h.userId ? md.userById(h.userId)?.fullName || '' : 'Hệ thống'}
                </div>
                {h.note && <div className="text-2">“{h.note}”</div>}
                <div className="muted text-xs">{formatDateTime(h.at)}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
