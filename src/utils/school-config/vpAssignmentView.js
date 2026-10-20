import { FACILITY_ENABLED } from '@/config/app';
import {
  AREA_ACTION_LABELS,
  AREA_SCOPE_ALL,
  PERMISSION_ACCESS,
  VP_AREAS,
  parseAreaGrant,
  vpAreasOf,
} from '@/models/school-config/schoolConfigConstants';

/** Mảng hiện trên màn Phân công PHT; CSVC ẩn khi màn CSVC đang tắt (quyền đã lưu vẫn giữ). */
export const visibleVpAreas = VP_AREAS.filter((a) => FACILITY_ENABLED || a.key !== 'facility');

/** Quyền đã lưu -> { [mảng]: { campusId ('ALL' = toàn trường), actions } }; mảng không giao thì không có key. */
export const vpGrantsOf = (assignment) => {
  if (!assignment) return {};
  const saved = vpAreasOf(assignment);
  return Object.fromEntries(
    VP_AREAS.map((area) => [area.key, parseAreaGrant(saved[area.key], assignment.campusId)])
      .filter(([, g]) => g.access !== PERMISSION_ACCESS.NONE)
      .map(([key, g]) => [key, { campusId: g.campusId || AREA_SCOPE_ALL, actions: g.actions }]),
  );
};

/** Việc cụ thể của 1 mảng bằng lời thường (người dùng không quen Xem/Thêm/Sửa/Xóa); mảng linked gộp thành 1 việc. */
export const areaTasks = (area) =>
  area.linked
    ? [{ id: 'manage', keys: area.actions.filter((k) => k !== 'view'), label: area.manageHint }]
    : area.actions.filter((k) => k !== 'view').map((k) => ({ id: k, keys: [k], label: area.actionHints?.[k] || AREA_ACTION_LABELS[k] }));

export const taskOn = (task, actions) => task.keys.some((k) => actions?.[k]);

export const scopeText = (campusId, campusName) => (campusId === AREA_SCOPE_ALL ? 'Toàn trường' : campusName(campusId));
