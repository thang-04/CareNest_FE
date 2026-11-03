import { forwardRef } from 'react';
import { PrintHeader } from '@/components/print/PrintHeader';
import { MEAL_SESSION_LABELS } from '@/models/kitchen/kitchenRecordConstants';
import { formatDate, formatDateTime } from '@/utils/format';

/*
 * Biểu mẫu chung lưu mẫu thức ăn từ các bản đã duyệt. Mẫu sổ của trường chưa chốt (P-26) nên chỉ in các cột BE có;
 * ô ký để trống, ký tay sau khi in.
 */
export const FoodSampleFormPrint = forwardRef(function FoodSampleFormPrint({ samples, campusName, from, to }, ref) {
  return (
    <div className="print-sheet" ref={ref}>
      <PrintHeader />
      <div className="ps-title">
        <h1>SỔ LƯU VÀ HỦY MẪU THỨC ĂN</h1>
        <div>
          {campusName ? `${campusName} · ` : ''}Từ {formatDate(from)} đến {formatDate(to)}
        </div>
      </div>
      <table className="ps-table">
        <thead>
          <tr>
            <th>TT</th>
            <th>Ngày</th>
            <th>Bữa ăn</th>
            <th>Món lưu mẫu</th>
            <th>Thời gian lấy mẫu</th>
            <th>Thời gian hủy mẫu</th>
            <th>Ghi chú</th>
            <th>Người lưu mẫu (ký)</th>
            <th>Người duyệt (ký)</th>
          </tr>
        </thead>
        <tbody>
          {samples.map((sample, i) => (
            <tr key={sample.id}>
              <td>{i + 1}</td>
              <td>{formatDate(sample.date)}</td>
              <td>{MEAL_SESSION_LABELS[sample.session] || sample.session}</td>
              <td>{sample.dishes.map((dish) => dish.name).join(', ')}</td>
              <td>{formatDateTime(sample.sampledAt)}</td>
              <td>{sample.disposalStatus === 'APPROVED' ? formatDateTime(sample.disposedAt) : ''}</td>
              <td>{sample.note}</td>
              <td />
              <td />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
