import { attendanceMockRepository as attendance } from '@/services/attendance/mock/attendanceMockRepository';
import { completeAttendance } from './complete-attendance.mjs';

// Chỉ ghép các thao tác chốt từng bữa đang có để thử bếp, không thêm API chốt ngày vào production.
export const confirmExistingCounts = async ({ campusId, date }, actor) => {
  const { counts } = await attendance.getMealCounts({ date }, { id: 'test-reader', role: 'PRINCIPAL' });
  const pending = counts.filter((count) => count.campusId === campusId && count.id && count.status !== 'CONFIRMED');
  if (!pending.length) throw Object.assign(new Error('Không còn bữa chờ xác nhận.'), { status: 409 });
  completeAttendance({ campusId, date });
  const confirmed = [];
  for (const count of pending) confirmed.push(await attendance.confirmMealCount(count.id, actor));
  return confirmed;
};
