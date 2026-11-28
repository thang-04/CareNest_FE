import { forwardRef } from 'react';
import { SampleLabelCards } from '@/components/kitchen/SampleLabelCards';
import { PrintHeader } from '@/components/print/PrintHeader';
import { formatDate, formatDateTime } from '@/utils/format';
import { MEAL_SESSION_LABELS } from '@/models/kitchen/kitchenConstants';

/*
 * Biểu mẫu lưu mẫu thức ăn theo QĐ 1246/QĐ-BYT. Ô ký để trống: in ra rồi ký tay (hệ thống không có vai nhân viên y tế).
 * Mẫu 4: nhãn dán hộp mẫu, mỗi bữa một nhãn (`SampleLabelCards`, giống màn Kiểm thực). Mẫu 5: sổ lưu và hủy mẫu của cả ngày, mỗi món một dòng.
 */

const timeOf = (iso) => (iso ? formatDateTime(iso) : '');

export const SampleLabelsPrint = forwardRef(function SampleLabelsPrint({ log, campusName }, ref) {
  const labels = log.meals.map((meal) => ({
    key: meal.session,
    sessionLabel: MEAL_SESSION_LABELS[meal.session],
    dishes: meal.dishes.map((dish) => dish.name),
    takenAt: meal.takenAt,
  }));
  return (
    <div className="print-sheet" ref={ref}>
      <div className="ps-title">
        <h1>MẪU SỐ 4: NHÃN MẪU THỨC ĂN LƯU</h1>
        <div>
          Ngày {formatDate(log.date)}
          {campusName ? ` · ${campusName}` : ''}
        </div>
      </div>
      <SampleLabelCards labels={labels} date={log.date} />
    </div>
  );
});

export const SampleBookPrint = forwardRef(function SampleBookPrint({ log, campusName }, ref) {
  let n = 0;
  return (
    <div className="print-sheet" ref={ref}>
      <PrintHeader />
      <div className="ps-title">
        <h1>SỔ LƯU VÀ HỦY MẪU THỨC ĂN LƯU (MẪU 5)</h1>
        <div>
          Ngày {formatDate(log.date)}
          {campusName ? ` · ${campusName}` : ''}
        </div>
      </div>
      <table className="ps-table">
        <thead>
          <tr>
            <th>TT</th>
            <th>Tên mẫu thức ăn</th>
            <th>Bữa ăn</th>
            <th>Số suất ăn</th>
            <th>Khối lượng / thể tích mẫu</th>
            <th>Dụng cụ chứa mẫu</th>
            <th>Nhiệt độ bảo quản</th>
            <th>Thời gian lấy mẫu</th>
            <th>Thời gian hủy mẫu</th>
            <th>Ghi chú</th>
            <th>Người lưu mẫu (ký)</th>
            <th>Người hủy mẫu (ký)</th>
          </tr>
        </thead>
        <tbody>
          {log.meals.flatMap((m) =>
            m.dishes.map((d) => {
              n += 1;
              return (
                <tr key={`${m.session}-${d.dishId}`}>
                  <td className="c">{n}</td>
                  <td>{d.name}</td>
                  <td>{MEAL_SESSION_LABELS[m.session]}</td>
                  <td className="c">{m.servings ?? ''}</td>
                  <td className="c">{d.weight}</td>
                  <td>{d.container}</td>
                  <td className="c">{d.temperature}</td>
                  <td className="c">{timeOf(m.takenAt)}</td>
                  <td className="c">{timeOf(m.destroyedAt)}</td>
                  <td>{d.note}</td>
                  <td />
                  <td />
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
});
