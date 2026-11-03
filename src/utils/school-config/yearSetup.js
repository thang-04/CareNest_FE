/*
 * Thiết lập năm học từng bước (Cần chốt 30/10/2026): chọn năm nguồn ở bước 1 thì các bước sau được điền sẵn
 * bằng POST /school-years/{id}/copy (BE giữ nguyên dữ liệu năm đích đã có, dòng không chép được trả về kèm lý do).
 */

/** Năm học liền sau năm mới nhất, để Hiệu trưởng ít phải gõ. */
export const suggestNextYear = (years) => {
  const latest = [...years].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  const from = latest ? Number(latest.name.slice(5)) : new Date().getFullYear();
  return { name: `${from}-${from + 1}`, startDate: `${from}-09-05`, endDate: `${from + 1}-05-31` };
};

/** Cùng ngày/tháng, dời theo số năm giữa năm nguồn và năm đích (yyyy-mm-dd). */
const isoPlusDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Học kỳ gợi ý: HK I từ ngày bắt đầu năm học, HK II tới ngày kết thúc, chia đôi ở giữa (người dùng sửa được). */
export const suggestSemesters = (startDate, endDate) => {
  if (!startDate || !endDate || startDate >= endDate) return null;
  const days = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000);
  const semester1End = isoPlusDays(startDate, Math.floor(days / 2));
  return { semester1Start: startDate, semester1End, semester2Start: isoPlusDays(semester1End, 1), semester2End: endDate };
};

export const shiftToYear = (date, sourceStart, targetStart) => {
  if (!date || !sourceStart || !targetStart) return '';
  const years = Number(targetStart.slice(0, 4)) - Number(sourceStart.slice(0, 4));
  const y = Number(date.slice(0, 4)) + years;
  const md = date.slice(5);
  // 29/02 sang năm không nhuận ⇒ 28/02
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return `${y}-${md === '02-29' && !leap ? '02-28' : md}`;
};

export const COPY_PARTS = [
  { key: 'CLASSES', label: 'Lớp học (tên, nhóm tuổi, điểm trường, phòng, sĩ số)', step: 1 },
  { key: 'TEAM_LEADERS', label: 'Tổ trưởng nhóm tuổi', step: 2 },
  { key: 'TEACHERS', label: 'Giáo viên và chủ nhiệm từng lớp', step: 2 },
  { key: 'VICE_PRINCIPALS', label: 'Phó hiệu trưởng và quyền được giao', step: 3 },
  { key: 'CUTOFF', label: 'Giờ chốt điểm danh', step: 4 },
];

export const SETUP_STEPS = [
  'Thông tin năm học',
  'Phòng & lớp',
  'Tổ trưởng & giáo viên',
  'Phó hiệu trưởng',
  'Giờ chốt & học kỳ',
  'Xếp lớp trẻ',
  'Kiểm tra & kích hoạt',
];

/** Bước của luồng ↔ các mục "Chuẩn bị năm học" (readiness) phải đạt thì bước đó xong; học kỳ xét riêng theo năm học. */
const STEP_CHECKS = [
  ['info'],
  ['ageGroups', 'classes', 'rooms'],
  ['teamLeaders', 'teachers'],
  ['vicePrincipals'],
  ['cutoff'],
  ['placement'],
];

/** Các bước đã xong (chỉ số 0..6) theo readiness của BE; bước 5 cần thêm học kỳ đã đặt. */
export const completedSteps = (readiness, year) => {
  const ok = Object.fromEntries((readiness?.steps || []).map((s) => [s.key, s.ok]));
  const done = new Set();
  STEP_CHECKS.forEach((keys, i) => {
    const known = keys.filter((k) => k in ok);
    if (known.length && known.every((k) => ok[k]) && (i !== 4 || year?.semester1Start)) done.add(i);
  });
  if (year?.status === 'ACTIVE') done.add(6);
  return done;
};

/** Bước nên mở khi vào thiết lập: bước đầu tiên chưa xong (bước 1 luôn có khi năm đã tạo). */
export const firstOpenStep = (done, total) => {
  for (let i = 1; i < total; i += 1) if (!done.has(i)) return i;
  return total - 1;
};

export const stepOfPart = (part) => COPY_PARTS.find((p) => p.key === part)?.step ?? (part === 'SEMESTER' ? 4 : 0);

/** Kết quả sao chép giữ trong phiên để từng bước hiện các dòng bị bỏ qua (lỗi đỏ) tới khi người dùng đóng. */
const copyKey = (yearId) => `sc-year-copy-${yearId}`;
export const readCopyResult = (yearId) => {
  try {
    return JSON.parse(sessionStorage.getItem(copyKey(yearId)) || 'null');
  } catch {
    return null;
  }
};
export const writeCopyResult = (yearId, result) => {
  try {
    if (result) sessionStorage.setItem(copyKey(yearId), JSON.stringify(result));
    else sessionStorage.removeItem(copyKey(yearId));
  } catch {
    /* trình duyệt chặn sessionStorage: chỉ mất phần nhắc lại, dữ liệu đã chép vẫn còn */
  }
};

export const copySummary = (r) =>
  [
    r.copiedClasses?.length ? `${r.copiedClasses.length} lớp` : '',
    r.vicePrincipals ? `${r.vicePrincipals} Phó hiệu trưởng` : '',
    r.teacherClasses ? `giáo viên ${r.teacherClasses} lớp` : '',
    r.teamLeaders ? `${r.teamLeaders} tổ trưởng` : '',
    r.cutoffTime ? `giờ chốt ${r.cutoffTime}` : '',
  ]
    .filter(Boolean)
    .join(', ');
