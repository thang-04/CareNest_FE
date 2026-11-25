import { ROLES } from '@/models/User';

// Quyền vẫn do route và BE quyết định; danh sách này chỉ để ẩn tab người dùng không dùng được.
export const SETTINGS_TABS = [
  { key: 'templates', label: 'Mẫu thông báo', roles: [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL] },
  { key: 'rules', label: 'Quy tắc thông báo', roles: [ROLES.PRINCIPAL] },
  { key: 'schedules', label: 'Lịch gửi thông báo', roles: [ROLES.PRINCIPAL] },
];

export const settingsTabsFor = (role) => SETTINGS_TABS.filter((tab) => tab.roles.includes(role));

/** Tab đang mở: theo `?tab=` nếu vai trò được xem, ngược lại tab đầu tiên của vai trò. */
export const activeSettingsTab = (role, requested) => {
  const tabs = settingsTabsFor(role);
  return tabs.find((tab) => tab.key === requested) || tabs[0] || null;
};
