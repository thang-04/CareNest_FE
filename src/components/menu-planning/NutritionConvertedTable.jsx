import { CONVERTED_GRAM_ROWS, quyDoiGam } from '@/utils/menu-planning/nutritionSetup';

const format = (v) => (v == null ? '—' : v.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/**
 * Hàm lượng quy đổi tại trường (g/trẻ/ngày): cơ cấu áp dụng quy ra gam ở hai mốc kcal của trường. Chỉ đọc, làm tròn 2 chữ số
 * khi hiển thị; chưa đủ cơ cấu hợp lệ hoặc thiếu kcal thì hiện "—".
 */
export function NutritionConvertedTable({ kcal, applied, factors }) {
  const [min, max] = kcal || [];
  const atMin = quyDoiGam(min, applied, factors || undefined);
  const atMax = quyDoiGam(max, applied, factors || undefined);
  return (
    <div className="td-converted">
      <p className="td-converted__note">Tự động tính từ khoảng năng lượng và cơ cấu P:L:G đã thiết lập phía trên.</p>
      <div className="table-wrap">
        <table className="table table--grid table--compact td-norm td-norm--rows">
          <thead>
            <tr>
              <th>Chỉ tiêu</th>
              <th className="num">{min ? `Từ ${min} kcal` : 'Từ — kcal'}</th>
              <th className="num">{max ? `Đến ${max} kcal` : 'Đến — kcal'}</th>
            </tr>
          </thead>
          <tbody>
            {CONVERTED_GRAM_ROWS.map(({ key, label }) => (
              <tr key={key}>
                <th scope="row">{label}</th>
                <td className="num">{format(atMin?.[key])}</td>
                <td className="num">{format(atMax?.[key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
