import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { healthNotificationRecipients } from '@/services/account/mock/guardianCompatibility';
import { canRecordAttendance, canViewAttendance } from '@/utils/attendance/attendancePermissions';
import { isSchoolDay, schoolNow } from '@/utils/attendance/attendanceTime';
import { ROLES } from '@/models/User';
import { formatDate, isIsoDate } from '@/utils/format';
import { HEALTH_ACTIONS, HEALTH_SYMPTOMS, actionSummary, validateDailyHealth } from '@/utils/dailyHealthValidation';
import { PICKUP_OUTCOME } from '@/models/pickup/pickupConstants';
import { uid } from '@/utils/id';
import { dailyHealthSummary } from '@/mocks/dailyHealthSummary';
import { attendanceMockRepository } from '@/services/attendance/mock/attendanceMockRepository';

const context = (db, { classId, childId, date }, user) => {
  const cls = db.classes?.find((item) => item.id === classId);
  if (!cls) throw new ApiError(404, 'Không tìm thấy lớp.');
  if (!canRecordAttendance(cls, user)) throw new ApiError(403, 'Bạn không được phân công ghi nhận sức khỏe của lớp này.');
  const child = db.children?.find((item) => item.id === childId && item.classId === classId && item.status === 'ACTIVE');
  if (!child) throw new ApiError(404, 'Trẻ không thuộc danh sách lớp hiện tại.');
  const attendance = db.attendance?.find((item) => item.childId === childId && item.classId === classId && item.date === date);
  return { child, attendance, canRecord: date === schoolNow().date && attendance?.status === 'PRESENT' };
};

const LEADER_ROLES = [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL];
const byNewest = (a, b) => b.recordedAt.localeCompare(a.recordedAt);
/** SĐT bố, mẹ từ hồ sơ nhập học (luôn đủ 2 dòng, thiếu thì để trống) + người giám hộ khác; không trả email/trạng thái tài khoản. */
const parentContacts = (child) => {
  const list = (child.guardians || []).map(({ fullName, relation, phone }) => ({ fullName, relation, phone: phone || '' }));
  const parents = ['Bố', 'Mẹ'].map((relation) => list.find((g) => g.relation === relation) || { fullName: '', relation, phone: '' });
  return [...parents, ...list.filter((g) => !['Bố', 'Mẹ'].includes(g.relation))];
};
/**
 * Báo phụ huynh đón về sớm: giờ đón không nhập trước mà lấy từ lần cô trả trẻ ở màn Đón trẻ (cùng ngày), để truy vết đúng.
 * Gắn khi đọc, không ghi ngược vào lần ghi nhận sức khỏe.
 */
export const withEarlyPickup = (db, entry) => {
  if (!(entry.actions || []).includes('EARLY_PICKUP')) return { ...entry, earlyPickup: null };
  const p = (db.pickups || []).find(
    (x) =>
      x.childId === entry.childId &&
      x.date === entry.date &&
      x.outcome === PICKUP_OUTCOME.HANDED_OVER &&
      x.handedOverAt >= entry.recordedAt,
  );
  const time = p ? new Date(new Date(p.handedOverAt).getTime() + 7 * 3600000).toISOString().slice(11, 16) : null;
  return { ...entry, earlyPickup: p ? { fullName: p.pickupPersonName, relation: p.pickupPersonRelation, time, pickupId: p.id } : null };
};

const notificationsOf = (db, entryId) => (db.parentHealthNotifications || []).filter((item) => item.healthEntryId === entryId);

// Chỉ đếm lớp của năm học đang hoạt động; thiếu dữ liệu năm học thì lấy mọi lớp chưa đóng.
const activeYearClasses = (db) => {
  const year = db.schoolYears?.find((item) => item.status === 'ACTIVE');
  return (db.classes || []).filter((cls) => cls.status !== 'CLOSED' && (!year || cls.schoolYear === year.id));
};

// Hiệu trưởng xem toàn trường hoặc một điểm trường; Phó hiệu trưởng luôn bị giới hạn ở điểm trường của mình.
const overviewCampus = (user, campusId) => {
  if (user?.role === ROLES.PRINCIPAL) return campusId || null;
  if (user?.role === ROLES.VICE_PRINCIPAL) {
    if (campusId && campusId !== user.campusId)
      throw new ApiError(403, 'Bạn chỉ xem được sức khỏe đầu ngày của điểm trường mình phụ trách.');
    return user.campusId;
  }
  throw new ApiError(403, 'Bạn không có quyền xem tổng hợp sức khỏe đầu ngày.');
};

