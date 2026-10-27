import { canViewChildren, canViewParentAccounts } from '@/utils/children/childrenPermissions';
import { canViewStaff } from '@/utils/school-config/schoolConfigPermissions';
export const peopleTabsFor = (user) => [
  ...(canViewStaff(user) ? [{ key: 'staff', label: 'Nhân sự', to: '/school/staff' }] : []),
  // Hiệu trưởng và Phó hiệu trưởng quản lý tài khoản phụ huynh (user chốt 2026-10-23).
  ...(canViewParentAccounts(user) && canViewChildren(user) ? [{ key: 'parents', label: 'Phụ huynh', to: '/children/activation' }] : []),
  ...(canViewChildren(user) ? [{ key: 'children', label: 'Trẻ', to: '/children' }] : []),
];
