import { PERMISSIONS, STAFF_MANAGEMENT_PERMISSIONS } from '@/models/account/permissionConstants';

const STAFF_PERMISSIONS = [...STAFF_MANAGEMENT_PERMISSIONS, PERMISSIONS.PERMISSION_MANAGE];

export const peopleTabsFor = (user) => {
  const roles = user?.roles || [user?.role];
  if (!roles.some((role) => role === 'PRINCIPAL' || role === 'VICE_PRINCIPAL')) return [];
  const permissions = user?.permissions || [];
  const tabs = [];
  if (STAFF_PERMISSIONS.some((code) => permissions.includes(code))) tabs.push({ key: 'staff', label: 'Nhân sự', to: '/school/staff' });
  if (permissions.includes(PERMISSIONS.PARENT_ACCOUNT_MANAGE))
    tabs.push({ key: 'parents', label: 'Phụ huynh', to: '/children/activation' });
  tabs.push({ key: 'children', label: 'Trẻ', to: '/children' });
  return tabs;
};

export const peopleLandingPath = (user) => peopleTabsFor(user)[0]?.to || '/children';
