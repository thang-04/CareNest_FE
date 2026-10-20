/*
 * Danh mục ô chọn / ô tích của đánh giá hằng ngày (3 nhóm theo Chương trình GDMN: sức khỏe; cảm xúc – thái độ – hành vi;
 * kiến thức, kỹ năng theo giáo án). Thêm / bớt mục ở đây: màn hình, kiểm tra hợp lệ và tổng hợp đều đọc từ file này.
 * Mã (key) lưu vào dữ liệu, không đổi mã đã dùng; chỉ đổi nhãn hoặc thêm mã mới. PROPOSED — BE cần cùng danh mục.
 */

/**
 * Nhóm 1 — Sức khỏe trong ngày: cô chọn Bình thường (healthSigns rỗng) hoặc biểu hiện theo danh mục HEALTH_SYMPTOMS của
 * khám sức khỏe. Điền sẵn từ lần khám sức khỏe mới nhất trong ngày; thân nhiệt từ các mức dưới đây trở lên điền thêm "Sốt".
 * Không hiển thị thân nhiệt ở màn Đánh giá (Cần chốt 15/10/2026).
 */
export const PREFILL_FEVER_LEVELS = ['FEVER', 'HIGH', 'VERY_HIGH'];

/** Ăn: theo từng bữa của nhóm tuổi (ageGroup.mealSessions), mặc định Ăn hết. */
export const EATING = { AN_HET: 'AN_HET', AN_IT: 'AN_IT', KHONG_AN: 'KHONG_AN' };
export const EATING_LABELS = { AN_HET: 'Ăn hết', AN_IT: 'Ăn ít', KHONG_AN: 'Không ăn' };

/** Ngủ trưa: một giá trị / ngày. Chưa có cấu hình nhóm tuổi không ngủ trưa nên luôn hiện. Mặc định Ngủ tốt. */
export const NAP = { NGU_TOT: 'NGU_TOT', NGU_IT: 'NGU_IT', KHONG_NGU: 'KHONG_NGU' };
export const NAP_LABELS = { NGU_TOT: 'Ngủ tốt', NGU_IT: 'Ngủ ít', KHONG_NGU: 'Không ngủ' };

/** Nhóm 2 — Cảm xúc dùng EMOTION / EMOTION_LABELS có sẵn; hành vi, thái độ: mặc định Bình thường, chỉ tích khi có. */
export const BEHAVIORS = {
  HOP_TAC_TOT: 'Hợp tác tốt',
  GIUP_DO_BAN: 'Giúp đỡ bạn',
  CHUA_HOP_TAC: 'Chưa hợp tác',
  TRANH_GIANH: 'Tranh giành / đánh bạn',
  KHONG_TAP_TRUNG: 'Không tập trung',
  RUT_RE: 'Rụt rè',
  KHAC: 'Khác',
};
/** Hành vi tích cực (tổng hợp tách riêng với hành vi cần lưu ý). */
export const POSITIVE_BEHAVIORS = ['HOP_TAC_TOT', 'GIUP_DO_BAN'];

/** Nhóm 3 — Kiến thức, kỹ năng: theo từng hoạt động trong giáo án ngày đã duyệt. */
export const PARTICIPATION = { TICH_CUC: 'TICH_CUC', BINH_THUONG: 'BINH_THUONG', CHUA_TICH_CUC: 'CHUA_TICH_CUC' };
export const PARTICIPATION_LABELS = { TICH_CUC: 'Tích cực', BINH_THUONG: 'Bình thường', CHUA_TICH_CUC: 'Chưa tích cực' };

/** Kết quả từng mục tiêu: không chọn = chưa đánh giá (không tính là chưa đạt). */
// Cần cố gắng: mức giữa Đạt và Chưa đạt (Cần chốt 21/10/2026, PROPOSED với BE)
export const YCCD_RESULT = { DAT: 'DAT', CAN_CO_GANG: 'CAN_CO_GANG', CHUA_DAT: 'CHUA_DAT' };
export const YCCD_RESULT_LABELS = { DAT: 'Đạt', CAN_CO_GANG: 'Cần cố gắng', CHUA_DAT: 'Chưa đạt' };
