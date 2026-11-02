import { getImportGoals, mergeImportedGoals } from '@/models/education-plan/importGoals.mjs';
import { AGE_GROUPS } from '@/models/education-plan/educationPlanConstants';
import { shiftYears, yearShift } from '@/models/education-plan/importThemes.mjs';
import { duplicateAbbrThemeIds, themeScheduleIssue } from '@/models/education-plan/goalTable';

// EDU-46: preview/apply cùng chế độ thay nội dung, giữ năm hệ thống và các trường cố định.
export const FILE_IMPORT_MODES = { ALL: 'replace-all', PRESENT: 'replace-present' };

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
const contentTicks = (domains) => (domains || []).flatMap((d) => (d.rows || []).flatMap((r) => r.contents || []));

export function prepareFileImport(form, preview, { allowedAgeGroupIds, yearRange, mode = FILE_IMPORT_MODES.ALL } = {}) {
  const metadata = preview?.metadata;
  const all = mode === FILE_IMPORT_MODES.ALL;
  const present = {
    title: !!metadata?.title?.trim(),
    domains: !!preview?.domains?.some((d) => d.rows?.length),
    themes: !!preview?.themes?.length,
    breaks: !!preview?.breaks?.length,
  };
  const replace = Object.fromEntries(Object.entries(present).map(([key, has]) => [key, all || has]));
  replace.description = all;
  let error = Object.values(FILE_IMPORT_MODES).includes(mode) ? '' : 'Cách nhập file không hợp lệ.';
  const group = sourceGroup(metadata);
  if (group === undefined) error ||= 'Không nhận diện được nhóm tuổi trong file. Kiểm tra lại file trước khi nhập.';
  else if (group && form.ageGroupId && form.ageGroupId !== group.id)
    error ||= `File thuộc nhóm tuổi ${group.name}, khác nhóm tuổi đang mở. Không thể nhập.`;
  const ageGroupId = form.ageGroupId || group?.id || '';
  if (ageGroupId && allowedAgeGroupIds && !allowedAgeGroupIds.includes(ageGroupId))
    error ||= 'Bạn không có quyền nhập vào nhóm tuổi của file.';
  if (!yearRange?.start || !yearRange?.end || yearRange.start > yearRange.end)
    error ||= 'Chưa có ngày bắt đầu, kết thúc năm học từ hệ thống. Kiểm tra cấu hình năm học trước khi nhập.';
  if (preview && !Object.values(present).some(Boolean)) error ||= 'File không có nội dung hợp lệ để thay vào kế hoạch.';
  if ((preview?.domains || []).some((d) => d.rows?.length && !form.domains?.some((t) => t.name === d.name && t.active !== false)))
    error ||= 'Có lĩnh vực trong file không thuộc danh mục đang dùng. Kiểm tra file trước khi thay nội dung.';

  const shifted = yearShift(metadata?.schoolYear || form.schoolYear, form.schoolYear);
  const themes = replace.themes
    ? (preview?.themes || []).map((t, i) => ({
        ...t,
        id: `file-theme-${i}`,
        start: shiftYears(t.start, shifted),
        end: shiftYears(t.end, shifted),
      }))
    : form.themes || [];
  const breaks = replace.breaks
    ? (preview?.breaks || []).map((b, i) => ({
        ...b,
        id: `file-break-${i}`,
        label: b.name || b.label || '',
        start: shiftYears(b.start, shifted),
        end: shiftYears(b.end, shifted),
      }))
    : form.breaks || [];
  if (duplicateAbbrThemeIds(themes).size) error ||= 'Chủ đề có viết tắt trùng nhau. Kiểm tra trước khi ghép dấu tích.';
  const warnings = [...(preview?.warnings || [])];
  const issue = themeScheduleIssue(themes);
  if (issue) warnings.push({ row: 0, message: issue });
  if (
    yearRange?.start &&
    yearRange?.end &&
    [...themes, ...breaks].some((t) => [t.start, t.end].some((d) => d && (d < yearRange.start || d > yearRange.end)))
  )
    warnings.push({ row: 0, message: 'Có chủ đề hoặc đợt nghỉ nằm ngoài năm học đang mở. Kiểm tra lại ngày trước khi gửi / ban hành.' });
  if (present.themes && !metadata?.schoolYear)
    warnings.push({ row: 0, message: 'File không xác định được năm học nguồn. Kiểm tra ngày chủ đề trước khi nhập.' });
  const oldAbbrs = new Map((form.themes || []).map((t) => [t.id, abbrKey(t.abbr)]));
  const newAbbrs = new Set(themes.map((t) => abbrKey(t.abbr)).filter(Boolean));
  const removedTicks =
    replace.themes && !replace.domains
      ? contentTicks(form.domains).reduce((n, c) => n + (c.themes || []).filter((id) => !newAbbrs.has(oldAbbrs.get(id))).length, 0)
      : 0;
  if (removedTicks) warnings.push({ row: 0, message: `${removedTicks} dấu tích đang có sẽ bỏ vì chủ đề tương ứng không còn trong file.` });
  return {
    mode,
    replace,
    present,
    error,
    ageGroupId,
    sourceAgeGroupId: group?.id || '',
    shifted,
    themes,
    breaks,
    warnings,
    removedTicks,
    title: replace.title ? metadata?.title?.trim() || '' : form.title || '',
    description: replace.description ? '' : form.description || '',
    missingThemes: missingThemeAbbrs(preview, themes),
  };
}

