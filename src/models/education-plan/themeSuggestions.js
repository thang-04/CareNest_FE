/*
 * Danh sách chủ đề gợi ý (tham khảo) cho tổ trưởng lập kế hoạch chủ đề.
 * Tổng hợp theo cách các trường mầm non thường tổ chức chủ đề trong năm học; không phải nội dung bắt buộc
 * và không chép từ tài liệu nào. Trường chỉnh sửa tự do; BE nên quản lý danh sách này khi có API.
 * month: tháng thường bắt đầu (9–12 thuộc năm đầu của năm học, 1–5 thuộc năm sau).
 */
const MAU_GIAO = [
  { name: 'Trường mầm non', month: 9, branches: ['Ngày hội đến trường của bé', 'Lớp học của bé', 'Cô giáo và các bạn'] },
  { name: 'Bản thân', month: 10, branches: ['Bé là ai', 'Cơ thể của bé', 'Bé cần gì để lớn lên khỏe mạnh', 'Cảm xúc của bé'] },
  { name: 'Gia đình', month: 11, branches: ['Gia đình của bé', 'Ngôi nhà bé ở', 'Đồ dùng trong gia đình', 'Ngày Nhà giáo Việt Nam'] },
  { name: 'Nghề nghiệp', month: 12, branches: ['Nghề quen thuộc quanh bé', 'Nghề sản xuất', 'Nghề dịch vụ', 'Chú bộ đội'] },
  {
    name: 'Thế giới động vật',
    month: 1,
    branches: ['Động vật nuôi trong gia đình', 'Động vật sống trong rừng', 'Động vật sống dưới nước', 'Côn trùng và chim'],
  },
  {
    name: 'Thế giới thực vật – Tết và mùa xuân',
    month: 2,
    branches: ['Cây xanh quanh bé', 'Rau, củ, quả', 'Tết Nguyên đán', 'Mùa xuân và các loài hoa'],
  },
  {
    name: 'Phương tiện và luật lệ giao thông',
    month: 3,
    branches: ['Phương tiện giao thông đường bộ', 'Phương tiện đường thủy, đường hàng không', 'Luật lệ giao thông'],
  },
  { name: 'Nước và hiện tượng tự nhiên', month: 4, branches: ['Nước quanh bé', 'Hiện tượng thời tiết', 'Các mùa trong năm'] },
  { name: 'Quê hương – Đất nước – Bác Hồ', month: 5, branches: ['Quê hương của bé', 'Thủ đô Hà Nội', 'Bác Hồ kính yêu'] },
];

const NHA_TRE = [
  { name: 'Bé vui đến trường', month: 9, branches: ['Lớp học của bé', 'Cô và các bạn', 'Đồ chơi của lớp'] },
  { name: 'Bé và gia đình', month: 10, branches: ['Bé là ai', 'Người thân của bé', 'Đồ dùng của bé'] },
  { name: 'Đồ dùng, đồ chơi của bé', month: 11, branches: ['Đồ dùng ăn uống', 'Đồ chơi bé thích', 'Đồ dùng để mặc'] },
  { name: 'Con vật bé yêu', month: 12, branches: ['Con vật nuôi trong nhà', 'Con vật sống dưới nước', 'Con vật sống trong rừng'] },
  { name: 'Tết và mùa xuân', month: 1, branches: ['Bé vui đón Tết', 'Mùa xuân của bé', 'Hoa mùa xuân'] },
  { name: 'Cây và những bông hoa đẹp', month: 2, branches: ['Cây xanh quanh bé', 'Rau, quả bé thích', 'Những bông hoa đẹp'] },
  { name: 'Phương tiện giao thông', month: 3, branches: ['Xe đạp, xe máy', 'Ô tô, tàu hỏa', 'Thuyền, máy bay'] },
  { name: 'Mùa hè của bé', month: 4, branches: ['Nước và mùa hè', 'Trang phục mùa hè', 'Bé đi chơi'] },
  { name: 'Bé lớn lên rồi', month: 5, branches: ['Bé đã lớn', 'Bé lên mẫu giáo'] },
];

const LON_THEM = [{ name: 'Trường tiểu học', month: 5, branches: ['Trường tiểu học của bé', 'Bé chuẩn bị vào lớp 1'] }];

/** Chủ đề gợi ý theo nhóm tuổi (ag-2 nhà trẻ; ag-5 thêm Trường tiểu học). */
export const themeSuggestionsFor = (ageGroupId) =>
  ageGroupId === 'ag-2' ? NHA_TRE : ageGroupId === 'ag-5' ? [...MAU_GIAO, ...LON_THEM] : MAU_GIAO;

/** 'yyyy-mm' của tháng gợi ý trong năm học ('2026 – 2027'). */
export const suggestionMonth = (schoolYear, month) => {
  const [y1, y2] = schoolYear.split(/\s*–\s*/).map(Number);
  return `${month >= 9 ? y1 : y2}-${String(month).padStart(2, '0')}`;
};
