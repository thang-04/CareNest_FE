/** Mã quyền BE (BE:src/main/java/com/carenest/utils/enums/Permission.java) FE dùng để ẩn/hiện menu, route, nút. Quyết định thật vẫn ở BE. */
export const PERMISSIONS = {
  CHILD_PROFILE_VIEW: 'CHILD_PROFILE_VIEW',
  // Hồ sơ trẻ của PHT: mỗi việc một mã, chỉ ở điểm trường phụ trách (CHD-01, AUTH-20)
  CHILD_ENROLL: 'CHILD_ENROLL',
  CHILD_PROFILE_EDIT: 'CHILD_PROFILE_EDIT',
  CHILD_PLACEMENT: 'CHILD_PLACEMENT',
  ACCOUNT_MANAGE: 'ACCOUNT_MANAGE',
  ACCOUNT_STATUS_MANAGE: 'ACCOUNT_STATUS_MANAGE',
  STAFF_ASSIGNMENT_MANAGE: 'STAFF_ASSIGNMENT_MANAGE',
  PARENT_ACCOUNT_MANAGE: 'PARENT_ACCOUNT_MANAGE',
  PERMISSION_MANAGE: 'PERMISSION_MANAGE',
  // Sửa danh mục bán trú (thực phẩm, món, nhà cung cấp); HT luôn có, PHT khi được cấp
  NUTRITION_MANAGE: 'NUTRITION_MANAGE',
  // Lập, sửa kế hoạch tuần và công bố; lập phiếu nhập kho khô (theo điểm trường)
  MENU_MANAGE: 'MENU_MANAGE',
  STOCK_MANAGE: 'STOCK_MANAGE',
};
