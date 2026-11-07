import { isBlankBreak, isBlankTheme } from '@/models/education-plan/goalTable';

/*
 * BE:EDU-43 — lấy chủ đề, đợt nghỉ từ kế hoạch năm có sẵn: thêm vào cuối, bỏ chủ đề trùng tên hoặc viết tắt (EDU-42),
 * chép tên/viết tắt/lễ hội/ghi chú. Không chép dấu tích chủ đề.
 * Ngày giữ nguyên như nguồn (Tiền 04/11): lưu nháp bình thường, bảng chủ đề tô đỏ ngày lệch và gợi ý dời
 * (suggestThemeDates / suggestBreakDates) để người lập đồng ý từng dòng, tất cả, hoặc tự sửa.
 */

const norm = (s) => (s || '').trim().toLowerCase();
const startYear = (schoolYear) => Number(String(schoolYear || '').slice(0, 4));

/** Dời ngày YYYY-MM-DD đi n năm; 29/02 sang năm không nhuận thành 28/02. */
export const shiftYears = (date, n) => {
  if (!date || !n) return date || '';
  const [y, m, d] = date.split('-').map(Number);
  const year = y + n;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const day = m === 2 && d === 29 && !leap ? 28 : d;
  return `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const DAY = 86400000;
const toUtc = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const toIso = (ms) => new Date(ms).toISOString().slice(0, 10);
const weekday = (ms) => (new Date(ms).getUTCDay() + 6) % 7; // 0 = thứ 2 … 6 = chủ nhật

/** Dời ngày n năm nhưng theo bội số tuần gần nhất: giữ nguyên thứ trong tuần (thứ 2 vẫn là thứ 2). */
export const shiftWeeksForYears = (date, n) => {
  if (!date || !n) return date || '';
  const from = toUtc(date);
  const weeks = Math.round((toUtc(shiftYears(date, n)) - from) / DAY / 7);
  return toIso(from + weeks * 7 * DAY);
};

/** Ngày bắt đầu chủ đề về thứ 2: ngày trong tuần ⇒ thứ 2 tuần đó; thứ 7, chủ nhật ⇒ thứ 2 tuần sau. */
export const alignWeekStart = (date) => {
  if (!date) return date || '';
  const t = toUtc(date);
  const w = weekday(t);
  return toIso(w <= 4 ? t - w * DAY : t + (7 - w) * DAY);
};

/** Ngày kết thúc chủ đề về thứ 6: ngày trong tuần ⇒ thứ 6 tuần đó; thứ 7, chủ nhật ⇒ thứ 6 vừa qua. */
export const alignWeekEnd = (date) => {
  if (!date) return date || '';
  const t = toUtc(date);
  const w = weekday(t);
  return toIso(t + (4 - w) * DAY);
};

/** Ngày chủ đề lấy từ kế hoạch / file khác: dời theo tuần (khác năm học) rồi canh thứ 2 – thứ 6. */
export const themeDates = (theme, n) => ({
  start: alignWeekStart(shiftWeeksForYears(theme.start, n)),
  end: alignWeekEnd(shiftWeeksForYears(theme.end, n)),
});

export const yearShift = (source, target) => {
  const n = startYear(target) - startYear(source);
  return Number.isFinite(n) ? n : 0;
};

/** Chủ đề nguồn đã có trong bản đang soạn (trùng tên hoặc viết tắt) thì không thêm. */
export const themeExists = (theme, targetThemes) =>
  targetThemes.some(
    (t) => (norm(theme.name) && norm(t.name) === norm(theme.name)) || (norm(theme.abbr) && norm(t.abbr) === norm(theme.abbr)),
  );
export const breakExists = (b, targetBreaks) => targetBreaks.some((x) => norm(b.label) && norm(x.label) === norm(b.label));

export function mergeImportedThemes(form, source, { themeIds = [], breakIds = [] }, newId) {
  const n = yearShift(source.schoolYear, form.schoolYear);
  const themes = form.themes.filter((t) => !isBlankTheme(t));
  const breaks = form.breaks.filter((b) => !isBlankBreak(b));
  const report = { themes: 0, breaks: 0, skipped: 0, shifted: n };
  (source.themes || [])
    .filter((t) => themeIds.includes(t.id))
    .forEach((t) => {
      if (themeExists(t, themes)) return report.skipped++;
      themes.push({
        id: newId(),
        name: t.name || '',
        abbr: t.abbr || '',
        festivals: t.festivals || '',
        note: t.note || '',
        start: t.start || '',
        end: t.end || '',
      });
      report.themes++;
    });
  (source.breaks || [])
    .filter((b) => breakIds.includes(b.id))
    .forEach((b) => {
      if (breakExists(b, breaks)) return report.skipped++;
      breaks.push({ id: newId(), label: b.label || '', start: b.start || '', end: b.end || '' });
      report.breaks++;
    });
  return { themes, breaks, report };
}

// Năm học của một ngày theo tháng bắt đầu năm học hệ thống (vd. 9 ⇒ tháng 9 – tháng 8 năm sau)
const schoolYearStartOf = (iso, startMonth) => {
  const [y, m] = iso.split('-').map(Number);
  return m >= startMonth ? y : y - 1;
};
const yearsOff = (iso, yearRange) => {
  if (!iso || !yearRange?.start) return 0;
  const [startYear, startMonth] = yearRange.start.split('-').map(Number);
  return startYear - schoolYearStartOf(iso, startMonth);
};

/**
 * Gợi ý ngày chủ đề (Tiền 04/11): khác năm học đang soạn ⇒ dời theo tuần về năm học đó; luôn canh thứ 2 – thứ 6.
 * Trả null khi ngày đã đúng. yearRange: { start, end } của năm học từ hệ thống.
 */
export function suggestThemeDates(theme, yearRange) {
  if (!theme.start && !theme.end) return null;
  const next = themeDates(theme, yearsOff(theme.start || theme.end, yearRange));
  return next.start === (theme.start || '') && next.end === (theme.end || '') ? null : next;
}

/** Gợi ý ngày đợt nghỉ: chỉ khi khác năm học đang soạn, dời theo ngày lịch (ngày lễ theo ngày). */
export function suggestBreakDates(item, yearRange) {
  const n = yearsOff(item.start || item.end, yearRange);
  return n ? { start: shiftYears(item.start, n), end: shiftYears(item.end, n) } : null;
}
