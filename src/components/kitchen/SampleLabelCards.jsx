import { SAMPLE_DISH_SEPARATOR, sampleTakenText, withBlankLabels } from '@/utils/kitchen/inspectionExport';

const DOTS = '………………………………………………';

/*
 * Mẫu số 4 (QĐ 1246/QĐ-BYT, theo bản in PMS): tờ 4 nhãn gồm nhãn trống ghi tay và mỗi bữa một nhãn với bữa ăn, tên các mẫu thức ăn
 * nối bằng "; ", thời gian lấy mẫu (chưa có giờ thì để trống giờ, phút) và dòng ký của người lấy mẫu. Dùng chung cho màn Kiểm thực
 * và Sổ lưu mẫu. `labels`: [{ key, sessionLabel, dishes: [tên món], takenAt }] (xem `inspectionLabels`).
 */
export function SampleLabelCards({ labels, date }) {
  return (
    <div className="ps-labels">
      {withBlankLabels(labels).map((label) => (
        <div key={label.key} className="ps-label">
          <div>Bữa ăn: {label.sessionLabel} (sáng/trưa/tối).</div>
          <div>Tên mẫu thức ăn: {label.dishes.join(SAMPLE_DISH_SEPARATOR) || DOTS}</div>
          <div>Thời gian lấy: {sampleTakenText(label.takenAt, date)}</div>
          <div className="ps-label__sign">
            Người lấy mẫu <i>(họ tên và chữ ký)</i>: {DOTS}
          </div>
        </div>
      ))}
    </div>
  );
}
