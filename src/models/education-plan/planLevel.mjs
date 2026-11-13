export const planLevel = (plan) => plan?.planType || plan?.planLevel || 'TEAM';
export const planRoute = (plan) => (planLevel(plan) === 'SCHOOL_YEAR' ? '/education/school-year-plans' : '/education/goals');
export const workflowKey = (plan) => (planLevel(plan) === 'SCHOOL_YEAR' ? 'schoolYear' : 'year');
export const DEFAULT_DURATION = { revision: 1, theme: { minWeeks: 2, maxWeeks: 4 }, branch: { minWeeks: 1, maxWeeks: 2 } };
export const curriculumShape = (plan) =>
  (plan?.domains || []).map((d) => ({
    id: d.id,
    name: d.name,
    rows: (d.rows || []).map(({ displayLabel, contents, ...row }) => ({
      ...row,
      ...(row.kind === 'goal' ? { displayLabel: displayLabel?.trim() || null } : {}),
      contents: (contents || []).map(({ themes, ...c }) => c),
    })),
  }));
const lineage = (value) => String(value.lineageId || value.id);
export function inheritAnnual(source, previous, baseline) {
  const warnings = [];
  const oldContents = (previous?.domains || []).flatMap((d) => (d.rows || []).flatMap((row) => row.contents || []));
  const previousRows = (previous?.domains || []).flatMap((d) => d.rows || []);
  const baselineContents = (baseline?.domains || []).flatMap((d) => (d.rows || []).flatMap((row) => row.contents || []));
  const newThemes = source.themes || [];
  const mappedThemes = (content) => {
    const old = oldContents.find((c) => lineage(c) === lineage(content));
    return (old?.themes || []).flatMap((id) => {
      const oldTheme = previous.themes.find((t) => String(t.id) === String(id));
      const target = oldTheme && newThemes.find((t) => lineage(t) === lineage(oldTheme));
      if (!target) {
        warnings.push('Một liên kết nội dung–chủ đề không còn trong nguồn mới; kiểm tra lại dấu tích.');
        return [id];
      }
      return [target.id];
    });
  };
  const domains = structuredClone(source.domains || []).map((d) => ({
    id: d.id,
    name: d.name,
    rows: (d.rows || []).map((row) => {
      const oldRow = previousRows.find((item) => lineage(item) === lineage(row));
      const sourceIds = new Set((row.contents || []).map(lineage));
      const contents = (row.contents || []).map((c) => {
        const old = oldRow?.contents?.find((item) => lineage(item) === lineage(c));
        const prior = baselineContents.find((item) => lineage(item) === lineage(c));
        if (!old) return { ...c, themes: [] };
        const text = !prior || old.text !== prior.text ? old.text : c.text;
        if (prior && old.text !== prior.text && c.text !== prior.text) warnings.push('Nội dung năm và tổ cùng thay đổi; cần rà soát.');
        return { ...c, id: old.id, text, themes: mappedThemes(c) };
      });
      const extras = (oldRow?.contents || []).filter((c) => !sourceIds.has(lineage(c)))
        .map((c) => ({ ...c, themes: mappedThemes(c) }));
      return { ...row, ...(oldRow ? { id: oldRow.id } : {}), contents: [...contents, ...extras] };
    }),
  }));
  const newContentIds = new Set(domains.flatMap((d) => d.rows.flatMap((row) => row.contents || [])).map(lineage));
  if (oldContents.some((c) => c.themes?.length && !newContentIds.has(lineage(c))))
    warnings.push('Nguồn mới đã bỏ nội dung có dấu tích; đối chiếu thay đổi trước khi gửi.');
  return {
    planLevel: 'TEAM',
    sourceMode: 'INHERITED',
    curriculumSourcePlanId: source.id,
    domains,
    themes: structuredClone(newThemes),
    breaks: structuredClone(source.breaks || []),
    branchTemplates: structuredClone(source.branchTemplates || []).map((t) => ({ ...t, sourceTemplateId: t.id })),
    ...(previous ? { remapWarnings: [...new Set(warnings)] } : {}),
  };
}

export const removeThemeReferences = (themes, domains, branchTemplates, themeId) => ({
  themes: themes.filter((t) => t.id !== themeId),
  branchTemplates: branchTemplates.filter((t) => String(t.themeId) !== String(themeId)),
  domains: domains.map((d) => ({
    ...d,
    rows: d.rows.map((row) =>
      row.kind === 'goal' ? { ...row, contents: row.contents.map((c) => ({ ...c, themes: c.themes.filter((t) => t !== themeId) })) } : row,
    ),
  })),
});

// EDU-62: chỉ áp lại thông tin riêng và dấu tích còn có trong cây mới do máy chủ trả.
export const reapplyTeamDraft = (fresh, draft) => {
  const oldContents = new Map(
    (draft.domains || []).flatMap((d) => d.rows.flatMap((r) => (r.contents || []).map((c) => [String(c.id), c]))),
  );
  const draftRows = new Map((draft.domains || []).flatMap((d) => (d.rows || []).map((r) => [String(r.id), r])));
  return {
    ...fresh,
    title: draft.title,
    description: draft.description,
    domains: fresh.domains.map((d) => ({
      ...d,
      rows: d.rows.map((r) => ({
        ...r,
        ...(r.contents
          ? {
              contents: (() => {
                const freshIds = new Set(r.contents.map((c) => String(c.id)));
                const localExtras = (draftRows.get(String(r.id))?.contents || []).filter((c) => !freshIds.has(String(c.id)));
                return [...r.contents, ...localExtras].map((c) => {
                  const old = oldContents.get(String(c.id));
                  return {
                    ...c,
                    ...(old ? { text: old.text ?? c.text, themes: old.themes || [] } : {}),
                  };
                });
              })(),
            }
          : {}),
      })),
    })),
  };
};
