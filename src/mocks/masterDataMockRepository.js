import { readDb, writeDb, clone, delay, ApiError } from './mockDatabase';
import { lockedLocationMap } from './inventoryLock';
import { pushNotification } from './notificationMockRepository';
import { seedLocations } from './seed';
import { LOCATION_TYPE_LABELS, ROOM_STATUS, isRoomStaff, withCampusInfo } from '@/models/Location';
import { uid } from '@/utils/id';
import { canManageRooms, canViewRooms, isPrincipal } from '@/utils/school-config/schoolConfigPermissions';
import { firstError, hasErrors, validateRoom } from '@/utils/school-config/schoolConfigValidation';
import { withRoomManagers } from './roomManagers';

/*
 * Rooms (= locations) management – PROPOSED 10/10/2026, outside SRS (decision to record in the Decision Log):
 * - Principal creates / edits / deletes; a Vice Principal views the rooms of the assigned campus;
 * - a room that still holds assets, is used by a class of an open year, is in an open inventory round or has an unfinished
 *   transfer can be neither deactivated nor deleted: the campus VP first moves the assets out with a transfer;
 * - delete is a soft delete (status DELETED): hidden from the list and every picker, kept so history still shows its name.
 */

// Phòng demo cũ (tên theo lớp, chưa có mã P.xxx / sức chứa) chưa từng sửa: đồng bộ theo seed mới
const staleRooms = (db) =>
  (db.locations || []).filter(
    (l) => !l.history && seedLocations.some((x) => x.id === l.id && (x.room !== l.room || x.capacity !== l.capacity)),
  );
const syncDemoRooms = (db) => {
  staleRooms(db).forEach((l) => {
    const seed = seedLocations.find((x) => x.id === l.id);
    Object.assign(l, { name: seed.name, room: seed.room, ...(seed.capacity ? { capacity: seed.capacity } : {}) });
  });
  return db;
};
const readRooms = () => {
  if (staleRooms(readDb()).length) writeDb(syncDemoRooms);
  return readDb();
};

const forbid = () => new ApiError(403, 'Bạn không có quyền thực hiện thao tác này');
const notFound = () => new ApiError(404, 'Không tìm thấy phòng');
const invalid = (errors) => new ApiError(422, firstError(errors), errors);
const now = () => new Date().toISOString();

const LINK_FIELDS = ['locationId', 'fromLocationId', 'toLocationId'];
const OPEN_TRANSFER = (t) => !['COMPLETED', 'CANCELLED'].includes(t.status);

const refersTo = (record, id) =>
  LINK_FIELDS.some((f) => record?.[f] === id) ||
  (Array.isArray(record?.locationIds) && record.locationIds.includes(id)) ||
  (Array.isArray(record?.sheets) && record.sheets.some((s) => s.locationId === id));

/** Which collections reference the room: { classes: 2, assets: 5, ... }. */
const usageOf = (db, id) => {
  const usage = {};
  Object.entries(db).forEach(([key, list]) => {
    if (key === 'locations' || !Array.isArray(list)) return;
    const n = list.filter((r) => refersTo(r, id)).length;
    if (n) usage[key] = n;
  });
  return usage;
};

const openYearIds = (db) => new Set((db.schoolYears || []).filter((y) => y.status !== 'CLOSED').map((y) => y.id));

/** Largest class size among classes of open years in the room: the room capacity cannot go below it. */
const largestClassIn = (db, id) => {
  const open = openYearIds(db);
  return Math.max(
    0,
    ...(db.classes || []).filter((c) => c.locationId === id && (open.size === 0 || open.has(c.schoolYear))).map((c) => c.capacity),
  );
};

/** Asset lines still in the room (quantity > 0). */
const assetsIn = (db, id) => (db.assets || []).filter((a) => a.locationId === id && a.quantity > 0);