const SEED_DAYS = 6;
const SEED_CLASSES_PER_CAMPUS = 2;
const SEED_NOTES = [
  'Trẻ hắt hơi vài lần khi vào lớp, cô tiếp tục theo dõi.',
  'Trẻ ít nói hơn mọi ngày, cô cho trẻ nghỉ ở góc yên tĩnh.',
  'Phụ huynh dặn tối qua trẻ ngủ muộn.',
  'Trẻ ho nhẹ khi chơi ngoài sân, cô cho uống nước ấm.',
];
const SEED_SYMPTOMS = [['RUNNY_NOSE'], ['TIRED'], [], ['COUGH', 'RUNNY_NOSE']];
const SEED_TEMPERATURES_NOTED = [37.8, null, 37.6, 38.2];
const SEED_TEMPERATURES = [36.5, 36.7, null, 36.8, 36.6, 36.9];

const seedTime = (date, minutes) => {
  const pad = (n) => String(n).padStart(2, '0');
  return new Date(`${date}T${pad(7 + Math.floor(minutes / 60))}:${pad(minutes % 60)}:00+07:00`).toISOString();
};

/** Dữ liệu demo hư cấu: khoảng 70% trẻ có mặt của vài lớp mỗi điểm trường được ghi nhận, vài trẻ có dấu hiệu cần lưu ý. */
const seedDemoHealth = (db) => {
  db.dailyHealthEntries ||= [];
  db.parentHealthNotifications ||= [];
  const today = schoolNow().date;
  const classes = activeYearClasses(db);
  const campusIds = [...new Set(classes.map((cls) => cls.campusId))];
  const dates = [...new Set((db.attendance || []).filter((item) => item.date <= today).map((item) => item.date))]
    .sort()
    .reverse()
    .slice(0, SEED_DAYS);
  let notedCount = 0;
  dates.forEach((date, dayIndex) => {
    const presentOf = (cls) =>
      (db.attendance || []).filter((item) => item.classId === cls.id && item.date === date && item.status === 'PRESENT');
    campusIds.forEach((campusId) => {
      classes
        .filter((cls) => cls.campusId === campusId && presentOf(cls).length)
        .slice(0, SEED_CLASSES_PER_CAMPUS)
        .forEach((cls, classIndex) => {
          const teacherId = cls.homeroomTeacherId || cls.teacherIds?.[0] || null;
          const teacherName = db.users?.find((item) => item.id === teacherId)?.fullName || 'Giáo viên lớp';
          const checked = presentOf(cls).filter((_, index) => (index * 7 + dayIndex * 3) % 10 < 7);
          checked.forEach((record, index) => {
            if (db.dailyHealthEntries.some((entry) => entry.childId === record.childId && entry.date === date)) return;
            const child = db.children?.find((item) => item.id === record.childId);
            if (!child) return;
            const minutes = 35 + index * 3;
            const base = {
              classId: cls.id,
              childId: child.id,
              date,
              temperature: SEED_TEMPERATURES[(index + dayIndex) % SEED_TEMPERATURES.length],
              observation: 'NO_CONCERN',
              symptoms: [],
              note: '',
              notificationStatus: 'NOT_REQUIRED',
              recordedBy: teacherId,
              recordedByName: teacherName,
            };
            const id = `dh_seed_${date}_${child.id}`;
            if ((index + dayIndex + classIndex) % 4 !== 1) {
              db.dailyHealthEntries.push({ ...base, id, requestId: id, recordedAt: seedTime(date, minutes) });
              return;
            }
            const k = notedCount++ % SEED_NOTES.length;
            // Mẫu đo nhiều lần trong ngày (4 lần): sáng bình thường, theo dõi thêm 2 lần, lần cuối có dấu hiệu.
            if (k === 0) {
              db.dailyHealthEntries.push({ ...base, id: `${id}_early`, requestId: `${id}_early`, recordedAt: seedTime(date, minutes) });
              [
                [40, 37.2, 'Trẻ hơi mệt, cô cho nghỉ và đo lại sau.'],
                [80, 37.5, 'Trẻ ăn sáng ít, cô tiếp tục theo dõi.'],
              ].forEach(([after, temperature, note], i) =>
                db.dailyHealthEntries.push({
                  ...base,
                  id: `${id}_recheck${i}`,
                  requestId: `${id}_recheck${i}`,
                  temperature,
                  observation: 'NOTED',
                  symptoms: ['TIRED'],
                  note,
                  notificationStatus: 'PENDING',
                  recordedAt: seedTime(date, minutes + after),
                }),
              );
            }
            const recipients =
              date === today && k % 2 === 0 ? [] : (child.guardians || []).filter((g) => g.accountStatus === 'ACTIVE' && g.email);
            const entry = {
              ...base,
              id,
              requestId: id,
              temperature: SEED_TEMPERATURES_NOTED[k],
              observation: 'NOTED',
              symptoms: SEED_SYMPTOMS[k],
              note: SEED_NOTES[k],
              notificationStatus: recipients.length ? 'DEMO_QUEUED' : 'PENDING',
              recordedAt: seedTime(date, minutes + (k === 0 ? 120 : 5)),
            };
            db.dailyHealthEntries.push(entry);
            recipients.forEach((guardian) =>
              db.parentHealthNotifications.push({
                id: `phn_seed_${id}_${guardian.email}`,
                healthEntryId: id,
                childId: child.id,
                recipientKey: guardian.email,
                recipientName: guardian.fullName,
                title: 'Thông tin sức khỏe của trẻ',
                pushMessage: 'Có cập nhật mới từ nhà trường. Vui lòng mở ứng dụng để xem.',
                message: `Nhà trường ghi nhận ${child.fullName} có dấu hiệu cần lưu ý ngày ${formatDate(date)}. Phụ huynh vui lòng liên hệ giáo viên để trao đổi thêm.`,
                createdAt: entry.recordedAt,
                status: 'DEMO_QUEUED',
                read: false,
              }),
            );
          });
        });
    });
  });
  db.dailyHealthDemoSeeded = true;
};

