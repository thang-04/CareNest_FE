import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { formatDateTime } from '@/utils/format';

/* Khối của trang Dự trù & đi chợ theo tuần. Mọi số do service tính; ở đây chỉ hiển thị và nhận ô nhập. */

const WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export const dayShort = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${WEEKDAY[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const weekLabel = (days) => {
  if (!days?.length) return '';
  const [a, b] = [days[0].date, days[days.length - 1].date];
  const dm = (iso) => iso.slice(8, 10);
  return `${dm(a)}–${dm(b)}/${b.slice(5, 7)}/${b.slice(0, 4)}`;
};
const signed = (n) => (n > 0 ? `+${fmtQty(n)}` : `−${fmtQty(Math.abs(n))}`);

const dayNote = (day, today) => {
  if (day.holiday) return 'Nghỉ';
  if (day.confirmed) return 'Đã chốt';
  if (day.date < today) return 'Đã qua';
  if (day.date === today) return 'Hôm nay';
  return 'Dự trù';
};

/** Lưới suất dự kiến lớp × ngày. Ô của ngày chưa chốt sửa được khi `editable`; ngày đã chốt hiện số chốt. */
export function WeekForecastGrid({ data, today, draft, errors, editable, onChange }) {
  const cellValue = (classId, cell) => draft?.[classId]?.[cell.date] ?? String(cell.value);
  const total = (i) =>
    data.classes.reduce((n, c) => {
      const v = Number(cellValue(c.classId, c.cells[i]));
      return n + (Number.isFinite(v) ? v : 0);
    }, 0);
  return (
    <div className="table-wrap">
      <table className="table kb-fc">
        <thead>
          <tr>
            <th>Lớp</th>
            <th className="right">Đăng ký ăn</th>
            {data.days.map((d) => (
              <th key={d.date} className={`right ${d.date === today ? 'kb-col-today' : ''}`}>
                {dayShort(d.date)}
                <small>{dayNote(d, today)}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.classes.map((c) => (
            <tr key={c.classId}>
              <td>{c.className}</td>
              <td className="right">{c.registered}</td>
              {c.cells.map((cell, i) => {
                const day = data.days[i];
                const key = `${c.classId}|${cell.date}`;
                const err = errors?.[key];
                const today_ = day.date === today ? 'kb-col-today' : '';
                if (day.holiday)
                  return (
                    <td key={cell.date} className={`right muted ${today_}`}>
                      —
                    </td>
                  );
                if (!editable || !day.editable)
                  return (
                    <td key={cell.date} className={`right ${today_}`}>
                      {cell.value}
                    </td>
                  );
                const value = cellValue(c.classId, cell);
                const edited = String(cell.suggested) !== value;
                return (
                  <td key={cell.date} className={`right ${today_}`}>
                    <span className="kb-fc__cell">
                      <input
                        className={`input kb-fc__input ${err ? 'input--error' : ''}`}
                        inputMode="numeric"
                        value={value}
                        aria-label={`${c.className} ${dayShort(cell.date)}`}
                        aria-invalid={!!err}
                        title={err || (edited ? `Gợi ý ${cell.suggested}` : undefined)}
                        onChange={(e) => onChange(c.classId, cell.date, e.target.value.replace(/[^\d]/g, ''))}
                      />
                      <span className={`kb-fc__mark ${edited ? 'kb-fc__mark--on' : ''}`} aria-hidden="true" />
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="kb-fc__total">
            <td>Tổng</td>
            <td className="right">{data.classes.reduce((n, c) => n + c.registered, 0)}</td>
            {data.days.map((d, i) => (
              <td key={d.date} className={`right ${d.date === today ? 'kb-col-today' : ''}`}>
                {d.holiday ? '—' : total(i)}
                {d.sentTotal != null && d.sentTotal !== total(i) && !d.holiday && <small>phiếu {d.sentTotal}</small>}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Phiếu đặt hàng tuần, hàng tươi: mỗi ngày giao một cột; số gạch là số đã gửi NCC trước khi đổi. */
export function FreshOrderTable({ data, today }) {
  if (!data.fresh.length) return <p className="muted text-sm">Tuần này không có thực phẩm tươi cần đặt.</p>;
  return (
    <div className="table-wrap">
      <table className="table table--compact kb-fc">
        <thead>
          <tr>
            <th>Thực phẩm tươi</th>
            <th>ĐVT</th>
            {data.days.map((d) => (
              <th key={d.date} className={`right ${d.date === today ? 'kb-col-today' : ''}`}>
                {dayShort(d.date)}
              </th>
            ))}
            <th className="right">Cộng</th>
          </tr>
        </thead>
        <tbody>
          {data.fresh.map((f) => (
            <tr key={f.foodId}>
              <td>{f.name}</td>
              <td>{f.unit}</td>
              {f.days.map((x) => (
                <td key={x.date} className={`right nowrap ${x.date === today ? 'kb-col-today' : ''}`}>
                  {x.sentQty != null && x.sentQty !== x.qty && <s className="muted">{fmtQty(x.sentQty)}</s>}{' '}
                  {x.qty ? (
                    <span className={x.sentQty != null && x.sentQty !== x.qty ? 'fw-600' : undefined}>{fmtQty(x.qty)}</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              ))}
              <td className="right fw-600">{fmtQty(f.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Đồ khô cần cho các ngày chưa chốt của tuần so với tồn của cơ sở. */
export function DryOrderTable({ data }) {
  if (!data.dry.length) return <p className="muted text-sm">Thực đơn các ngày còn lại không dùng đồ khô.</p>;
  return (
    <div className="table-wrap">
      <table className="table table--compact">
        <thead>
          <tr>
            <th>Đồ khô</th>
            <th>ĐVT</th>
            <th className="right">Cần cho tuần</th>
            <th className="right">Tồn kho</th>
            <th className="right">Cần mua</th>
          </tr>
        </thead>
        <tbody>
          {data.dry.map((f) => (
            <tr key={f.foodId}>
              <td>{f.name}</td>
              <td>{f.unit}</td>
              <td className="right">{fmtQty(f.need)}</td>
              <td className="right">{fmtQty(f.stock)}</td>
              <td className="right">
                {f.toBuy > 0 ? (
                  <span className="kb-buy">
                    <span className="kb-dot kb-dot--warn" aria-hidden="true" />
                    <b>{fmtQty(f.toBuy)}</b>
                  </span>
                ) : (
                  <span className="muted">Đủ</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Một nhóm thay đổi cần báo NCC (một ngày): bảng Đã đặt / Cần / Chênh / Đã báo. */
export function SupplierChangeCard({ group, total, today, canEdit, busyKey, onToggle }) {
  const isAfterConfirm = group.kind === 'AFTER_CONFIRM';
  const when = group.date === today ? 'Hôm nay' : dayShort(group.date);
  const title = `${when} · ${isAfterConfirm ? 'sau chốt' : 'đổi so với phiếu tuần'}`;
  const pending = group.lines.filter((l) => !l.notified).length;
  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">{title}</h2>
        <span className={`chip ${pending ? 'chip--orange' : 'chip--green'}`}>
          {group.sentTotal != null && total != null && group.sentTotal !== total ? `${group.sentTotal} → ${total} suất · ` : ''}
          {pending ? `${pending} chưa báo` : 'Đã báo hết'}
        </span>
      </div>
      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Thực phẩm</th>
              <th className="right">Đã đặt</th>
              <th className="right">Cần</th>
              <th className="right">Chênh</th>
              <th>Đã báo</th>
            </tr>
          </thead>
          <tbody>
            {group.lines.map((l) => {
              const key = `${group.date}|${l.foodId}`;
              return (
                <tr key={l.foodId}>
                  <td>
                    {l.name} <span className="text-xs muted">{l.unit}</span>
                  </td>
                  <td className="right">{fmtQty(l.ordered)}</td>
                  <td className="right">{fmtQty(l.needed)}</td>
                  <td className={`right fw-600 ${l.diff < 0 ? 'kb-short' : 'kb-over'}`}>{signed(l.diff)}</td>
                  <td>
                    <label className="checkbox" title={l.notifiedAt ? `Đã báo lúc ${formatDateTime(l.notifiedAt)}` : undefined}>
                      <input
                        type="checkbox"
                        checked={l.notified}
                        disabled={!canEdit || busyKey === key}
                        onChange={(e) => onToggle(group.date, l.foodId, e.target.checked)}
                        aria-label={`Đã báo NCC ${l.name}`}
                      />
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
