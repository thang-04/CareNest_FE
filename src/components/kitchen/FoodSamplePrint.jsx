import { forwardRef } from 'react';
import { PrintHeader } from '@/components/print/PrintHeader';
import { formatDate, formatDateTime } from '@/utils/format';
import { MEAL_SESSION_LABELS } from '@/models/kitchen/kitchenConstants';

/*
 * Biểu mẫu lưu mẫu thức ăn theo QĐ 1246/QĐ-BYT. Ô ký để trống: in ra rồi ký tay (hệ thống không có vai nhân viên y tế).
 * Mẫu 4: nhãn dán hộp mẫu, mỗi món một nhãn. Mẫu 5: sổ lưu và hủy mẫu của cả ngày, mỗi món một dòng.
 */

const timeOf = (iso) => (iso ? formatDateTime(iso) : '');

export const SampleLabelsPrint = forwardRef(function SampleLabelsPrint({ log, campusName }, ref) {
  const labels = log.meals.flatMap((m) => m.dishes.map((d) => ({ meal: m, dish: d })));
  return (
    <div className="print-sheet" ref={ref}>
      <div className="ps-title">
        <h1>NHÃN MẪU THỨC ĂN LƯU (MẪU 4)</h1>
        <div>
          Ngày {formatDate(log.date)}
          {campusName ? ` · ${campusName}` : ''}
        </div>
      </div>
      <div className="kb-labels">
        {labels.map(({ meal, dish }) => (
          <table key={`${meal.session}-${dish.dishId}`} className="ps-table kb-label">
            <tbody>
              <tr>
                <th colSpan={2}>MẪU THỨC ĂN LƯU</th>
              </tr>
              <tr>
                <td>Bữa ăn</td>
                <td>{MEAL_SESSION_LABELS[meal.session]}</td>
              </tr>
              <tr>
                <td>Tên mẫu thức ăn</td>
                <td>{dish.name}</td>
              </tr>
              <tr>
                <td>Thời gian lấy mẫu</td>
                <td>{timeOf(meal.takenAt)}</td>
              </tr>
              <tr>
                <td>Người lấy mẫu</td>
                <td className="kb-label__sign" />
              </tr>
            </tbody>
          </table>
        ))}
      </div>
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
