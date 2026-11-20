/** 4 mục cố định của giáo án ngày (spec 005 FR-001); row = dòng bảng tuần cấp tên hoạt động và MT. */
export const DAY_SECTIONS = [
  { key: 'hoc', row: 'hoc', label: '1. Hoạt động học' },
  { key: 'ngoai_troi', row: 'ngoai_troi', label: '2. Hoạt động ngoài trời' },
  { key: 'goc', row: 'goc', label: '3. Hoạt động góc' },
  { key: 'chieu', row: 'chieu', label: '4. Hoạt động chiều' },
];

/** Dòng gợi ý của Tiến hành ở mục Hoạt động học: không đánh chữ, xóa/đổi tên được (FR-004). */
export const HOC_SUGGESTED_ROWS = ['Ổn định tổ chức, gây hứng thú', 'Nội dung trọng tâm', 'Kết thúc'];
/** Dòng gợi ý của mục ngoài trời theo file "Chủ đề gia đình": ba phần của một buổi ngoài trời; xóa/đổi tên được. */
export const NGOAI_TROI_SUGGESTED_ROWS = ['Hoạt động có mục đích', 'Trò chơi vận động', 'Chơi theo ý thích'];

/** Phần II của giáo án ngày, nhận xét chung cả lớp (FR-008). */
export const DAY_REVIEW = [
  { key: 'health', label: '1. Tình trạng sức khỏe của trẻ' },
  { key: 'knowledge', label: '2. Kiến thức, kỹ năng, nhận thức của trẻ' },
  { key: 'attitude', label: '3. Thái độ, cảm xúc, hành vi của trẻ' },
];

export const PREP_TARGETS = [
  { key: 'teacher', label: '1. Đối với cô' },
  { key: 'child', label: '2. Đối với trẻ' },
  { key: 'parent', label: '3. Đối với phụ huynh' },
];

export function applyDayTemplate(template) {
  for (const [key, rows] of Object.entries({ DAY_SECTIONS, HOC_SUGGESTED_ROWS, NGOAI_TROI_SUGGESTED_ROWS, DAY_REVIEW, PREP_TARGETS })) {
    rows.splice(0, rows.length, ...template[key]);
  }
}
