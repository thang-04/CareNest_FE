import { getAttendanceSummary } from '@/services/attendance/attendanceService';
import { getDailyHealthOverview } from '@/services/dailyHealthService';
import { getCutoffSetting } from '@/services/school-config/schoolConfigService';
import { addDays, isSchoolDay, schoolNow } from '@/utils/attendance/attendanceTime';

/*
 * Số "Hôm nay" + "Cần chú ý hôm nay" của dashboard BGH; scope do facade trả (AUTH-08), không đưa tên trẻ ra.
 * PROPOSED backend: GET /reports/dashboard/today?date= → cùng hình kết quả của buildDashboardToday.
 */

const rateOf = (present, total) => (total > 0 ? Math.round((present / total) * 100) : null);

const totalsOf = (summary) => {
  const classes = summary?.classes || [];
  const sum = (key) => classes.reduce((t, c) => t + (c[key] || 0), 0);
  const total = sum('size');
  const present = sum('present');
  const excused = sum('excused');
  const unexcused = sum('unexcused');
  const recorded = present + excused + unexcused;
  return { present, excused, unexcused, recorded, missing: Math.max(0, total - recorded), total, rate: rateOf(present, total) };
};

/** Tên lớp không kèm chữ "Lớp" ở đầu (dữ liệu đã có sẵn "Lớp Chồi 1"), để câu không thành "Lớp Lớp Chồi 1". */
export const shortClassName = (name = '') => name.replace(/^Lớp\s+/i, '');

/** Cut-off có hiệu lực cho ngày `date`; null khi năm học chưa cấu hình (ATT-06 PENDING P-03, không hard-code giờ). */
export const activeCutoff = (setting, date) =>
  setting?.time && (!setting.effectiveFrom || date >= setting.effectiveFrom) ? setting.time : null;

const MAX_CLASSES = 4;

/** "Lá 2 · Mầm 3" hoặc, khi nhiều campus, "Campus 1: Lá 2 · Campus 2: Mầm 3"; quá 4 lớp thì thêm "và N lớp khác". */
const classList = (allRows, campusName, label = (r) => shortClassName(r.className)) => {
  const rows = allRows.slice(0, MAX_CLASSES);
  const more = allRows.length > MAX_CLASSES ? ` và ${allRows.length - MAX_CLASSES} lớp khác` : '';
  const campuses = [...new Set(rows.map((r) => r.campusId))];
  if (campuses.length < 2) return rows.map(label).join(' · ') + more;
  return (
    campuses
      .map(
        (id) =>
          `${campusName(id)}: ${rows
            .filter((r) => r.campusId === id)
            .map(label)
            .join(', ')}`,
      )
      .join(' · ') + more
  );
};

/**
 * Hàm thuần, để test và để thay bằng response BE sau này.
 * today/lastWeek: kết quả getAttendanceSummary một ngày (scope MULTI); health: getDailyHealthOverview.
 */
