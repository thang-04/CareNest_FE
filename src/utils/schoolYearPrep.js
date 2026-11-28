import { formatDate } from '@/utils/format';

const findYear = (schoolYears, schoolYear) => schoolYears.find((o) => String(o.id) === String(schoolYear));

/**
 * CFG-YR-05/CHD-12: năm sắp diễn ra (PLANNED) chưa tới ngày mở chuẩn bị (BE trả `preparing`=false, kể cả khi thiếu prepDate)
 * ⇒ màn trẻ chỉ xem. Trả năm bị khóa (phần tử danh sách năm ở header) hoặc null.
 */
export const lockedYearOf = (schoolYears, schoolYear) => {
  const year = findYear(schoolYears, schoolYear);
  return year?.status === 'PLANNED' && !year.preparing ? year : null;
};

/** CHD-11: năm sắp diễn ra đã tới ngày mở chuẩn bị ⇒ được tiếp nhận, xếp lớp cho năm đó. */
export const preparingYearOf = (schoolYears, schoolYear) => {
  const year = findYear(schoolYears, schoolYear);
  return year?.status === 'PLANNED' && year.preparing ? year : null;
};

/** CHD-11: năm chọn được khi tiếp nhận = năm đang hoạt động + năm sắp diễn ra đang chuẩn bị, giữ thứ tự danh sách. */
export const intakeYearOptions = (schoolYears) =>
  schoolYears.filter((o) => o.status === 'ACTIVE' || (o.status === 'PLANNED' && o.preparing));

/** Năm tiếp nhận mặc định: năm header nếu tiếp nhận được, không thì năm đang hoạt động. */
export const defaultIntakeYearId = (schoolYears, schoolYear) => {
  const options = intakeYearOptions(schoolYears);
  const picked = options.find((o) => String(o.id) === String(schoolYear));
  return (picked || options.find((o) => o.status === 'ACTIVE'))?.id ?? null;
};

export const lockedYearMessage = (year) =>
  `Năm học ${year.label} ${year.prepDate ? `mở chuẩn bị từ ${formatDate(year.prepDate)}` : 'chưa tới ngày mở chuẩn bị'} – chỉ xem.`;
