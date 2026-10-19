import { AlertCircle, ChevronDown, CircleCheck, ListChecks, XCircle } from '@/components/ui/icons';

const ICONS = { ok: CircleCheck, warn: AlertCircle, bad: XCircle };

/**
 * Khối "Kiểm tra tự động": nhận xét tính bằng quy tắc từ dữ liệu, tách khỏi gợi ý AI (không dùng icon AI).
 * items: [{ tone: 'ok' | 'warn' | 'bad', text }] viết bằng lời thường; numbers: [{ label, value, norm }] để trong "Xem số liệu".
 */
export function AutoChecks({
  items,
  numbers,
  title = 'Kiểm tra tự động',
  note = 'Hệ thống tự kiểm tra theo định mức và tiền ăn ở Thiết lập.',
}) {
  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">
          <ListChecks size={18} /> {title}
        </h2>
      </div>
      <div className="card__body td-ai-form">
        <p className="text-xs muted td-flat">{note}</p>
        <ul className="td-check-list">
          {items.map((it, i) => {
            const Icon = ICONS[it.tone];
            return (
              <li key={i}>
                <Icon size={18} className={`td-${it.tone}`} aria-hidden="true" />
                <div>{it.text}</div>
              </li>
            );
          })}
        </ul>
        {numbers?.length > 0 && (
          <details className="td-more-info td-numbers">
            <summary className="link-btn">
              <ChevronDown size={16} /> Xem số liệu
            </summary>
            <table className="table table--grid td-ai-meals">
              <thead>
                <tr>
                  <th />
                  <th className="right">Thực đơn</th>
                  <th className="right">Định mức</th>
                </tr>
              </thead>
              <tbody>
                {numbers.map((n) => (
                  <tr key={n.label}>
                    <th scope="row">{n.label}</th>
                    <td className="right nowrap">{n.value}</td>
                    <td className="right nowrap muted">{n.norm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>
    </section>
  );
}
