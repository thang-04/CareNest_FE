import { getImportGoals, mergeImportedGoals } from '@/models/education-plan/importGoals.mjs';
import { AGE_GROUPS } from '@/models/education-plan/educationPlanConstants';
import { breakExists, mergeImportedThemes, shiftYears, yearShift } from '@/models/education-plan/importThemes.mjs';
import { themeScheduleIssue } from '@/models/education-plan/goalTable';

/*
 * Nhập file bảng mục tiêu (BE:EDU-46): BE trả bản xem trước; Web ghép bằng luật bổ sung của EDU-24 (thêm cuối lĩnh vực
 * cùng tên, bỏ mục tiêu trùng câu, giữ lĩnh vực con/nhóm) và giữ dấu tích khớp viết tắt chủ đề đang có.
 */

/** Bản xem trước dựng thành kế hoạch nguồn như mergeImportedGoals cần. */
export const fileAsSourcePlan = (preview) => ({
  id: 'file',
  domains: (preview?.domains || []).map((d, i) => ({
    id: `file-d${i}`,
    name: d.name,
    rows: (d.rows || []).map((r, k) => ({
      id: `file-${i}-${k}`,
      kind: r.kind,
      text: r.text,
      ...(r.kind === 'goal'
        ? { contents: (r.contents || []).map((c, j) => ({ id: `file-${i}-${k}-${j}`, text: c.text, themes: c.themes || [] })) }
        : {}),
    })),
  })),
});

const abbrKey = (abbr) => (abbr || '').trim().toLowerCase();

/** Đếm theo lĩnh vực để hiện xem trước: số mục tiêu, nội dung, dấu tích. */
export const previewSummary = (preview) =>
  (preview?.domains || []).map((d) => {
    const goals = (d.rows || []).filter((r) => r.kind === 'goal');
    const contents = goals.flatMap((g) => g.contents || []);
    return {
      name: d.name,
      goals: goals.length,
      contents: contents.length,
      ticks: contents.reduce((n, c) => n + (c.themes || []).length, 0),
    };
  });

/** Viết tắt chủ đề trong file chưa có ở bản đang soạn (không phân biệt hoa thường). */
export const missingThemeAbbrs = (preview, themes, aliases = []) => {
  const have = new Set([...(themes || []).map((t) => abbrKey(t.abbr)), ...aliases.map(abbrKey)]);
  const used = (preview?.domains || []).flatMap((d) => (d.rows || []).flatMap((r) => (r.contents || []).flatMap((c) => c.themes || [])));
  const missing = new Map();
  used.filter((a) => !have.has(abbrKey(a))).forEach((a) => missing.has(abbrKey(a)) || missing.set(abbrKey(a), a.trim()));
  return [...missing.values()];
};

export function mergeFileGoals(form, preview, makeId, { themeAliases = [] } = {}) {
  const ids = new Map([
    ...(form.themes || []).map((t) => [abbrKey(t.abbr), t.id]),
    ...themeAliases.map(([abbr, id]) => [abbrKey(abbr), id]),
  ]);
  let ticks = 0;
  const themesOf = (content) =>
    (content.themes || []).flatMap((abbr) => {
      const id = ids.get(abbrKey(abbr));
      if (!id) return [];
      ticks += 1;
      return [id];
    });
  const source = fileAsSourcePlan(preview);
  const goalIds = getImportGoals(source).map((g) => g.id);
  const { domains, report } = mergeImportedGoals(form, source, goalIds, makeId, { themesOf, freeContext: true });
  return {
    domains,
    report: {
      ...report,
      ticks,
      missingThemes: missingThemeAbbrs(
        preview,
        form.themes,
        themeAliases.map(([abbr]) => abbr),
      ),
    },
  };
}

const sourceGroup = (metadata) => {
  if (metadata?.ageFromMonths == null && metadata?.ageToMonths == null) return null;
  return AGE_GROUPS.find((group) => {
    const match = group.name.match(/(\d+)\s*[-–]\s*(\d+)\s*(tháng|tuổi)/i);
    const factor = match?.[3] === 'tuổi' ? 12 : 1;
    return match && Number(match[1]) * factor === metadata.ageFromMonths && Number(match[2]) * factor === metadata.ageToMonths;
  });
};
const matchingThemes = (theme, themes) =>
  themes.filter(
    (existing) =>
      (abbrKey(theme.name) && abbrKey(theme.name) === abbrKey(existing.name)) ||
      (abbrKey(theme.abbr) && abbrKey(theme.abbr) === abbrKey(existing.abbr)),
  );

