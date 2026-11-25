import { sampleTakenText } from '@/utils/kitchen/inspectionExport';

/*
 * Mẫu số 4 (QĐ 1246/QĐ-BYT, theo bản in PMS): mỗi bữa một nhãn gồm bữa ăn, tên các mẫu thức ăn nối bằng "; ", thời gian lấy mẫu
 * (chưa có giờ thì để trống giờ, phút cho người lấy mẫu ghi tay) và một dòng ký của người lấy mẫu. Dùng chung cho màn Kiểm thực
 * và Sổ lưu mẫu. `labels`: [{ key, sessionLabel, dishes: [tên món], takenAt }] (xem `inspectionLabels`).
 */
export function SampleLabelCards({ labels, date }) {
  return (
    <div className="ps-labels">
      {labels.map((label) => (
        <div key={label.key} className="ps-label">
          <div>Bữa ăn: {label.sessionLabel}</div>
          <div>Tên mẫu thức ăn: {label.dishes.join('; ')}</div>
          <div>Thời gian lấy: {sampleTakenText(label.takenAt, date)}</div>
          <div className="ps-label__sign">
            Người lấy mẫu <i>(họ tên và chữ ký)</i>: ……………………
          </div>
        </div>
      ))}
    </div>
  );
}
