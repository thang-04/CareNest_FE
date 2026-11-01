import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/States';
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
      <table className="table table--grid kb-fc">
        <thead>
          <tr>
            <th className="cell--fixed">Lớp</th>
            <th className="num cell--fixed">Đăng ký ăn</th>
            {data.days.map((d) => (
              <th key={d.date} className={`num ${d.date === today ? 'kb-col-today' : ''}`}>
                {dayShort(d.date)}
                <small>{dayNote(d, today)}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.classes.map((c) => (
            <tr key={c.classId}>
              <td className="cell--fixed">{c.className}</td>
              <td className="num cell--fixed">{c.registered}</td>
              {c.cells.map((cell, i) => {
                const day = data.days[i];
                const key = `${c.classId}|${cell.date}`;
                const err = errors?.[key];
                const today_ = day.date === today ? 'kb-col-today' : '';
                if (day.holiday)
                  return (
                    <td key={cell.date} className={`num muted ${today_}`}>
                      —
                    </td>
                  );
                if (!editable || !day.editable)
                  return (
                    <td key={cell.date} className={`num ${today_}`}>
                      {cell.value}
                    </td>
                  );
                const value = cellValue(c.classId, cell);
                const edited = String(cell.suggested) !== value;
                return (
                  <td key={cell.date} className={`num ${today_}`}>
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
            <td className="cell--fixed">Tổng</td>
            <td className="num cell--fixed">{data.classes.reduce((n, c) => n + c.registered, 0)}</td>
            {data.days.map((d, i) => (
              <td key={d.date} className={`num cell--fixed ${d.date === today ? 'kb-col-today' : ''}`}>
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
  if (!data.fresh.length)
    return <EmptyState title="Tuần này không cần đặt hàng tươi" description="Thực đơn tuần không dùng thực phẩm tươi nào." />;
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact kb-fc">
        <thead>
          <tr>
            <th>Thực phẩm tươi</th>
            <th>ĐVT</th>
            {data.days.map((d) => (
              <th key={d.date} className={`num ${d.date === today ? 'kb-col-today' : ''}`}>
                {dayShort(d.date)}
              </th>
            ))}
            <th className="num">Cộng</th>
          </tr>
        </thead>
        <tbody>
          {data.fresh.map((f) => (
            <tr key={f.foodId}>
              <td>{f.name}</td>
              <td>{f.unit}</td>
              {f.days.map((x) => (
                <td key={x.date} className={`num nowrap ${x.date === today ? 'kb-col-today' : ''}`}>
                  {x.sentQty != null && x.sentQty !== x.qty && <s className="muted">{fmtQty(x.sentQty)}</s>}{' '}
                  {x.qty ? (
                    <span className={x.sentQty != null && x.sentQty !== x.qty ? 'fw-600' : undefined}>{fmtQty(x.qty)}</span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              ))}
              <td className="num fw-600">{fmtQty(f.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Đồ khô cần cho các ngày chưa chốt của tuần so với tồn của cơ sở. */
export function DryOrderTable({ data }) {
  if (!data.dry.length)
    return <EmptyState title="Tuần này không cần mua đồ khô" description="Thực đơn các ngày chưa chốt không dùng đồ khô nào." />;
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact">
        <thead>
          <tr>
            <th>Đồ khô</th>
            <th>ĐVT</th>
            <th className="num">Cần cho tuần</th>
            <th className="num">Tồn kho</th>
            <th className="num">Cần mua</th>
          </tr>
        </thead>
        <tbody>
          {data.dry.map((f) => (
            <tr key={f.foodId}>
              <td>{f.name}</td>
              <td>{f.unit}</td>
              <td className="num">{fmtQty(f.need)}</td>
              <td className="num">{fmtQty(f.stock)}</td>
              <td className="num">
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
export function SupplierChangeCard({ group, total, today, canEdit, override = {}, onToggle, onToggleAll }) {
  const isAfterConfirm = group.kind === 'AFTER_CONFIRM';
  const when = group.date === today ? 'Hôm nay' : dayShort(group.date);
  const title = `${when} · ${isAfterConfirm ? 'sau chốt' : 'đổi so với phiếu tuần'}`;
  // override: ô vừa tích, hiện ngay trong lúc chờ lưu
  const isOn = (l) => override[`${group.date}|${l.foodId}`] ?? l.notified;
  const pending = group.lines.filter((l) => !isOn(l)).length;
  const allDone = pending === 0;
  const totalChange = group.sentTotal != null && total != null && group.sentTotal !== total ? `${group.sentTotal} → ${total} suất · ` : '';
  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">{title}</h2>
        <StatusBadge tone={pending ? 'orange' : 'green'} label={`${totalChange}${pending ? `${pending} chưa báo` : 'Đã báo hết'}`} />
      </div>
      <div className="table-wrap">
        <table className="table table--grid table--compact">
          <thead>
            <tr>
              <th className="cell--fixed">Thực phẩm</th>
              <th className="num cell--fixed">Đã đặt</th>
              <th className="num cell--fixed">Cần</th>
              <th className="num cell--fixed">Chênh</th>
              <th className="center">
                {/* Tích ở tiêu đề = đánh dấu / bỏ đánh dấu cả ngày; đang làm dở thì hiện gạch ngang */}
                <label className="checkbox" title={allDone ? 'Bỏ đánh dấu cả ngày' : 'Đánh dấu đã báo NCC cả ngày'}>
                  <input
                    type="checkbox"
                    checked={allDone}
                    ref={(el) => el && (el.indeterminate = !allDone && pending < group.lines.length)}
                    disabled={!canEdit}
                    onChange={() => onToggleAll(group.date, group.lines, !allDone)}
                    aria-label={`Đã báo NCC tất cả thực phẩm ${when}`}
                  />
                  Đã báo
                </label>
              </th>
            </tr>
          </thead>
          <tbody>
            {group.lines.map((l) => {
              return (
                <tr key={l.foodId}>
                  <td className="cell--fixed">
                    {l.name} <span className="text-xs muted">{l.unit}</span>
                  </td>
                  <td className="num cell--fixed">{fmtQty(l.ordered)}</td>
                  <td className="num cell--fixed">{fmtQty(l.needed)}</td>
                  <td className={`num fw-600 cell--fixed ${l.diff < 0 ? 'kb-short' : 'kb-over'}`}>{signed(l.diff)}</td>
                  <td className="center">
                    <label className="checkbox" title={l.notifiedAt ? `Đã báo lúc ${formatDateTime(l.notifiedAt)}` : undefined}>
                      <input
                        type="checkbox"
                        checked={isOn(l)}
                        disabled={!canEdit}
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
