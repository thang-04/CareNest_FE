/** Breadcrumbs of the kitchen module: Trang chủ › Bếp & kho thực phẩm › <page> [› <sub page>]. */
export const kitchenCrumbs = (page, sub) => [
  { label: 'Trang chủ', to: '/' },
  { label: 'Bếp & kho thực phẩm', to: '/kitchen' },
  ...(sub ? [{ label: page.label, to: page.to }, { label: sub }] : [{ label: page.label || page }]),
];

export const KITCHEN_PAGES = {
  preparationUpdate: { label: 'Xử lý chế biến còn lại của dữ liệu cũ', to: '/kitchen/preparation/update' },
  kitchenDay: { label: 'Quy trình bếp hôm nay', to: '/kitchen' },
  dryStock: { label: 'Kho khô', to: '/kitchen/dry-stock' },
  stockReceipts: { label: 'Phiếu nhập kho', to: '/kitchen/stock-receipts' },
  suppliers: { label: 'Nhà cung cấp', to: '/kitchen/suppliers' },
  stockIssues: { label: 'Phiếu xuất kho', to: '/kitchen/stock-issues' },
  publishedMenu: { label: 'Thực đơn đã công bố', to: '/kitchen/published-menu' },
  mealCount: { label: 'Sổ báo ăn đã xác nhận', to: '/kitchen/meal-count' },
  forecast: { label: 'Dự trù & đi chợ', to: '/kitchen/forecast' },
  freshReceipts: { label: 'Kiểm nhận hàng tươi', to: '/kitchen/fresh-receipts' },
  foodSamples: { label: 'Sổ lưu mẫu thức ăn', to: '/kitchen/food-samples' },
};
