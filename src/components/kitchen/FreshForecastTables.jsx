import { ForecastDayPlanBadge } from '@/components/kitchen/KitchenBadges';
import { dayShort } from '@/components/kitchen/ForecastBlocks';
import { fmtQty } from '@/components/kitchen/KitchenFilters';

/** Số trẻ theo nhóm tuổi: đang theo học (BE trả) và dự kiến (sửa được khi `editable`). */
export function ForecastCountsTable({ counts, editable, errors = {}, onChange }) {
  return (
    <div className="table-wrap">
      <table className="table table--grid">
        <thead>
          <tr>
            <th>Nhóm tuổi</th>
            <th className="num">Đang theo học</th>
            <th className="num">Dự kiến</th>
          </tr>
        </thead>
        <tbody>
          {counts.map((count, i) => (
            <tr key={count.ageGroupId}>
              <td>{count.ageGroupName}</td>
              <td className="num">{count.enrolledCount}</td>
              <td className="num">
                {editable ? (
                  <>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className={`input kb-num ${errors[`counts.${i}`] ? 'input--error' : ''}`}
                      value={count.expectedCount}
                      onChange={(e) => onChange(i, e.target.value)}
                      aria-label={`Số trẻ dự kiến ${count.ageGroupName}`}
                    />
                    {errors[`counts.${i}`] && <div className="field__error">{errors[`counts.${i}`]}</div>}
                  </>
                ) : (
                  count.expectedCount
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Thực phẩm cần đặt: tổng cả kỳ và từng ngày, theo đơn vị mua. Đầu cột ngày kèm tình trạng thực đơn của ngày đó. */
export function ForecastLinesTable({ forecast }) {
  const { days, lines } = forecast;
  return (
    <div className="table-wrap">
      <table className="table table--grid">
        <thead>
          <tr>
            <th className="num">STT</th>
            <th className="min-w-220">Thực phẩm</th>
            <th className="num">Tổng cộng</th>
            <th className="center">Đơn vị</th>
            {days.map((day) => (
              <th key={day.date} className="num">
                <div className="nowrap">{dayShort(day.date)}</div>
                <div className="kb-day-plan">
                  {day.off ? <span className="muted">Ngày nghỉ</span> : <ForecastDayPlanBadge status={day.planStatus} />}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            const byDate = Object.fromEntries(line.byDate.map((cell) => [cell.date, cell]));
            return (
              <tr key={line.food.id}>
                <td className="num">{i + 1}</td>
                <td>{line.food.name}</td>
                <td className="num fw-600">{fmtQty(line.purchaseTotal)}</td>
                <td className="center">{line.food.purchaseUnit}</td>
                {days.map((day) => (
                  <td key={day.date} className="num">
                    {byDate[day.date] ? fmtQty(byDate[day.date].purchaseQuantity) : <span className="muted">—</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
