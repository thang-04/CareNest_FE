import { CONVERTED_GRAM_ROWS, quyDoiGam } from '@/utils/menu-planning/nutritionSetup';
import { DataTable } from '@/components';

const format = (v) => (v == null ? '—' : v.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/**
 * Hàm lượng quy đổi tại trường (g/trẻ/ngày): cơ cấu áp dụng quy ra gam ở hai mốc kcal của trường. Chỉ đọc, làm tròn 2 chữ số
 * khi hiển thị; chưa đủ cơ cấu hợp lệ hoặc thiếu kcal thì hiện "—".
 */
export function NutritionConvertedTable({ kcal, applied, factors }) {
  const [min, max] = kcal || [];
  const atMin = quyDoiGam(min, applied, factors || undefined);
  const atMax = quyDoiGam(max, applied, factors || undefined);
  const columns = [
    { key: 'label', header: 'Chỉ tiêu', render: ({ label }) => label },
    {
      key: 'min',
      header: min ? `Từ ${min} kcal` : 'Từ — kcal',
      className: 'num',
      render: ({ key }) => format(atMin?.[key]),
    },
    {
      key: 'max',
      header: max ? `Đến ${max} kcal` : 'Đến — kcal',
      className: 'num',
      render: ({ key }) => format(atMax?.[key]),
    },
  ];

  return (
    <div className="td-converted">
      <p className="td-converted__note">Tự động tính từ khoảng năng lượng và cơ cấu P:L:G đã thiết lập phía trên.</p>
      <DataTable columns={columns} rows={CONVERTED_GRAM_ROWS} rowKey="key" className="table--compact td-norm td-norm--rows" />
    </div>
  );
}
