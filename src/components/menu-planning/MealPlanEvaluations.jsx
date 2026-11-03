import { NormStatusChip } from '@/components/menu-planning/MenuBadges';
import { EVAL_ROW_KEYS, EVAL_ROW_LABELS, EVAL_ROW_UNITS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import { formatQty } from '@/utils/format';
import { evaluationGroups } from '@/utils/menu-planning/mealPlanGrid';
import { dayLabel } from '@/utils/menu-planning/menuChecks';

// Chữ ngắn dưới con số: nói rõ trạng thái bằng chữ, không chỉ bằng màu
const ROW_NOTE = { LOW: 'Thấp', HIGH: 'Cao', OK: 'Đạt' };
const ROW_TONE = { OK: 'ok', LOW: 'warn', HIGH: 'warn', NA: 'muted', INCOMPLETE: 'muted' };
// Đạm, béo, bột: định mức là % năng lượng (BE NUT-24) ⇒ hiện cả % năng lượng BE trả (`percent`), khoảng định mức theo %
const ENERGY_SHARE_KEYS = ['protein', 'lipid', 'glucid'];

function RowCell({ row }) {
  if (!row) return <td className="td-eval__cell">—</td>;
  const unit = EVAL_ROW_UNITS[row.key];
  const share = ENERGY_SHARE_KEYS.includes(row.key);
  const rangeUnit = share ? '%' : unit;
  let note;
  if (row.status === 'NA') note = 'Chưa đặt định mức';
  else if (row.status === 'INCOMPLETE') note = 'Chưa đủ dữ liệu';
  else note = [ROW_NOTE[row.status], row.attainment != null ? `${formatQty(row.attainment)}% đạt` : null].filter(Boolean).join(' · ');
  const range =
    row.min != null || row.max != null
      ? `Định mức ${row.min != null ? formatQty(row.min) : '…'} – ${row.max != null ? formatQty(row.max) : '…'} ${rangeUnit}`
      : undefined;
  return (
    <td className={`td-eval__cell td-eval__cell--${ROW_TONE[row.status] || 'muted'}`} title={range}>
      <span className="fw-600">
        {formatQty(row.value)} {unit}
        {share && row.percent != null ? ` · ${formatQty(row.percent)}%` : ''}
      </span>
      <small>{note}</small>
    </td>
  );
}

/** Bảng kiểm dinh dưỡng của khối do BE tính sau khi lưu: mỗi nhóm tuổi một bảng, cột là ngày, hàng là sáu chỉ số + giá. */
export function MealPlanEvaluations({ plan, block }) {
  const groups = evaluationGroups(plan, block);
  if (!groups.length)
    return <p className="td-card-note td-flat muted">Chưa có bảng kiểm. Lưu nháp để hệ thống kiểm tra theo định mức của từng nhóm tuổi.</p>;
  const dates = plan.days.map((d) => d.date);
  return (
    <div className="td-eval-list">
      {groups.map((group, index) => (
        <details key={group.ageGroupId} className="td-balance-toggle" open={index === 0}>
          <summary>{group.ageGroupName}</summary>
          <div className="table-wrap">
            <table className="table table--grid td-eval">
              <thead>
                <tr>
                  <th>Chỉ số</th>
                  {dates.map((date) => (
                    <th key={date}>{dayLabel(date)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Kết quả</th>
                  {dates.map((date) => (
                    <td key={date} className="td-eval__cell">
                      {group.byDate[date] ? <NormStatusChip status={group.byDate[date].status} /> : '—'}
                    </td>
                  ))}
                </tr>
                {EVAL_ROW_KEYS.map((key) => (
                  <tr key={key}>
                    <th scope="row">{EVAL_ROW_LABELS[key]}</th>
                    {dates.map((date) => (
                      <RowCell key={date} row={group.byDate[date]?.rows?.find((r) => r.key === key)} />
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row">Tiền ăn / mức giá</th>
                  {dates.map((date) => {
                    const evaluation = group.byDate[date];
                    return (
                      <td key={date} className="td-eval__cell">
                        {evaluation ? (
                          <>
                            <span className="fw-600">{formatMoney(evaluation.cost)}</span>
                            <small>/ {formatMoney(evaluation.mealPrice)}</small>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  );
}
