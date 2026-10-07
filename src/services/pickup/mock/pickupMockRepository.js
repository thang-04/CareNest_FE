import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { ensureSchoolSeeded } from '@/mocks/schoolMockRepository';
import { buildPickupSeed } from '@/mocks/pickupSeed';
import { PICKUP_OUTCOME, PICKUP_STATUS, outcomeOf } from '@/models/pickup/pickupConstants';
import { canHandOverChildren, canOpenPickup } from '@/utils/pickup/pickupPermissions';
import { validatePickupResult } from '@/utils/pickup/pickupValidation';
import { todayInput } from '@/utils/format';
import { uid } from '@/utils/id';

/*
 * Fake backend for child pickup (UC 3.15 / 3.16, GBR-CP-03).
 * Rules the backend must re-implement:
 *  - only the teacher of the class hands over its children, only today;
 *  - a handover is completed only after photo match or the parent's phone agreement;
 *    a failed verification is stored but never counted as a handover;
 *  - one completed handover per child per day; the parent is notified of every result.
 * Attendance (db.attendance, owned by the attendance module) decides who is at school today.
 */

const forbidden = () => new ApiError(403, 'Bạn không có quyền thực hiện thao tác này.');
const ABSENT = ['EXCUSED', 'UNEXCUSED'];

const ensureSeeded = (db) => {
  if (db.pickups) return db;
  // Wait for attendance demo data so pickup history only covers present children.
  if (!db.attendance) return db;
  db.pickups = clone(
    buildPickupSeed({ attendance: db.attendance, children: db.children, classes: db.classes, today: todayInput() }).pickups,
  );
  return db;
};

const ready = () => {
  ensureSchoolSeeded();
  const db = readDb();
  if (!db.pickups && db.attendance) writeDb(ensureSeeded);
  return readDb();
};

const findClass = (db, id) => {
  const cls = db.classes.find((c) => c.id === id);
  if (!cls) throw new ApiError(404, 'Không tìm thấy lớp');
  return cls;
};

const attendanceOf = (db, childId, date) => (db.attendance || []).find((r) => r.childId === childId && r.date === date) || null;
const recordsOf = (db, childId, date) =>
  (db.pickups || []).filter((p) => p.childId === childId && p.date === date).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));

const boardRow = (db, child, date) => {
  const att = attendanceOf(db, child.id, date);
  const attempts = recordsOf(db, child.id, date);
  const done = attempts.find((p) => p.outcome === PICKUP_OUTCOME.HANDED_OVER) || null;
  const status = done ? PICKUP_STATUS.PICKED_UP : att && ABSENT.includes(att.status) ? PICKUP_STATUS.ABSENT : PICKUP_STATUS.WAITING;
  return {
    child: { id: child.id, code: child.code, fullName: child.fullName, gender: child.gender },
    attendanceStatus: att?.status || null,
    status,
    pickup: clone(done),
    attempts: clone(attempts),
  };
};

const childInScope = (db, childId, user) => {
  const child = db.children.find((c) => c.id === childId && c.status === 'ACTIVE');
  if (!child) throw new ApiError(404, 'Không tìm thấy trẻ hoặc bạn không có quyền xem');
  const cls = findClass(db, child.classId);
  if (!canHandOverChildren(cls, user)) throw new ApiError(404, 'Không tìm thấy trẻ hoặc bạn không có quyền xem');
  return { child, cls };
};

export const pickupMockRepository = {
  /** #99 Pickup List: children of the class and their pickup status for a date. */
  async getPickupBoard({ classId, date }, user) {
    await delay(180);
    const db = ready();
    const cls = findClass(db, classId);
    if (!canHandOverChildren(cls, user)) throw forbidden();
    const day = date || todayInput();
    const rows = db.children
      .filter((c) => c.classId === classId && c.status === 'ACTIVE')
      .map((c) => boardRow(db, c, day))
      .sort((a, b) => a.child.fullName.localeCompare(b.child.fullName, 'vi'));
    return { classId, className: cls.name, date: day, today: todayInput(), rows };
  },

  /** #100 Pickup Verification context: registered guardians (photo, phone) and today's attempts. */
  async getPickupChild(childId, user) {
    await delay(150);
    const db = ready();
    const { child, cls } = childInScope(db, childId, user);
    const today = todayInput();
    return {
      ...boardRow(db, child, today),
      date: today,
      classId: cls.id,
      className: cls.name,
      guardians: (child.guardians || []).map((g, index) => ({
        index,
        fullName: g.fullName,
        relation: g.relation,
        phone: g.phone,
        photoUrl: g.photoUrl || null,
      })),
    };
  },

  /** #101 Pickup Result (UC 3.16): stores the outcome and notifies the parent. */
  async recordPickupResult(form, user) {
    await delay();
    return writeDb((db) => {
      ensureSeeded(db);
      db.pickups ||= [];
      const { child, cls } = childInScope(db, form.childId, user);
      const errors = validatePickupResult(form);
      if (Object.keys(errors).length) throw new ApiError(422, Object.values(errors)[0], errors);
      // Photo match is only possible against a registered guardian (GBR-CP-03).
      if (form.verification === 'PHOTO_MATCH' && !(child.guardians || []).some((g) => g.fullName === form.pickupPersonName.trim()))
        throw new ApiError(422, 'Người đón không có trong danh sách phụ huynh đã đăng ký ảnh. Hãy gọi điện xác nhận với phụ huynh.');
      const today = todayInput();
      const att = attendanceOf(db, child.id, today);
      if (att && ABSENT.includes(att.status)) throw new ApiError(409, 'Trẻ được điểm danh vắng hôm nay.');
      if (recordsOf(db, child.id, today).some((p) => p.outcome === PICKUP_OUTCOME.HANDED_OVER))
        throw new ApiError(409, 'Trẻ đã được trả cho người đón hôm nay.');

      const at = new Date().toISOString();
      const outcome = outcomeOf(form.verification);
      const record = {
        id: uid('pk'),
        date: today,
        childId: child.id,
        classId: cls.id,
        campusId: cls.campusId,
        outcome,
        verification: form.verification,
        pickupPersonName: form.pickupPersonName.trim(),
        pickupPersonRelation: form.pickupPersonRelation.trim(),
        pickupPersonPhone: String(form.pickupPersonPhone || '').replace(/\s/g, ''),
        handedOverAt: outcome === PICKUP_OUTCOME.HANDED_OVER ? new Date(`${today}T${form.handoverTime}:00+07:00`).toISOString() : null,
        phoneConfirmed: form.verification === 'PHONE_CONFIRMED',
        note: String(form.note || '').trim(),
        teacherId: user.id,
        recordedAt: at,
        // Parents use the mobile app (push notification); there is no parent account on the web demo.
        parentNotification: { channel: 'APP', at },
      };
      db.pickups.push(record);
      return clone(record);
    });
  },

  /** Results recorded today (or on `date`) in the classes of the teacher. */
  async getPickupResults({ date }, user) {
    await delay(150);
    if (!canOpenPickup(user)) throw forbidden();
    const db = ready();
    const day = date || todayInput();
    const classes = db.classes.filter((c) => canHandOverChildren(c, user));
    const ids = new Set(classes.map((c) => c.id));
    const names = Object.fromEntries(db.children.map((c) => [c.id, c.fullName]));
    const classNames = Object.fromEntries(classes.map((c) => [c.id, c.name]));
    return (db.pickups || [])
      .filter((p) => p.date === day && ids.has(p.classId))
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
      .map((p) => ({ ...clone(p), childName: names[p.childId], className: classNames[p.classId] }));
  },
};
