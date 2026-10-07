/**
 * Class, room, department, kitchen or storeroom inside one campus.
 * @typedef {Object} Location
 * @property {string} id
 * @property {string} campusId
 * @property {string} name
 * @property {string} room
 * @property {'CLASS'|'KITCHEN'|'FUNCTION_ROOM'|'DEPARTMENT'|'STORAGE'} type
 * @property {string|null} managerUserId
 */

export const LOCATION_TYPES = {
  CLASS: 'CLASS',
  KITCHEN: 'KITCHEN',
  FUNCTION_ROOM: 'FUNCTION_ROOM',
  DEPARTMENT: 'DEPARTMENT',
  STORAGE: 'STORAGE',
};

export const LOCATION_TYPE_LABELS = {
  CLASS: 'Lớp học',
  KITCHEN: 'Bếp',
  FUNCTION_ROOM: 'Phòng chức năng',
  DEPARTMENT: 'Phòng ban',
  STORAGE: 'Kho',
};

/** Label of the person suggested as responsible for a location type. */
export const MANAGER_LABELS = {
  CLASS: 'Giáo viên chủ nhiệm lớp',
  KITCHEN: 'Nhân viên bếp phụ trách',
  FUNCTION_ROOM: 'Người phụ trách phòng',
  DEPARTMENT: 'Người phụ trách phòng ban',
  STORAGE: 'Người phụ trách kho',
};

export const locationLabel = (loc) => (loc ? (loc.room ? `${loc.name} (${loc.room})` : loc.name) : '—');
