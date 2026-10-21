import { schoolNow } from '@/utils/attendance/attendanceTime';

export const ATTENDANCE_UNLOCK_MAX_DAYS = 7;

export const isAttendanceUnlockActive = (unlock, now = new Date()) =>
  !!unlock &&
  unlock.date === schoolNow(now).date &&
  Number.isFinite(Date.parse(unlock.validUntil)) &&
  Date.parse(unlock.validUntil) > now.getTime();