/** Reasons that forbid deactivating or deleting the room (it still holds assets or running work). */
const blockersOf = (db, id) => {
  const reasons = [];
  const assets = assetsIn(db, id);
  if (assets.length)
    reasons.push(`còn ${assets.length} loại tài sản (${assets.reduce((s, a) => s + a.quantity, 0)} cái/bộ), cần luân chuyển ra trước`);
  const open = openYearIds(db);
  const classes = (db.classes || []).filter((c) => c.locationId === id && (open.size === 0 || open.has(c.schoolYear)));
  if (classes.length) reasons.push(`đang là phòng của ${classes.map((c) => `${c.name} (${c.schoolYear})`).join(', ')}`);
  const lock = lockedLocationMap(db)[id];
  if (lock) reasons.push(`đang trong đợt kiểm kê ${lock}`);
  const transfers = (db.transfers || []).filter((t) => OPEN_TRANSFER(t) && (t.fromLocationId === id || t.toLocationId === id));
  if (transfers.length) reasons.push(`có ${transfers.length} phiếu luân chuyển chưa hoàn tất`);
  return reasons;
};

const findRoom = (db, id) => {
  const room = db.locations.find((l) => l.id === id);
  if (!room) throw notFound();
  return room;
};

const assertScope = (user, room) => {
  if (!isPrincipal(user) && room.campusId !== user.campusId) throw forbid();
};

