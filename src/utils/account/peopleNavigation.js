import { canViewChildren } from '@/utils/children/childrenPermissions';
import { canViewStaff } from '@/utils/school-config/schoolConfigPermissions';
export const peopleTabsFor = (user) => [
  ...(canViewStaff(user) ? [{ key: 'staff', label: 'Nhân sự', to: '/school/staff' }] : []),
  ...(user?.role === 'VICE_PRINCIPAL' && canViewChildren(user) ? [{ key: 'parents', label: 'Phụ huynh', to: '/children/activation' }] : []),
  ...(canViewChildren(user) ? [{ key: 'children', label: 'Trẻ', to: '/children' }] : []),
];
