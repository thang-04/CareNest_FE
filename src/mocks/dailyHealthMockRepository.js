import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { canRecordAttendance } from '@/utils/attendance/attendancePermissions';
import { schoolNow } from '@/utils/attendance/attendanceTime';
import { HEALTH_SYMPTOMS, validateDailyHealth } from '@/utils/dailyHealthValidation';
import { uid } from '@/utils/id';

const context = (db, { classId, childId, date }, user) => {
  const cls = db.classes?.find((item) => item.id === classId);
  if (!cls) throw new ApiError(404, 'Không tìm thấy lớp.');
  if (!canRecordAttendance(cls, user)) throw new ApiError(403, 'Bạn không được phân công ghi nhận sức khỏe của lớp này.');
  const child = db.children?.find((item) => item.id === childId && item.classId === classId && item.status === 'ACTIVE');
  if (!child) throw new ApiError(404, 'Trẻ không thuộc danh sách lớp hiện tại.');
  const attendance = db.attendance?.find((item) => item.childId === childId && item.classId === classId && item.date === date);
  return { child, attendance, canRecord: date === schoolNow().date && attendance?.status === 'PRESENT' };
};

export const dailyHealthMockRepository = {
  async getDailyHealth(query, user) {
    await delay(120);
    const db = readDb();
    const { canRecord, child } = context(db, query, user);
    const entries = (db.dailyHealthEntries || [])
      .filter((entry) => entry.childId === query.childId && entry.classId === query.classId && entry.date === query.date)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    return {
      ...query,
      canRecord,
      contacts: clone(child.guardians || []),
      entries: clone(
        entries.map((entry) => ({
          ...entry,
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
        contactOutcome: payload.observation === 'NOTED' ? payload.contactOutcome || 'NOT_CONTACTED' : null,
        contactNote: payload.observation === 'NOTED' ? (payload.contactNote || '').trim() : '',
        notificationStatus: payload.observation === 'NOTED' ? 'PENDING' : 'NOT_REQUIRED',
        recordedBy: user.id,
        recordedByName: user.fullName,
        recordedAt: new Date().toISOString(),
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
      if (entry.observation !== 'NOTED') throw new ApiError(422, 'Lần ghi nhận không có dấu hiệu cần lưu ý.');
      // Email chỉ là khóa người nhận trong demo; App thật phải dùng GuardianChildLink do BE xác nhận.
      const recipients = (child.guardians || []).filter((guardian) => guardian.accountStatus === 'ACTIVE' && guardian.email);
      if (!recipients.length) throw new ApiError(409, 'Chưa có tài khoản phụ huynh demo đang hoạt động. Kiểm tra hồ sơ liên hệ của trẻ.');
      db.parentHealthNotifications ||= [];
      const message = [
        `Nhà trường ghi nhận ${child.fullName} có dấu hiệu cần lưu ý ngày ${entry.date}.`,
        entry.temperature === null ? '' : `Thân nhiệt ghi nhận: ${entry.temperature.toLocaleString('vi-VN')} °C.`,
        entry.symptoms.length ? `Biểu hiện: ${entry.symptoms.map((symptom) => HEALTH_SYMPTOMS[symptom]).join(', ')}.` : '',
        entry.note,
        'Phụ huynh vui lòng liên hệ giáo viên để trao đổi thêm.',
      ]
        .filter(Boolean)
        .join(' ');
      recipients.forEach((guardian) => {
        if (db.parentHealthNotifications.some((item) => item.healthEntryId === entry.id && item.recipientKey === guardian.email)) return;
        db.parentHealthNotifications.push({
          id: uid('parent-health'),
          healthEntryId: entry.id,
          childId: entry.childId,
          recipientKey: guardian.email,
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
};
