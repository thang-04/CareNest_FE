import { localDateOf } from '@/utils/format';
import { buildSeedSchoolConfig } from './schoolConfigSeed';

/*
 * Năm học của dữ liệu theo ngày (user chốt 2026-10-28, Y-2, Y-4): một ngày thuộc năm học gần nhất đã bắt đầu tính tới ngày đó,
 * nên kỳ hè giữa hai năm tính vào năm vừa qua và ngày nào cũng thuộc đúng một năm. BE giả dùng chung cho hồ sơ trẻ, sức khỏe.
 */
const yearsOf = (db) =>
  [...(db.schoolYears || buildSeedSchoolConfig().schoolYears)]
    .filter((y) => y.startDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

const dayOf = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? value : localDateOf(value));

/** Mã năm học chứa ngày (YYYY-MM-DD hoặc thời điểm ISO), hoặc null khi trước mọi năm học. */
export const schoolYearIdOfDate = (db, value) => {
  const day = value ? dayOf(value) : '';
  const started = day ? yearsOf(db).filter((y) => y.startDate <= day) : [];
  return started.at(-1)?.id || null;
};

/** Khoảng [from, to] (ngày hoặc thời điểm) có ngày nào thuộc năm học yearId không. */
export const overlapsSchoolYear = (db, yearId, from, to) => {
  const years = yearsOf(db);
  const i = years.findIndex((y) => y.id === yearId);
  if (i < 0 || !from) return false;
  const nextStart = years[i + 1]?.startDate;
  return (!nextStart || dayOf(from) < nextStart) && dayOf(to || from) >= years[i].startDate;
};