// BE:EDU-46 — kiểm preview bằng dữ liệu đích hiện tại, trước khi tạo ID hoặc đổi form.
export function prepareFileImport(form, preview, { allowedAgeGroupIds, yearRange } = {}) {
  const metadata = preview?.metadata;
  const group = sourceGroup(metadata);
  let error = '';
  if (group === undefined) error = 'Không nhận diện được nhóm tuổi trong file. Kiểm tra lại file trước khi nhập.';
  else if (group && form.ageGroupId && form.ageGroupId !== group.id)
    error = `File thuộc nhóm tuổi ${group.name}, khác nhóm tuổi đang mở. Không thể nhập.`;
  const ageGroupId = form.ageGroupId || group?.id || '';
  if (!error && ageGroupId && allowedAgeGroupIds && !allowedAgeGroupIds.includes(ageGroupId))
    error = 'Bạn không có quyền nhập vào nhóm tuổi của file.';
  const source = {
    schoolYear: metadata?.schoolYear || form.schoolYear,
    themes: (preview?.themes || []).map((theme, i) => ({ ...theme, id: `file-theme-${i}` })),
    breaks: (preview?.breaks || []).map((item, i) => ({ ...item, id: `file-break-${i}`, label: item.name || item.label || '' })),
  };
  const shifted = yearShift(source.schoolYear, form.schoolYear);
  const warnings = [...(preview?.warnings || [])];
  const projected = [...(form.themes || [])];
  const themes = source.themes.map((theme) => {
    const matches = matchingThemes(theme, projected);
    if (matches.length > 1) error ||= `Chủ đề "${theme.name}" khớp với nhiều chủ đề đang có. Kiểm tra tên và viết tắt trước khi nhập.`;
    const existing = matches[0];
    if (!existing) projected.push(theme);
    return {
      ...theme,
      start: shiftYears(theme.start, shifted),
      end: shiftYears(theme.end, shifted),
      existing: !!existing,
      targetAbbr: existing?.abbr || theme.abbr,
    };
  });
  const aliases = source.themes.filter((t) => matchingThemes(t, projected).length === 1).map((t) => t.abbr);
  const breaks = source.breaks.map((item) => ({
    ...item,
    start: shiftYears(item.start, shifted),
    end: shiftYears(item.end, shifted),
    existing: breakExists(item, form.breaks || []),
  }));
  const issue = themeScheduleIssue([...(form.themes || []), ...themes.filter((t) => !t.existing)]);
  if (issue) warnings.push({ row: 0, message: issue });
  if (
    yearRange &&
    [...themes, ...breaks].some((item) => [item.start, item.end].some((date) => date && (date < yearRange.start || date > yearRange.end)))
  )
    warnings.push({ row: 0, message: 'Có chủ đề hoặc đợt nghỉ nằm ngoài năm học đang mở. Kiểm tra lại ngày sau khi bổ sung.' });
  if (source.themes.length && !metadata?.schoolYear)
    warnings.push({ row: 0, message: 'File không xác định được năm học nguồn. Kiểm tra ngày chủ đề trước khi nhập.' });
  return {
    source,
    ageGroupId,
    sourceAgeGroupId: group?.id || '',
    error,
    themes,
    breaks,
    shifted,
    warnings,
    missingThemes: missingThemeAbbrs(preview, projected, aliases),
  };
}

export function mergeFilePlan(form, preview, makeId, options = {}) {
  const prepared = prepareFileImport(form, preview, options);
  if (prepared.error) return { patch: null, report: null, error: prepared.error };
  const originalThemes = form.themes || [];
  const originalBreaks = form.breaks || [];
  const merged = mergeImportedThemes(
    { ...form, themes: originalThemes, breaks: originalBreaks },
    prepared.source,
    { themeIds: prepared.source.themes.map((t) => t.id), breakIds: prepared.source.breaks.map((t) => t.id) },
    makeId,
  );
  const oldThemeIds = new Set(originalThemes.map((t) => t.id));
  const oldBreakIds = new Set(originalBreaks.map((t) => t.id));
  const themes = [...originalThemes, ...merged.themes.filter((t) => !oldThemeIds.has(t.id))];
  const breaks = [...originalBreaks, ...merged.breaks.filter((t) => !oldBreakIds.has(t.id))];
  const themeAliases = prepared.source.themes.map((t) => [t.abbr, matchingThemes(t, themes)[0]?.id]).filter(([, id]) => id);
  const goals = mergeFileGoals({ ...form, themes }, preview, makeId, { themeAliases });
  const patch = { domains: goals.domains, themes, breaks };
  if (!form.ageGroupId && prepared.ageGroupId) patch.ageGroupId = prepared.ageGroupId;
  if (!form.title?.trim() && preview?.metadata?.title?.trim()) patch.title = preview.metadata.title.trim();
  return {
    patch,
    error: '',
    report: {
      ...goals.report,
      themes: merged.report.themes,
      breaks: merged.report.breaks,
      skippedThemes: merged.report.skipped,
      shifted: prepared.shifted,
      warnings: prepared.warnings,
    },
  };
}