// Gieo dữ liệu demo một lần cho DB hiện có (kể cả DB lưu trước khi có màn tổng hợp).
// Điểm danh demo do repository điểm danh gieo khi được gọi lần đầu, nên gọi nó trước khi gieo sức khỏe.
const ensureDemoHealth = async () => {
  if (readDb().dailyHealthDemoSeeded) return;
  if (!readDb().attendance) await attendanceMockRepository.getDayInfo();
  if (!readDb().dailyHealthDemoSeeded) writeDb(seedDemoHealth);
};

export const dailyHealthMockRepository = {
  async getDailyHealth(query, user) {
    await delay(120);
    // Màn điểm danh mở khung sức khỏe trước màn tổng hợp: gieo demo tại đây để danh sách lớp có thẻ sức khỏe
    await ensureDemoHealth();
    const db = readDb();
    const { canRecord, child } = context(db, query, user);
    const entries = (db.dailyHealthEntries || [])
      .filter((entry) => entry.childId === query.childId && entry.classId === query.classId && entry.date === query.date)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    return {
      ...query,
      canRecord,
      healthSummary: dailyHealthSummary(entries),
      // Chỉ tên, quan hệ, SĐT phụ huynh từ hồ sơ nhập học (không trả email, trạng thái tài khoản)
      contacts: parentContacts(child),
      entries: clone(
        entries.map((entry) => ({
          ...withEarlyPickup(db, entry),
          parentNotifications: (db.parentHealthNotifications || []).filter((notification) => notification.healthEntryId === entry.id),
        })),
      ),
    };
  },

  async addDailyHealth(payload, user) {
    await delay();
    return writeDb((db) => {
      const { canRecord } = context(db, payload, user);
      if (!canRecord) throw new ApiError(409, 'Chỉ ghi nhận cho trẻ đã lưu Có mặt trong ngày hôm nay.');
      const errors = validateDailyHealth(payload);
      if (Object.keys(errors).length) throw new ApiError(422, 'Kiểm tra lại các trường được đánh dấu.', errors);
      if (!payload.requestId) throw new ApiError(422, 'Thiếu mã lần ghi nhận. Hãy thử lại.');
      db.dailyHealthEntries ||= [];
      const previous = db.dailyHealthEntries.find((entry) => entry.requestId === payload.requestId && entry.recordedBy === user.id);
      if (previous) return clone(previous);
      const raw = String(payload.temperature ?? '')
        .trim()
        .replace(',', '.');
      const at = new Date().toISOString();
      const noted = payload.observation === 'NOTED';
      const actions = noted ? Object.keys(HEALTH_ACTIONS).filter((a) => (payload.actions || []).includes(a)) : [];
      const entry = {
        id: uid('daily-health'),
        requestId: payload.requestId,
        classId: payload.classId,
        childId: payload.childId,
        date: payload.date,
        temperature: raw ? Number(raw) : null,
        observation: payload.observation,
        symptoms: payload.observation === 'NOTED' ? [...new Set(payload.symptoms || [])] : [],
        note: (payload.note || '').trim(),
        // Mọi lần cập nhật sức khỏe đều báo phụ huynh, kể cả "Không ghi nhận bất thường" (Cần chốt 16/10/2026)
        notificationStatus: 'PENDING',
        actions,
        referral: actions.includes('REFERRAL')
          ? { place: payload.referral.place.trim(), time: payload.referral.time, escort: (payload.referral.escort || '').trim() }
          : null,
        recordedBy: user.id,
        recordedByName: user.fullName,
        recordedAt: at,
      };
      db.dailyHealthEntries.push(entry);
      return clone(entry);
    });
  },
  async notifyDailyHealth(entryId, user) {
    await delay();
    return writeDb((db) => {
      const entry = db.dailyHealthEntries?.find((item) => item.id === entryId);
      if (!entry) throw new ApiError(404, 'Không tìm thấy lần ghi nhận sức khỏe.');
      const { child } = context(db, entry, user);
      // Giữ khóa email cũ; tài khoản mới không email dùng ID demo, không coi là push App thật.
      const recipients = healthNotificationRecipients(db, child);
      if (!recipients.length) throw new ApiError(409, 'Chưa có tài khoản phụ huynh demo đang hoạt động. Kiểm tra hồ sơ liên hệ của trẻ.');
      db.parentHealthNotifications ||= [];
      const message = [
        `${formatDate(entry.date)} lúc ${new Date(new Date(entry.recordedAt).getTime() + 7 * 3600000).toISOString().slice(11, 16)}: nhà trường ${
          entry.observation === 'NOTED'
            ? `ghi nhận ${child.fullName} có dấu hiệu cần lưu ý`
            : `cập nhật sức khỏe của ${child.fullName}: không ghi nhận bất thường`
        }.`,
        entry.temperature === null ? '' : `Thân nhiệt ghi nhận: ${entry.temperature.toLocaleString('vi-VN')} °C.`,
        entry.symptoms.length ? `Biểu hiện: ${entry.symptoms.map((symptom) => HEALTH_SYMPTOMS[symptom]).join(', ')}.` : '',
        entry.note,
        entry.actions?.length ? `Xử trí: ${entry.actions.map((a) => HEALTH_ACTIONS[a]).join(', ')}.` : '',
        entry.referral ? `Chuyển đến ${entry.referral.place} lúc ${entry.referral.time}.` : '',
        entry.observation !== 'NOTED'
          ? ''
          : entry.actions?.includes('EARLY_PICKUP')
            ? 'Phụ huynh vui lòng đến trường đón bé sớm.'
            : 'Phụ huynh vui lòng liên hệ giáo viên để trao đổi thêm.',
      ]
        .filter(Boolean)
        .join(' ');
      recipients.forEach((guardian) => {
        if (db.parentHealthNotifications.some((item) => item.healthEntryId === entry.id && item.recipientKey === guardian.recipientKey)) return;
        db.parentHealthNotifications.push({
          id: uid('parent-health'),
          healthEntryId: entry.id,
          childId: entry.childId,
          recipientKey: guardian.recipientKey,
          recipientName: guardian.fullName,
          title: 'Thông tin sức khỏe của trẻ',
          pushMessage: 'Có cập nhật mới từ nhà trường. Vui lòng mở ứng dụng để xem.',
          message,
          createdAt: new Date().toISOString(),
          status: 'DEMO_QUEUED',
          read: false,
        });
      });
      entry.notificationStatus = 'DEMO_QUEUED';
      return clone(db.parentHealthNotifications.filter((item) => item.healthEntryId === entry.id));
    });
  },

  /** Tổng hợp sức khỏe đầu ngày cho Ban giám hiệu, chỉ xem. */
  async getDailyHealthOverview({ date, campusId, ageGroupId, classId } = {}, user) {
    await delay(150);
    if (!LEADER_ROLES.includes(user?.role)) throw new ApiError(403, 'Bạn không có quyền xem tổng hợp sức khỏe đầu ngày.');
    if (!isIsoDate(date)) throw new ApiError(422, 'Chọn ngày hợp lệ theo dd/mm/yyyy.');
    const scopeCampus = overviewCampus(user, campusId);
    await ensureDemoHealth();
    const db = readDb();
    const scoped = activeYearClasses(db)
      .filter((cls) => (!scopeCampus || cls.campusId === scopeCampus) && canViewAttendance(cls, user))
      .sort((a, b) => a.campusId.localeCompare(b.campusId) || a.name.localeCompare(b.name, 'vi'));
    // Lựa chọn bộ lọc chỉ gồm nhóm tuổi / lớp trong phạm vi người xem; bộ lọc áp cho bảng lớp, số tổng và trẻ cần chú ý
    const options = {
      ageGroups: (db.ageGroups || []).filter((g) => scoped.some((cls) => cls.ageGroupId === g.id)).map((g) => ({ id: g.id, name: g.name })),
      classes: scoped.map((cls) => ({ id: cls.id, name: cls.name, ageGroupId: cls.ageGroupId, campusId: cls.campusId })),
    };
    const classes = scoped.filter((cls) => (!ageGroupId || cls.ageGroupId === ageGroupId) && (!classId || cls.id === classId));
    const dayEntries = (db.dailyHealthEntries || []).filter((entry) => entry.date === date).sort(byNewest);
    const totals = { present: 0, checked: 0, noted: 0, notified: 0 };
    const attention = [];
    const rows = classes.map((cls) => {
      const size = (db.children || []).filter((child) => child.classId === cls.id && child.status === 'ACTIVE').length;
      const presentIds = new Set(
        (db.attendance || [])
          .filter((item) => item.classId === cls.id && item.date === date && item.status === 'PRESENT')
          .map((item) => item.childId),
      );
      const latestByChild = new Map();
      dayEntries.forEach((entry) => {
        if (entry.classId === cls.id && !latestByChild.has(entry.childId)) latestByChild.set(entry.childId, entry);
      });
      const checked = [...presentIds].filter((childId) => latestByChild.has(childId)).length;
      let noted = 0;
      // Trẻ cần chú ý = lần ghi nhận mới nhất trong ngày là "Có dấu hiệu cần lưu ý"; không tự đánh giá theo thân nhiệt.
      latestByChild.forEach((entry, childId) => {
        if (entry.observation !== 'NOTED') return;
        noted += 1;
        if (entry.notificationStatus === 'DEMO_QUEUED') totals.notified += 1;
        const child = db.children?.find((item) => item.id === childId);
        // Các lần đo trong ngày theo thứ tự thời gian, để hiện "n lần (36,7 → 37,8)"
        const readings = dayEntries
          .filter((item) => item.classId === cls.id && item.childId === childId)
          .reverse()
          .map((item) => withEarlyPickup(db, item));
        attention.push({
          childId,
          childName: child?.fullName || 'Trẻ',
          childCode: child?.code || '',
          photoUrl: child?.photoUrl || null,
          classId: cls.id,
          className: cls.name,
          campusId: cls.campusId,
          temperature: entry.temperature,
          observation: entry.observation,
          symptoms: entry.symptoms || [],
          note: entry.note,
          recordedByName: entry.recordedByName,
          recordedAt: entry.recordedAt,
          notificationStatus: entry.notificationStatus,
          notifiedAt: notificationsOf(db, entry.id)[0]?.createdAt || null,
          readingCount: readings.length,
          temperatureTrail: readings.map((item) => item.temperature),
          // Xử trí trong ngày theo thứ tự thời gian, vd. "Phòng y tế · Gọi PH · Về sớm 10:15"
          actionsText: actionSummary(readings),
        });
      });
      totals.present += presentIds.size;
      totals.checked += checked;
      totals.noted += noted;
      return { classId: cls.id, className: cls.name, campusId: cls.campusId, size, present: presentIds.size, checked, noted };
    });
    return clone({
      date,
      campusId: scopeCampus,
      schoolDay: isSchoolDay(date),
      options,
      totals,
      classes: rows,
      attention: attention.sort(byNewest),
    });
  },

  /** Các lần ghi nhận trong ngày của một trẻ (mới nhất trước), chỉ xem, cho Ban giám hiệu trong phạm vi. */
  async getChildDailyHealthHistory({ childId, date } = {}, user) {
    await delay(120);
    if (!LEADER_ROLES.includes(user?.role)) throw new ApiError(403, 'Bạn không có quyền xem sức khỏe của trẻ này.');
    if (!isIsoDate(date)) throw new ApiError(422, 'Chọn ngày hợp lệ theo dd/mm/yyyy.');
    const db = readDb();
    const child = db.children?.find((item) => item.id === childId);
    if (!child) throw new ApiError(404, 'Không tìm thấy trẻ.');
    const entries = (db.dailyHealthEntries || []).filter((entry) => entry.childId === childId && entry.date === date).sort(byNewest);
    const cls = db.classes?.find((item) => item.id === (entries[0]?.classId || child.classId));
    if (!canViewAttendance(cls, user)) throw new ApiError(403, 'Trẻ không thuộc điểm trường bạn phụ trách.');
    return clone({
      childId,
      childName: child.fullName,
      childCode: child.code,
      classId: cls.id,
      className: cls.name,
      date,
      contacts: parentContacts(child),
      entries: entries.map((entry) => ({ ...withEarlyPickup(db, entry), parentNotifications: notificationsOf(db, entry.id) })),
    });
  },
};
