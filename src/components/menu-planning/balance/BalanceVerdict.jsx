import { StatusBadge } from '@/components';
import { formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import { formatAmount, verdictDeltaOf, verdictGaugesOf, verdictOf } from '@/utils/menu-planning/dayBalance';

const kcal = (v) => `${formatAmount(v, 0)} kcal`;
// Khoảng ghi đơn vị một lần ở cuối: "615 – 726 kcal"
const kcalRange = (min, max) => `${formatAmount(min, 0)} – ${kcal(max)}`;
const moneyRange = (min, max) => `${formatAmount(Math.round(min), 0)} – ${formatMoney(max)}`;
const pct = (v) => `${formatAmount(v, 1)}%`;
const signed = (v, fmt) => `${v > 0 ? '+' : '−'}${fmt(Math.abs(v))}`;

const QUANTITY_HINT = { HIGH: 'giảm', LOW: 'tăng' };
const MONEY_HINT = { HIGH: 'bớt', LOW: 'thêm' };
const BAD = new Set(['HIGH', 'LOW']);

const toneOf = (status) => (status === 'OK' ? 'ok' : BAD.has(status) ? 'bad' : 'none');

/** Thanh đo: vùng xanh = khoảng đạt, vạch = số thực tế. Số đã ghi bằng chữ ngay dưới nên thanh chỉ để nhìn. */
function Gauge({ scale, status }) {
  if (!scale || scale.value == null) return null;
  return (
    <svg className="td-verdict__bar" aria-hidden="true" focusable="false">
      <rect className="td-verdict__track" x="0" y="25%" width="100%" height="50%" rx="4" />
      <rect className="td-verdict__band" x={`${scale.from}%`} y="25%" width={`${scale.to - scale.from}%`} height="50%" rx="4" />
      <rect
        className={`td-verdict__pin td-verdict__pin--${toneOf(status)}`}
        x={`${scale.value}%`}
        y="0"
        width="4"
        height="100%"
        rx="2"
        transform="translate(-2 0)"
      />
    </svg>
  );
}

/** Dòng chữ dưới thanh đo: thực tế · cần khoảng nào · cần sửa bao nhiêu. */
function GaugeText({ g, fmt, range, hints }) {
  if (g.value == null) return <p className="td-verdict__text text-sm muted">Chưa có số liệu</p>;
  return (
    <p className="td-verdict__text text-sm">
      <b>{fmt(g.value)}</b>
      {g.min != null && <span className="muted"> · cần {range(g.min, g.max)}</span>}
      {g.gap != null && hints[g.status] && (
        <b className="td-verdict__gap">
          {' '}
          · {hints[g.status]} ≥ {fmt(g.gap)}
        </b>
      )}
    </p>
  );
}

function Criterion({ label, note, status, kind, children }) {
  return (
    <div className="td-verdict__row">
      <div className="td-verdict__head">
        <span>
          <b>{label}</b> <span className="muted text-sm">{note}</span>
        </span>
        <StatusBadge {...verdictOf(status, kind)} />
      </div>
      {children}
    </div>
  );
}

/**
 * Nội dung thẻ "Kết quả cân đối": mỗi tiêu chí một thanh đo thực tế so với khoảng đạt và số cần sửa, để biết còn cách
 * bao xa thay vì chỉ thấy Cao / Thiếu.
 */
export function BalanceVerdictList({ evaluation }) {
  const g = verdictGaugesOf(evaluation);
  if (!g) return null;
  return (
    <div className="td-verdict">
      <Criterion label="Lượng" note="Calo cả ngày" status={g.quantity.status}>
        <Gauge scale={g.quantity.scale} status={g.quantity.status} />
        <GaugeText g={g.quantity} fmt={kcal} range={kcalRange} hints={QUANTITY_HINT} />
      </Criterion>
      <Criterion label="Chất" note="Tỷ lệ đạm : béo : đường" status={g.quality.status}>
        <ul className="td-verdict__parts text-sm">
          {g.quality.parts.map((p) => (
            <li key={p.key} className={`td-verdict__part td-verdict__part--${toneOf(p.status)}`}>
              <span className="muted">{p.label}</span> <b>{p.value == null ? '—' : pct(p.value)}</b>
              {p.min != null && (
                <span className="muted text-xs">
                  {' '}
                  ({formatAmount(p.min, 1)}–{formatAmount(p.max, 1)})
                </span>
              )}
            </li>
          ))}
        </ul>
      </Criterion>
      <Criterion label="Tiền" note="Chi phí 1 trẻ / ngày" status={g.money.status} kind="money">
        <Gauge scale={g.money.scale} status={g.money.status} />
        <GaugeText g={g.money} fmt={formatMoney} range={moneyRange} hints={MONEY_HINT} />
      </Criterion>
    </div>
  );
}

const quantityLabel = (q) => {
  if (q.value == null || !BAD.has(q.status))
    return `Lượng ${verdictOf(q.status).label.toLowerCase()}${q.value == null ? '' : ` · ${kcal(q.value)}`}`;
  return `Lượng ${kcal(q.value)} · ${q.status === 'HIGH' ? 'cao' : 'thiếu'} ${kcal(q.gap ?? 0)}`;
};

const qualityLabel = (q) => {
  const off = q.parts.filter((p) => BAD.has(p.status));
  if (!off.length) return `Chất ${verdictOf(q.status).label.toLowerCase()}`;
  return `Chất: ${off.map((p) => `${p.label.toLowerCase()} ${p.status === 'HIGH' ? 'cao' : 'thấp'}`).join(', ')}`;
};

const moneyLabel = (m) => {
  if (m.value == null || !BAD.has(m.status)) return `Tiền ${verdictOf(m.status, 'money').label.toLowerCase()}`;
  return `Tiền ${formatMoney(m.value)} · ${m.status === 'HIGH' ? 'vượt' : 'thiếu'} ${formatMoney(m.gap ?? 0)}`;
};

/**
 * Thanh dính trên bảng thực phẩm: kết quả ba tiêu chí của nhóm tuổi đang xem và lần sửa vừa rồi đổi calo, tiền bao nhiêu,
 * để khi cuộn xuống sửa gam vẫn thấy mình đang tiến gần hay xa khoảng đạt.
 */
export function BalanceStatusBar({ groupName, evaluation, previous }) {
  const g = verdictGaugesOf(evaluation);
  if (!g) return null;
  const delta = verdictDeltaOf(evaluation, previous);
  const parts =
    delta && [delta.kcal != null && signed(delta.kcal, kcal), delta.cost != null && signed(delta.cost, formatMoney)].filter(Boolean);
  return (
    <div className="td-bal-status" role="status" aria-live="polite">
      {groupName && <b>{groupName}</b>}
      <StatusBadge tone={verdictOf(g.quantity.status).tone} label={quantityLabel(g.quantity)} />
      <StatusBadge tone={verdictOf(g.quality.status).tone} label={qualityLabel(g.quality)} />
      <StatusBadge tone={verdictOf(g.money.status, 'money').tone} label={moneyLabel(g.money)} />
      {parts?.length > 0 && <span className="td-bal-status__delta text-sm muted">Lần sửa vừa rồi: {parts.join(', ')}</span>}
    </div>
  );
}