export const masterDataMockRepository = {
  async getCampuses() {
    await delay(60);
    return clone(readDb().campuses);
  },
  async getLocations() {
    await delay(60);
    const db = readRooms();
    // PENDING BE: GET /locations trả kèm campusName / ambiguous để nhãn phòng không nhầm giữa hai campus
    return clone(withCampusInfo(withRoomManagers(db), db.campuses));
  },
  async getUsers() {
    await delay(60);
    return clone(readDb().users);
  },
  async getAssetCategories() {
    await delay(60);
    return clone(readDb().categories);
  },

  /** Rooms with usage for the Room List: classes of `schoolYear`, asset count, links. */
  async getRooms({ schoolYear } = {}, user) {
    await delay(120);
    if (!canViewRooms(user)) throw forbid();
    const db = readRooms();
    return withRoomManagers(db)
      .filter((l) => l.status !== ROOM_STATUS.DELETED && (isPrincipal(user) || l.campusId === user.campusId))
      .map((l) => {
        const assets = assetsIn(db, l.id);
        return {
          ...clone(l),
          status: l.status || ROOM_STATUS.ACTIVE,
          yearClasses: (db.classes || []).filter((c) => c.locationId === l.id && c.schoolYear === schoolYear).map((c) => c.name),
          assets: assets.map((a) => ({ id: a.id, code: a.code, name: a.name, unit: a.unit, quantity: a.quantity })),
          assetCount: assets.length,
          usage: usageOf(db, l.id),
          blockers: blockersOf(db, l.id),
          minCapacity: largestClassIn(db, l.id),
        };
      });
  },

  async saveRoom(id, form, user) {
    await delay();
    if (!canManageRooms(user)) throw forbid();
    return writeDb((db) => {
      const current = id ? findRoom(db, id) : null;
      if (current?.status === ROOM_STATUS.DELETED) throw notFound();
      const errors = validateRoom(
        form,
        db.locations.filter((l) => l.id !== id && l.status !== ROOM_STATUS.DELETED),
        { minCapacity: id ? largestClassIn(db, id) : 0 },
      );
      if (!db.campuses.some((c) => c.id === form.campusId)) errors.campusId = 'Điểm trường không tồn tại';
      if (current && current.campusId !== form.campusId && Object.keys(usageOf(db, id)).length)
        errors.campusId = 'Phòng đã có lớp, tài sản hoặc phiếu liên quan, không chuyển sang điểm trường khác được';
      if (
        form.type !== 'CLASS' &&
        form.managerUserId &&
        !isRoomStaff(
          db.users.find((u) => u.id === form.managerUserId),
          form.campusId,
        )
      )
        errors.managerUserId = 'Người phụ trách phải là nhân sự đang làm việc ở điểm trường này';
      if (current && current.type !== form.type && (db.classes || []).some((c) => c.locationId === id))
        errors.type = 'Phòng đang gắn với lớp, không đổi loại được';
      if (hasErrors(errors)) throw invalid(errors);
      const data = {
        campusId: form.campusId,
        room: form.room.trim(),
        name: form.name.trim(),
        type: form.type,
        // Phòng học: người phụ trách = giáo viên chủ nhiệm của lớp đang dùng phòng (không lưu)
        managerUserId: form.type === 'CLASS' ? null : form.managerUserId || null,
        capacity: form.type === 'CLASS' && form.capacity !== '' && form.capacity != null ? Number(form.capacity) : null,
        note: (form.note || '').trim(),
      };
      if (current) {
        const previous = `${current.room || '—'} · ${current.name} · ${LOCATION_TYPE_LABELS[current.type]}`;
        Object.assign(current, data);
        (current.history ||= []).push({ action: 'UPDATED', userId: user.id, at: now(), note: `Trước: ${previous}` });
        return clone(current);
      }
      const room = { id: uid('loc'), ...data, status: ROOM_STATUS.ACTIVE, history: [{ action: 'CREATED', userId: user.id, at: now() }] };
      db.locations.push(room);
      return clone(room);
    });
  },

  async setRoomStatus(id, status, user) {
    await delay();
    if (!canManageRooms(user)) throw forbid();
    return writeDb((db) => {
      const room = findRoom(db, id);
      assertScope(user, room);
      if (room.status === ROOM_STATUS.DELETED || status === ROOM_STATUS.DELETED) throw notFound();
      if (status === ROOM_STATUS.INACTIVE) {
        const blockers = blockersOf(db, id);
        if (blockers.length) throw new ApiError(409, `Không ngừng sử dụng được: phòng ${blockers.join('; ')}.`);
      }
      room.status = status;
      (room.history ||= []).push({ action: status === ROOM_STATUS.INACTIVE ? 'DEACTIVATED' : 'ACTIVATED', userId: user.id, at: now() });
      return clone(room);
    });
  },

  async deleteRoom(id, user) {
    await delay();
    if (!canManageRooms(user)) throw forbid();
    writeDb((db) => {
      const room = findRoom(db, id);
      if (room.status === ROOM_STATUS.DELETED) throw notFound();
      const blockers = blockersOf(db, id);
      if (blockers.length) throw new ApiError(409, `Không xóa được: phòng ${blockers.join('; ')}.`);
      // Xóa mềm: giữ bản ghi để phiếu luân chuyển, kiểm kê, lớp năm cũ vẫn hiện tên phòng
      room.status = ROOM_STATUS.DELETED;
      room.deletedAt = now();
      (room.history ||= []).push({ action: 'DELETED', userId: user.id, at: room.deletedAt });
    });
  },

  /** Principal asks the campus Vice Principal(s) to move the assets out (transfers belong to the VP, GBR-FAC-06). */
  async requestRoomClearance(id, user) {
    await delay();
    if (!canManageRooms(user)) throw forbid();
    return writeDb((db) => {
      const room = findRoom(db, id);
      const assets = assetsIn(db, id);
      if (!assets.length) throw new ApiError(409, 'Phòng không còn tài sản nào.');
      const vps = db.users.filter((u) => u.role === 'VICE_PRINCIPAL' && u.campusId === room.campusId);
      if (!vps.length) throw new ApiError(409, 'Điểm trường chưa có Phó hiệu trưởng phụ trách để nhận yêu cầu.');
      vps.forEach((vp) =>
        pushNotification(db, {
          userId: vp.id,
          type: 'FACILITY',
          title: `Chuyển tài sản ra khỏi ${room.room} · ${room.name}`,
          message: `Hiệu trưởng cần chuyển hết ${assets.length} loại tài sản ra khỏi phòng để ngừng sử dụng / xóa phòng.`,
          link: `/facility/transfers/new?from=${room.id}`,
        }),
      );
      return { notified: vps.map((u) => u.fullName) };
    });
  },
};
