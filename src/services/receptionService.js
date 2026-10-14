import { saveClassAttendance } from '@/services/attendance/attendanceService';
import { addDailyHealth, notifyDailyHealth } from '@/services/dailyHealthService';

export async function saveReception({ attendance, health }, user) {
  let attendanceSaved = !attendance;
  let savedHealth = null;
  try {
    if (attendance) {
      await saveClassAttendance(attendance, user);
      attendanceSaved = true;
    }
    savedHealth = await addDailyHealth(health, user);
    if (savedHealth.observation === 'NOTED') await notifyDailyHealth(savedHealth.id, user);
    return { health: savedHealth, attendanceSaved };
  } catch (error) {
    // Hai request độc lập: báo đúng phần đã lưu, không giả lập rollback phía client.
    error.attendanceSaved = attendanceSaved;
    error.healthSaved = savedHealth;
    error.receptionStage = savedHealth ? 'notification' : attendanceSaved ? 'health' : 'attendance';
    throw error;
  }
}
