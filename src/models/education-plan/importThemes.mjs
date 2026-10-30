import { isBlankBreak, isBlankTheme } from '@/models/education-plan/goalTable';

/*
 * BE:EDU-43 — lấy chủ đề, đợt nghỉ từ kế hoạch năm có sẵn: thêm vào cuối, bỏ chủ đề trùng tên hoặc viết tắt (EDU-42),
 * chép tên/viết tắt/lễ hội/ghi chú; khác năm học thì dời ngày đúng số năm chênh. Không chép dấu tích chủ đề.
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
        start: shiftYears(t.start, n),
        end: shiftYears(t.end, n),
      });
      report.themes++;
    });
  (source.breaks || [])
    .filter((b) => breakIds.includes(b.id))
    .forEach((b) => {
      if (breakExists(b, breaks)) return report.skipped++;
      breaks.push({ id: newId(), label: b.label || '', start: shiftYears(b.start, n), end: shiftYears(b.end, n) });
      report.breaks++;
    });
  return { themes, breaks, report };
}
