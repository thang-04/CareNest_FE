/*
 * Chỗ ký bản in đánh giá (cuối chủ đề, học kỳ): họ tên lấy từ BE (signers: GV chủ nhiệm, tổ trưởng, PHT); hộp xem trước
 * cho sửa chức danh, họ tên, thêm người ký như tài liệu kế hoạch (Cần yêu cầu 10/11/2026). Chỉ đổi file in, không ghi hệ thống.
 */
const esc = (v = '') =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Người ký mặc định theo thứ tự: GV chủ nhiệm (ký trên), tổ trưởng chuyên môn, PHT (phần "Duyệt kế hoạch"). */
export const defaultSigners = (signers = {}) => [
  { title: 'Giáo viên chủ nhiệm', name: (signers.teachers || []).join(', ') },
  { title: 'Tổ trưởng chuyên môn', name: (signers.teamLeaders || []).join(', ') },
  { title: 'Phó hiệu trưởng', name: signers.vicePrincipal || '' },
];

/** Ô ký: chức danh, khoảng ký, họ tên (trống thì để dòng "Ký và ghi rõ họ tên" cho ký tay). */
export const signerCell = (s, { upper = false } = {}) => `<p><b>${esc(upper ? (s.title || '').toUpperCase() : s.title)}</b></p>
<div class="sign"></div>
<p>${s.name ? `<b>${esc(s.name)}</b>` : '(Ký và ghi rõ họ tên)'}</p>`;

/** Hàng "Duyệt kế hoạch": các người ký từ thứ 2 trở đi chia đều chiều rộng. */
export const approveRow = (list) => {
  if (!list.length) return '';
  const width = Math.floor(100 / list.length);
  return `<tr>${list.map((s) => `<td class="c" style="width:${width}%">${signerCell(s)}</td>`).join('')}</tr>`;
};