export function mergeFilePlan(form, preview, makeId, options = {}) {
  const prepared = prepareFileImport(form, preview, options);
  if (prepared.error) return { patch: null, report: null, error: prepared.error };
  const usedIds = new Set([
    ...(form.themes || []).map((t) => String(t.id)),
    ...(form.breaks || []).map((b) => String(b.id)),
    ...(form.domains || []).flatMap((d) => [
      String(d.id),
      ...(d.rows || []).flatMap((r) => [String(r.id), ...(r.contents || []).map((c) => String(c.id))]),
    ]),
  ]);
  let suffix = 0;
  const nextId = () => {
    const raw = String(makeId());
    let id = raw;
    while (usedIds.has(id)) id = `${raw}-${++suffix}`;
    usedIds.add(id);
    return id;
  };
  const themes = prepared.replace.themes ? prepared.themes.map((t) => ({ ...t, id: nextId() })) : prepared.themes;
  const breaks = prepared.replace.breaks ? prepared.breaks.map((b) => ({ ...b, id: nextId() })) : prepared.breaks;
  let domains;
  let report = { added: 0, duplicates: 0, unavailable: [], ticks: 0, missingThemes: prepared.missingThemes };
  if (prepared.replace.domains) {
    const empty = (form.domains || []).map((d) => ({ ...d, rows: [], items: [] }));
    const result = mergeFileGoals({ ...form, domains: empty, themes }, preview, nextId);
    if (result.report.unavailable.length)
      return {
        patch: null,
        report: null,
        error: 'Có mục tiêu trong file chưa nhập được. Kiểm tra lĩnh vực và nội dung trước khi thay kế hoạch.',
      };
    domains = result.domains;
    report = result.report;
  } else if (prepared.replace.themes) {
    const oldAbbrs = new Map((form.themes || []).map((t) => [t.id, abbrKey(t.abbr)]));
    const newIds = new Map(themes.filter((t) => abbrKey(t.abbr)).map((t) => [abbrKey(t.abbr), t.id]));
    domains = (form.domains || []).map((d) => ({
      ...d,
      rows: (d.rows || []).map((r) =>
        r.kind !== 'goal'
          ? r
          : {
              ...r,
              contents: (r.contents || []).map((c) => ({
                ...c,
                themes: [
                  ...new Set(
                    (c.themes || []).flatMap((id) => {
                      const target = newIds.get(oldAbbrs.get(id));
                      return target ? [target] : [];
                    }),
                  ),
                ],
              })),
            },
      ),
    }));
  } else domains = form.domains || [];
  const patch = { domains, themes, breaks, title: prepared.title, description: prepared.description };
  if (!form.ageGroupId && prepared.ageGroupId) patch.ageGroupId = prepared.ageGroupId;
  return {
    patch,
    error: '',
    report: {
      ...report,
      mode: prepared.mode,
      themes: prepared.replace.themes ? themes.length : 0,
      breaks: prepared.replace.breaks ? breaks.length : 0,
      removedTicks: prepared.removedTicks,
      shifted: prepared.shifted,
      warnings: prepared.warnings,
    },
  };
}
