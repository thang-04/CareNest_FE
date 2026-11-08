import { hasBePermission } from '@/utils/bePermissions';

/*
 * Trang có việc sửa theo mã quyền BE: PHT chưa được giao mã nào của trang thì báo "đang chỉ xem" ngay đầu trang,
 * thay vì để bấm rồi mới bị 403 (AUTH-07, AUTH-20). Trang chỉ đọc (lịch sử, thống kê) không cần báo.
 */
const READ_ONLY_PAGES = [
  [/^\/children$/, ['CHILD_ENROLL', 'CHILD_PROFILE_EDIT', 'CHILD_PLACEMENT', 'PARENT_ACCOUNT_MANAGE']],
  [/^\/menu\/(foods|dishes|setup|suppliers)(\/|$)/, ['NUTRITION_MANAGE']],
  [/^\/menu\/(weekly|templates)(\/|$)/, ['MENU_MANAGE']],
  [/^\/kitchen\/(dry-stock|stock-receipts|forecast|fresh-receipts)(\/|$)/, ['STOCK_MANAGE']],
  [/^\/kitchen\/food-samples(\/|$)/, ['FOOD_SAFETY_APPROVE']],
];

/** PHT đăng nhập BE đang ở trang mà mình không có mã sửa nào. Bản demo (không có mã BE) không báo. */
export const isVpReadOnlyPage = (user, path) => {
  if (user?.role !== 'VICE_PRINCIPAL' || !Array.isArray(user.bePermissions)) return false;
  const hit = READ_ONLY_PAGES.find(([pattern]) => pattern.test(path));
  return !!hit && !hasBePermission(user, ...hit[1]);
};