export function buildDashboardToday({ date, now, today, lastWeek, health, cutoff, campusName = (id) => id }) {
  const att = totalsOf(today);
  // Tuần trước chưa có bản ghi điểm danh nào thì không so sánh (không coi là 0%)
  const prevTotals = lastWeek ? totalsOf(lastWeek) : null;
  const prev = prevTotals?.recorded ? prevTotals : null;
  const classes = (today?.classes || [])
    .map((c) => {
      const recorded = c.present + c.excused + c.unexcused;
      return {
        classId: c.classId,
        className: c.className,
        campusId: c.campusId,
        size: c.size,
        present: c.present,
        taken: recorded > 0,
        rate: rateOf(c.present, c.size),
      };
    })
    // Lớp chưa điểm danh đứng đầu, rồi tỷ lệ có mặt tăng dần
    .sort((a, b) => Number(a.taken) - Number(b.taken) || (a.rate ?? 0) - (b.rate ?? 0) || a.className.localeCompare(b.className, 'vi'));

  const attention = [];
  const notTaken = classes.filter((c) => !c.taken && c.size > 0);
  const pastCutoff = cutoff && date === now.date && now.time >= cutoff;
  // Có cut-off: chỉ báo sau giờ chốt. Chưa cấu hình cut-off: báo "chưa điểm danh", không ghi "quá giờ".
  if (notTaken.length && (!cutoff || pastCutoff)) {
    const head =
      notTaken.length === 1 ? `Lớp ${shortClassName(notTaken[0].className)} chưa điểm danh` : `${notTaken.length} lớp chưa điểm danh`;
    attention.push({
      key: 'not-taken',
      tone: 'orange',
      title: pastCutoff ? `${head}, đã quá ${cutoff}` : head,
      meta: notTaken.length === 1 ? null : classList(notTaken, campusName),
      to: `/attendance/summary?from=${date}&to=${date}`,
      badge: pastCutoff ? 'Quá giờ' : null,
    });
  }

  const healthRows = health?.classes || [];
  const noted = healthRows.filter((r) => r.noted > 0);
  const notedTotal = noted.reduce((t, r) => t + r.noted, 0);
  if (notedTotal) {
    attention.push({
      key: 'health-noted',
      tone: 'red',
      title: `${notedTotal} trẻ có dấu hiệu cần lưu ý khi khám đầu ngày`,
      meta: classList(noted, campusName, (r) =>
        r.noted > 1 ? `${shortClassName(r.className)} (${r.noted})` : shortClassName(r.className),
      ),
      to: noted.length === 1 ? `/attendance/health?date=${date}&classId=${noted[0].classId}` : `/attendance/health?date=${date}`,
      badge: 'Cần xử lý',
    });
  }

  const unchecked = healthRows.filter((r) => r.present > r.checked);
  const uncheckedTotal = unchecked.reduce((t, r) => t + (r.present - r.checked), 0);
  if (uncheckedTotal) {
    attention.push({
      key: 'health-unchecked',
      tone: 'gray',
      title: `${uncheckedTotal} trẻ có mặt chưa được khám đầu ngày`,
      meta: classList(unchecked, campusName),
      to: `/attendance/health?date=${date}`,
      badge: null,
    });
  }

  if (att.unexcused) {
    const top = [...(today?.classes || [])].sort((a, b) => b.unexcused - a.unexcused)[0];
    attention.push({
      key: 'unexcused',
      tone: 'red',
      title: `${att.unexcused} trẻ nghỉ không phép`,
      meta: top?.unexcused ? `Nhiều nhất: lớp ${shortClassName(top.className)} (${top.unexcused} trẻ)` : null,
      to: `/attendance/summary?from=${date}&to=${date}`,
      badge: null,
    });
  }

  const healthTotals = health?.totals || null;
  return {
    date,
    attendance: {
      ...att,
      lastWeek: prev && prev.rate != null ? { date: addDays(date, -7), rate: prev.rate } : null,
      deltaPoints: prev && prev.rate != null && att.rate != null ? att.rate - prev.rate : null,
    },
    health: healthTotals ? { present: healthTotals.present, checked: healthTotals.checked, noted: healthTotals.noted } : null,
    classes,
    attention,
  };
}

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** "Thứ Hai tuần trước 88% · −4 điểm"; null khi không có số tuần trước. */
export const attendanceCompareText = (attendance) => {
  const prev = attendance?.lastWeek;
  if (!prev || attendance.deltaPoints == null) return null;
  const d = attendance.deltaPoints;
  const delta = d === 0 ? 'bằng' : `${d > 0 ? '+' : '−'}${Math.abs(d)} điểm`;
  return `${WEEKDAYS[new Date(`${prev.date}T00:00:00`).getDay()]} tuần trước ${prev.rate}% · ${delta}`;
};

/** Lấy dữ liệu một ngày cho người xem. Nguồn phụ (tuần trước, cut-off) lỗi thì bỏ phần so sánh, không làm hỏng cả khối. */
export async function getDashboardToday(user, { date, schoolYear, campusId, campusName } = {}) {
  const now = schoolNow();
  const day = date || now.date;
  const lastWeekDate = addDays(day, -7);
  const scope = campusId ? { campusId } : {};
  const [today, lastWeek, health, cutoffRes] = await Promise.all([
    getAttendanceSummary({ from: day, to: day, ...scope }, user),
    isSchoolDay(lastWeekDate) ? getAttendanceSummary({ from: lastWeekDate, to: lastWeekDate, ...scope }, user).catch(() => null) : null,
    getDailyHealthOverview({ date: day, ...scope }, user).catch(() => null),
    schoolYear ? getCutoffSetting(schoolYear).catch(() => null) : null,
  ]);
  return buildDashboardToday({
    date: day,
    now,
    today,
    lastWeek,
    health,
    cutoff: activeCutoff(cutoffRes?.setting, day),
    campusName,
  });
}
