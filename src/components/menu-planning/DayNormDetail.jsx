import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { NormStatusChip } from '@/components/menu-planning/MenuBadges';
import { IndicatorAmounts } from '@/components/menu-planning/NutritionTable';
import { daySummary, fmtNum } from '@/utils/menu-planning/daySummary';
import { dayLabel } from '@/utils/menu-planning/menuChecks';
import { formatMoney } from '@/models/menu-planning/menuPlanningConstants';

const pct = (v, scale) => `${Math.max(0, Math.min(100, (v / scale) * 100))}%`;

/** Một thanh so với định mức: dải xanh là khoảng đạt, vạch đậm là giá trị của ngày. Vị trí là giá trị động nên dùng style. */
function Meter({ label, value, unit, min, max, status, badge }) {
  const scale = (max || value || 1) * 1.4;
  return (
    <div className="td-day-norm__meter">
      <div className="td-day-norm__row">
        <span>{label}</span>
        <b>{value == null ? '—' : unit === 'đ' ? formatMoney(value) : `${fmtNum(value)} ${unit}`}</b>
      </div>
      <div className="td-day-norm__track" aria-hidden="true">
        {max != null && <span className="td-day-norm__band" style={{ left: pct(min || 0, scale), width: pct(max - (min || 0), scale) }} />}
        {value != null && <span className="td-day-norm__value" style={{ left: pct(value, scale) }} />}
      </div>
      <div className="td-day-norm__row text-xs muted">
        <span>{max == null ? 'Chưa đặt định mức' : unit === 'đ' ? `Tối đa ${formatMoney(max)}` : `Định mức ${min}–${max} ${unit}`}</span>
        {badge || <NormStatusChip status={status} />}
      </div>
    </div>
  );
}

/**
 * Chi tiết một ngày của thực đơn tuần: lượng thực tế 6 chỉ số, năng lượng (kèm % đạt), tỷ lệ đạm/béo/bột và phần động vật,
 * tiền ăn so với định mức và các lưu ý của ngày.
 */
export function DayNormDetail({ open, day, wm, catalog, menuName, issues = [], onClose }) {
  const sum = day ? daySummary(day, wm, catalog) : null;
  const n = sum?.nutrients;
  return (
    <Modal
      open={open && !!day}
      title={day ? `${dayLabel(day.date)}${menuName ? ` · ${menuName}` : ''}` : ''}
      onClose={onClose}
      footer={
        <button type="button" className="btn" onClick={onClose}>
          Đóng
        </button>
      }
    >
      {!sum ? (
        <p className="muted">{day?.holiday ? `Nghỉ: ${day.note}` : 'Ngày này chưa có món.'}</p>
      ) : (
        <div className="td-day-norm">
          <p className="text-sm muted td-flat">Tính cho 1 trẻ trong ngày (các bữa trường phục vụ), so với định mức ở Thiết lập.</p>
          {sum.missing.length > 0 && (
            <p className="td-warn text-sm td-flat">
              Chưa đủ dữ liệu: thiếu số liệu dinh dưỡng hoặc nguồn gốc của {sum.missing.join(', ')}. Số liệu chỉ cộng phần đã có.
            </p>
          )}
          <IndicatorAmounts totals={sum.totals} title="Lượng thực tế / trẻ" />
          <Meter
            label={`Năng lượng${n.kcal.attainment != null ? ` (đạt ${n.kcal.attainment}% định mức)` : ''}`}
            value={n.kcal.value}
            unit="kcal"
            min={n.kcal.min}
            max={n.kcal.max}
            status={n.kcal.status}
          />
          <Meter
            label="Chất đạm (% năng lượng)"
            value={n.protein.percent}
            unit="%"
            min={n.protein.min}
            max={n.protein.max}
            status={n.protein.status}
          />
          <Meter
            label="Chất béo (% năng lượng)"
            value={n.lipid.percent}
            unit="%"
            min={n.lipid.min}
            max={n.lipid.max}
            status={n.lipid.status}
          />
          <Meter
            label="Tinh bột (% năng lượng)"
            value={n.glucid.percent}
            unit="%"
            min={n.glucid.min}
            max={n.glucid.max}
            status={n.glucid.status}
          />
          <Meter
            label="Đạm động vật / tổng đạm"
            value={n.animalProteinPct.value}
            unit="%"
            min={n.animalProteinPct.min}
            max={n.animalProteinPct.max}
            status={n.animalProteinPct.status}
          />
          <Meter
            label="Béo động vật / tổng béo"
            value={n.animalLipidPct.value}
            unit="%"
            min={n.animalLipidPct.min}
            max={n.animalLipidPct.max}
            status={n.animalLipidPct.status}
          />
          <Meter
            label="Tiền ăn"
            value={sum.cost}
            unit="đ"
            min={0}
            max={sum.price}
            badge={
              sum.price == null ? null : sum.overPrice ? (
                <StatusBadge tone="orange" label="Vượt tiền ăn" />
              ) : (
                <StatusBadge tone="green" label="Trong tiền ăn" />
              )
            }
          />
          <div className="td-day-norm__issues">
            <b className="text-sm">{issues.length ? 'Cần sửa' : 'Ngày này đạt, không có gì cần sửa.'}</b>
            {issues.length > 0 && (
              <ul>
                {issues.map((x) => (
                  <li key={x.text} className={x.tone === 'bad' ? 'td-bad' : 'td-warn'}>
                    {x.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
