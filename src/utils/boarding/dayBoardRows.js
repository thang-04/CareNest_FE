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

const FRESH_STATUS = {
  NO_FORECAST: ['gray', 'Chưa có bản dự trù', 'Chưa có bản dự trù hàng tươi cho ngày này nên chưa kiểm nhận lần 1.'],
  ROUND1_PENDING: ['orange', 'Chờ kiểm lần 1', 'Kiểm nhận hàng tươi lần 1 so với bản dự trù.'],
  ROUND1_DONE: ['blue', 'Đã kiểm lần 1', 'Chờ số suất ăn được xác nhận để kiểm nhận lần 2.'],
  ROUND2_PENDING: ['orange', 'Chờ kiểm lần 2', 'Kiểm nhận hàng tươi lần 2 so với suất đã xác nhận.'],
  DONE: ['green', 'Đã kiểm đủ 2 lần', 'Hàng tươi hôm nay đã kiểm nhận cả hai lần.'],
  DAY_OFF: ['gray', 'Ngày nghỉ', 'Hôm nay không nhận hàng tươi.'],
};

const freshReceiptRow = (campus, date) => {
  const [tone, status, detail] = FRESH_STATUS[campus.freshReceiptStatus] || [...UNKNOWN, ''];
  const noForecast = campus.freshReceiptStatus === 'NO_FORECAST';
  return {
    key: 'freshReceipt',
    title: 'Hàng tươi lần 1/2',
    tone,
    status,
    detail,
    actions: [
      noForecast
        ? { label: 'Lập bản dự trù', to: withQuery('/kitchen/forecast', { campusId: campus.campusId }) }
        : { label: 'Kiểm nhận', to: withQuery('/kitchen/fresh-receipts', { campusId: campus.campusId, date }) },
    ],
  };
};

const FOOD_SAMPLE_STATUS = {
  UP_TO_DATE: ['green', 'Đã duyệt hết', 'Không còn bản lưu mẫu hay hủy mẫu chờ duyệt.'],
  NONE: ['gray', 'Chưa có bản lưu mẫu', 'Bếp chưa ghi lưu mẫu nào cho ngày này.'],
};

const foodSampleRow = (campus, date) => {
  const pending = campus.foodSampleStatus === 'PENDING_APPROVAL';
  const [tone, status, detail] = pending
    ? ['purple', `${campus.foodSamplePendingCount ?? 0} chờ duyệt`, 'Bản lưu mẫu hoặc hủy mẫu của điểm trường đang chờ duyệt (mọi ngày).']
    : FOOD_SAMPLE_STATUS[campus.foodSampleStatus] || [...UNKNOWN, ''];
  return {
    key: 'foodSample',
    title: 'Lưu mẫu chờ duyệt',
    tone,
    status,
    detail,
    actions: [
      {
        label: pending ? 'Duyệt lưu mẫu' : 'Sổ lưu mẫu',
        to: withQuery('/kitchen/food-samples', {
          campusId: campus.campusId,
          ...(pending ? { status: 'pending' } : { to: date, from: date }),
        }),
      },
    ],
  };
};

export const buildDayBoardRows = (campus, { date } = {}) => [
  menuRow(campus || {}),
  mealCountRow(campus || {}, date),
  dryStockRow(campus || {}),
  freshReceiptRow(campus || {}, date),
  foodSampleRow(campus || {}, date),
];

// Nhóm hiển thị của tông trạng thái cho dải số liệu đầu trang (chỉ đếm số việc theo tông BE đã trả, không đánh giá lại)
const TONE_BUCKET = { red: 'attention', orange: 'waiting', purple: 'waiting', blue: 'waiting', green: 'done', gray: 'idle' };

/** Đếm số việc của mọi điểm trường theo nhóm: cần xử lý · đang chờ · hoàn tất · chưa có thông tin hoặc ngày nghỉ. */
export const summarizeBoardRows = (rowsPerCampus) => {
  const total = { attention: 0, waiting: 0, done: 0, idle: 0 };
  rowsPerCampus.flat().forEach((row) => {
    total[TONE_BUCKET[row.tone] || 'idle'] += 1;
  });
  return total;
};
