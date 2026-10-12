/**
 * Class, room, department, kitchen or storeroom inside one campus.
 * @typedef {Object} Location
 * @property {string} id
 * @property {string} campusId
 * @property {string} name
 * @property {string} room            room code / number, unique within the campus (e.g. P.101)
 * @property {'CLASS'|'KITCHEN'|'FUNCTION_ROOM'|'DEPARTMENT'|'STORAGE'} type
 * @property {string|null} managerUserId
 * @property {number|null} [capacity]  children, classrooms only
 * @property {'ACTIVE'|'INACTIVE'|'DELETED'} [status]  missing = ACTIVE
 * @property {string} [note]
 * @property {{ action: string, userId: string, at: string, note?: string }[]} [history]
 */

export const LOCATION_TYPES = {
  CLASS: 'CLASS',
  KITCHEN: 'KITCHEN',
  FUNCTION_ROOM: 'FUNCTION_ROOM',
  DEPARTMENT: 'DEPARTMENT',
  STORAGE: 'STORAGE',
};

/** DELETED = soft delete (PROPOSED): hidden everywhere, kept so old records still show the room name. */
export const ROOM_STATUS = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE', DELETED: 'DELETED' };
export const ROOM_STATUS_LABELS = { ACTIVE: 'Đang sử dụng', INACTIVE: 'Ngừng sử dụng', DELETED: 'Đã xóa' };
/** Deactivated rooms stay in history but are hidden from pickers. */
export const isActiveLocation = (loc) => !!loc && (!loc.status || loc.status === ROOM_STATUS.ACTIVE);

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

/** Name + code only ("Phòng học 101 (P.101)"), for places that already show the campus next to it. */
export const locationBaseLabel = (loc) => (loc ? (loc.room ? `${loc.name} (${loc.room})` : loc.name) : '—');

/**
 * Display label of a room. Same code / name may exist in two campuses (P.101 Campus 1 and P.101 Campus 2):
 * such rooms carry `ambiguous` + `campusName` (see withCampusInfo) and the campus is appended. Rooms are always keyed by id.
 */
export const locationLabel = (loc) =>
  loc ? `${locationBaseLabel(loc)}${loc.ambiguous && loc.campusName ? ` · ${loc.campusName}` : ''}` : '—';

/** With the campus, for lists that mix campuses. */
export const locationLabelIn = (loc, campusName) => (campusName ? `${locationBaseLabel(loc)} · ${campusName}` : locationLabel(loc));

/** Staff who may be in charge of a room of `campusId`: active, working at that campus (the Principal always). */
export const isRoomStaff = (u, campusId) =>
  !!u && u.role !== 'PARENT' && (u.status || 'ACTIVE') === 'ACTIVE' && (u.role === 'PRINCIPAL' || u.campusId === campusId);

const norm = (v) =>
  String(v || '')
    .trim()
    .toLowerCase();
/** Adds campusName and `ambiguous` (another campus has a room with the same code or name). */
export const withCampusInfo = (locations = [], campuses = []) =>
  locations.map((l) => ({
    ...l,
    campusName: campuses.find((c) => c.id === l.campusId)?.shortName || '',
    ambiguous: locations.some(
      (o) => o.id !== l.id && o.campusId !== l.campusId && ((l.room && norm(o.room) === norm(l.room)) || norm(o.name) === norm(l.name)),
    ),
  }));
