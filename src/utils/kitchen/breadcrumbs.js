/** Breadcrumbs of the kitchen module: Trang chủ › Bếp & kho thực phẩm › <page> [› <sub page>]. */
export const kitchenCrumbs = (page, sub) => [
  { label: 'Trang chủ', to: '/' },
  { label: 'Bếp & kho thực phẩm' },
  ...(sub ? [{ label: page.label, to: page.to }, { label: sub }] : [{ label: page.label || page }]),
];

export const KITCHEN_PAGES = {
  stockReceipts: { label: 'Nhập kho thực phẩm', to: '/kitchen/stock-receipts' },
  stockIssues: { label: 'Duyệt xuất kho', to: '/kitchen/stock-issues' },
  preparation: { label: 'Tình trạng chế biến', to: '/kitchen/preparation' },
  publishedMenu: { label: 'Thực đơn đã công bố', to: '/kitchen/published-menu' },
  mealCount: { label: 'Số suất ăn đã xác nhận', to: '/kitchen/meal-count' },
  requiredQuantity: { label: 'Định lượng thực phẩm', to: '/kitchen/required-quantity' },
  ingredientReceipts: { label: 'Nhận thực phẩm từ kho', to: '/kitchen/ingredient-receipts' },
  missingFood: { label: 'Báo thiếu thực phẩm', to: '/kitchen/missing-food' },
  preparationUpdate: { label: 'Cập nhật chế biến', to: '/kitchen/preparation/update' },
};
