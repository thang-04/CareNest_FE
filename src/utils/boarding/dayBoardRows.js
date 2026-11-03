import { MEAL_SESSION_LABELS } from '@/models/mealSessions';

/*
 * "Bán trú hôm nay": đổi dữ liệu GET /nutrition/day-board của một điểm trường thành 5 dòng việc (tên · trạng thái · chi tiết ·
 * nút tới việc). Chỉ ánh xạ mã trạng thái BE sang chữ và tông màu, không tính lại số liệu hay trạng thái.
 */
const UNKNOWN = ['gray', 'Chưa có thông tin'];

const PLAN_STATUS = { NONE: ['gray', 'Chưa lập'], DRAFT: ['orange', 'Bản nháp'], PUBLISHED: ['green', 'Đã công bố'] };
const MEAL_COUNT_STATUS = {
  NONE: ['gray', 'Chưa tổng hợp'],
  PENDING_CONFIRMATION: ['purple', 'Chờ xác nhận'],
  NEEDS_RECONFIRMATION: ['red', 'Cần xác nhận lại'],
  CONFIRMED: ['green', 'Đã xác nhận'],
};
const NOT_AVAILABLE = ['gray', 'Chưa triển khai'];

const withQuery = (path, query) => {
  const search = new URLSearchParams(Object.entries(query).filter(([, v]) => v != null && v !== '')).toString();
  return search ? `${path}?${search}` : path;
};

const menuRow = (campus) => {
  const menu = campus.menu || {};
  const thisWeek = PLAN_STATUS[menu.status] || UNKNOWN;
  const nextWeek = PLAN_STATUS[menu.nextWeekStatus] || UNKNOWN;
  const [tone, status] = menu.dayOff ? ['gray', 'Ngày nghỉ'] : thisWeek;
  return {
    key: 'menu',
    title: 'Thực đơn tuần',
    tone,
    status,
    detail: `Tuần này: ${thisWeek[1]} · Tuần sau: ${nextWeek[1]}`,
    actions: [
      { label: 'Kế hoạch tuần', to: withQuery('/menu/weekly', { week: menu.weekStart }) },
      ...(menu.nextWeekStart ? [{ label: 'Tuần sau', to: withQuery('/menu/weekly', { week: menu.nextWeekStart }) }] : []),
    ],
  };
};

const mealCountRow = (campus, date) => {
  const counts = campus.mealCounts || {};
  const [tone, status] = MEAL_COUNT_STATUS[counts.status] || UNKNOWN;
  const sessions = (counts.sessions || []).map((s) => `${MEAL_SESSION_LABELS[s.session] || s.session} ${s.servings}`);
  let detail = 'Chưa có số suất.';
  if (counts.totalServings > 0)
    detail = sessions.length ? `${counts.totalServings} suất · ${sessions.join(', ')}` : `${counts.totalServings} suất`;
  return {
    key: 'mealCount',
    title: 'Số suất',
    tone,
    status,
    detail,
    actions: [{ label: 'Sổ suất ăn', to: withQuery('/attendance/meal-count', { date }) }],
  };
};

const DRY_STOCK_STATUS = {
  DAY_OFF: ['gray', () => 'Ngày nghỉ', () => 'Hôm nay không trừ kho.'],
  NO_MENU: ['gray', () => 'Không có thực đơn', () => 'Chưa có thực đơn đã công bố cho ngày này nên chưa trừ kho.'],
  WAITING_COUNT: ['orange', () => 'Chờ suất', () => 'Chờ số suất ăn được xác nhận.'],
  NOT_SYNCED: [
    'red',
    (d) => `Chưa trừ ${d.foodCount ?? 0} thực phẩm`,
    () => 'Suất đã xác nhận nhưng kho chưa trừ đủ (lần trừ tự động bị lỗi). Bấm "Đồng bộ kho" để trừ lại.',
  ],
  NOTHING_TO_DEDUCT: ['gray', () => 'Không có hàng khô cần trừ', () => 'Thực đơn hôm nay không có thực phẩm khô.'],
  DEDUCTED: [
    'green',
    (d) => `Đã trừ ${d.foodCount ?? 0} thực phẩm`,
    (d) => (d.openShortfallCount > 0 ? `Còn ${d.openShortfallCount} phần thiếu chờ bổ sung.` : 'Kho đã trừ theo số suất.'),
  ],
  SHORTFALL: [
    'red',
    (d) => `Thiếu ${d.shortfallFoodCount ?? 0} thực phẩm`,
    (d) => `Còn ${d.openShortfallCount ?? d.shortfallFoodCount ?? 0} phần thiếu chờ bổ sung.`,
  ],
};

const dryStockRow = (campus) => {
  const stock = campus.dryStock || {};
  const [tone, statusOf, detailOf] = DRY_STOCK_STATUS[stock.status] || ['gray', () => UNKNOWN[1], () => ''];
  const shortfall = stock.status === 'SHORTFALL';
  const link = shortfall
    ? { label: 'Phần thiếu', to: withQuery('/kitchen/stock-shortfalls', { campusId: campus.campusId }) }
    : { label: 'Lịch sử nhập/trừ', to: withQuery('/kitchen/stock-history', { campusId: campus.campusId }) };
  return {
    key: 'dryStock',
    title: 'Kho khô',
    tone,
    status: statusOf(stock),
    detail: detailOf(stock),
    // NOT_SYNCED: nút gọi BE trừ lại (BE kiểm quyền), không phải link
    actions: stock.status === 'NOT_SYNCED' ? [{ key: 'syncStock', label: 'Đồng bộ kho', syncStock: true }, link] : [link],
  };
};

// Hàng tươi, lưu mẫu chưa nối BE: nút tới màn demo (màn đó tự có nhãn "Dữ liệu demo")
const pendingRow = (key, title, code, detail, action) => {
  const [tone, status] = code === 'NOT_AVAILABLE' ? NOT_AVAILABLE : UNKNOWN;
  return { key, title, tone, status, detail: code === 'NOT_AVAILABLE' ? detail : '', actions: [{ ...action, demo: true }] };
};

export const buildDayBoardRows = (campus, { date } = {}) => [
  menuRow(campus || {}),
  mealCountRow(campus || {}, date),
  dryStockRow(campus || {}),
  pendingRow(
    'freshReceipt',
    'Hàng tươi lần 1/2',
    campus?.freshReceiptStatus,
    'Kiểm nhận hàng tươi chưa nối hệ thống. Nút bên phải mở màn demo.',
    { label: 'Kiểm nhận (demo)', to: '/kitchen/fresh-receipts' },
  ),
  pendingRow('foodSample', 'Lưu mẫu chờ duyệt', campus?.foodSampleStatus, 'Lưu mẫu thức ăn chưa nối hệ thống. Nút bên phải mở màn demo.', {
    label: 'Lưu mẫu (demo)',
    to: '/kitchen/food-samples',
  }),
];
