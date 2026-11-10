/** Breadcrumbs of the kitchen module: Trang chủ › Bếp & kho thực phẩm › <page> [› <sub page>]. */
export const kitchenCrumbs = (page, sub) => [
  { label: 'Trang chủ', to: '/' },
  { label: 'Bếp & kho thực phẩm', to: '/kitchen' },
  ...(sub ? [{ label: page.label, to: page.to }, { label: sub }] : [{ label: page.label || page }]),
];

export const KITCHEN_PAGES = {
  kitchenDay: { label: 'Quy trình bếp hôm nay', to: '/kitchen' },
  dryStock: { label: 'Kho khô', to: '/kitchen/dry-stock' },
  stockReceipts: { label: 'Phiếu nhập kho', to: '/kitchen/stock-receipts' },
  stockHistory: { label: 'Lịch sử nhập/trừ', to: '/kitchen/stock-history' },
  stockShortfalls: { label: 'Phần thiếu chờ bổ sung', to: '/kitchen/stock-shortfalls' },
  suppliers: { label: 'Nhà cung cấp', to: '/menu/suppliers' },
  publishedMenu: { label: 'Thực đơn đã công bố', to: '/kitchen/published-menu' },
  mealCount: { label: 'Sổ báo ăn đã xác nhận', to: '/kitchen/meal-count' },
  forecast: { label: 'Bản dự trù', to: '/kitchen/forecast' },
  dayMarket: { label: 'Đi chợ theo ngày', to: '/kitchen/market-day' },
  freshReceipts: { label: 'Kiểm nhận hàng tươi', to: '/kitchen/fresh-receipts' },
  foodSamples: { label: 'Sổ lưu mẫu thức ăn', to: '/kitchen/food-samples' },
};

/** Nhà cung cấp nằm ở nhóm Danh mục & thiết lập (/menu/suppliers). */
export const supplierCrumbs = (sub) => [
  { label: 'Trang chủ', to: '/' },
  { label: 'Danh mục & thiết lập' },
  ...(sub ? [{ label: 'Nhà cung cấp', to: '/menu/suppliers' }, { label: sub }] : [{ label: 'Nhà cung cấp' }]),
];
