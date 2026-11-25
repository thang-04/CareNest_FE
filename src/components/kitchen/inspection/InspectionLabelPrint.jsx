import { forwardRef } from 'react';
import { SampleLabelCards } from '@/components/kitchen/SampleLabelCards';
import { inspectionLabels, inspectionTitle } from '@/utils/kitchen/inspectionExport';

/*
 * Mẫu số 4: nhãn dán lên hộp mẫu thức ăn lưu, mỗi bữa một thẻ theo bản in PMS (nội dung ở `SampleLabelCards`). Lập từ dữ liệu M5
 * do bếp ghi; A4 dọc, hai thẻ một hàng (ít chữ nên không cần khổ ngang như các biểu mẫu nhiều cột).
 */
export const InspectionLabelPrint = forwardRef(function InspectionLabelPrint({ date, data }, ref) {
  const head = inspectionTitle('sample', date, 'label');
  return (
    <div className="print-sheet" ref={ref}>
      <div className="ps-title ps-title--form">
        <h1>{head.title}</h1>
        <div>{head.date}</div>
      </div>
      <SampleLabelCards labels={inspectionLabels(data)} date={date} />
    </div>
  );
});
