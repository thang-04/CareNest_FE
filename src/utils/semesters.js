// Học kỳ của năm học (Cấu hình thời gian › Học kỳ) để lọc nhanh theo học kỳ; chưa đặt ngày học kỳ thì không có lựa chọn
export const SEMESTER_KEYS = { S1: 'S1', S2: 'S2', YEAR: 'YEAR' };

/** [{ key, label, start, end }] gồm Học kỳ I, Học kỳ II (nếu đã đặt) và Cả năm học. */
export function semestersOf(year) {
  if (!year?.startDate || !year?.endDate) return [];
  const list = [];
  if (year.semester1Start && year.semester1End)
    list.push({ key: SEMESTER_KEYS.S1, label: 'Học kỳ I', start: year.semester1Start, end: year.semester1End });
  if (year.semester2Start && year.semester2End)
    list.push({ key: SEMESTER_KEYS.S2, label: 'Học kỳ II', start: year.semester2Start, end: year.semester2End });
  list.push({ key: SEMESTER_KEYS.YEAR, label: 'Cả năm học', start: year.startDate, end: year.endDate });
  return list;
}

/** Khoảng ngày của học kỳ, cắt tới hôm nay (không chọn ngày tương lai); học kỳ chưa bắt đầu trả null. */
export function semesterRange(semester, today) {
  if (!semester || semester.start > today) return null;
  return { from: semester.start, to: semester.end < today ? semester.end : today };
}

/** Tháng yyyy-MM có giao với học kỳ (dùng để lọc cột / kỳ theo tháng). */
export const monthInSemester = (month, semester) => !semester || (`${month}-31` >= semester.start && `${month}-01` <= semester.end);
