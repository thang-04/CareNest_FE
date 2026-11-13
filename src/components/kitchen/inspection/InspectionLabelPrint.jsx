import { forwardRef } from 'react';
import { inspectionLabels, inspectionTitle } from '@/utils/kitchen/inspectionExport';
import { formatDateTime } from '@/utils/format';

/*
 * Mẫu số 4: nhãn dán lên hộp mẫu thức ăn lưu, mỗi bữa một thẻ gồm bữa ăn, tên các mẫu thức ăn, thời gian lấy mẫu (có giờ thì in,
 * chưa có thì để trống cho người lấy mẫu ghi tay) và ba chữ ký tay. Lập từ dữ liệu M5 do bếp ghi; A4 ngang, hai thẻ một hàng.
 */
export const InspectionLabelPrint = forwardRef(function InspectionLabelPrint({ date, data }, ref) {
  const head = inspectionTitle('sample', date, 'label');
  const labels = inspectionLabels(data);
  return (
    <div className="print-sheet print-sheet--landscape" ref={ref}>
      <div className="ps-title ps-title--form">
        <h1>{head.title}</h1>
        <div>{head.date}</div>
      </div>
      <div className="ps-labels">
        {labels.map((label) => (
          <div key={label.session} className="ps-label">
            <div>
              <strong>Bữa ăn:</strong> {label.sessionLabel}
            </div>
            <div>
              <strong>Tên mẫu thức ăn:</strong> {label.dishes.join(', ')}
            </div>
            <div>
              <strong>Thời gian lấy mẫu:</strong> {label.takenAt ? formatDateTime(label.takenAt) : '…… giờ …… phút ngày …… tháng …… năm ……'}
            </div>
            <div className="ps-label__sign">
              {['Người lấy mẫu', 'Nhân viên y tế', 'Ban giám hiệu'].map((role) => (
                <div key={role}>
                  <div className="fw-600">{role}</div>
                  <div className="ps-sign__role">(họ tên và chữ ký)</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
