/** Breadcrumbs of the menu-planning screens (menu group "Thực đơn"). */
export const menuCrumbs = (section, sectionTo, last) => [
  { label: 'Trang chủ', to: '/' },
  { label: 'Thực đơn' },
  ...(section ? [{ label: section, to: last ? sectionTo : undefined }] : []),
  ...(last ? [{ label: last }] : []),
];

export const foodCrumbs = (last) => menuCrumbs('Thực phẩm', '/menu/foods', last);
export const dishCrumbs = (last) => menuCrumbs('Món ăn', '/menu/dishes', last);
export const priceCrumbs = (last) => menuCrumbs('Giá suất ăn', '/menu/prices', last);
export const sampleMenuCrumbs = (last) => menuCrumbs('Thực đơn mẫu', '/menu/menus', last);
export const allergyMenuCrumbs = (last) => menuCrumbs('Thực đơn thay thế', '/menu/allergy-menus', last);
export const weeklyCrumbs = (last) => menuCrumbs('Thực đơn tuần', '/menu/weekly', last);
export const planCrumbs = (last) => menuCrumbs('Kế hoạch thực đơn', '/menu/plans', last);
