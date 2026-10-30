import { usePlanChanges } from '@/hooks/education-plan/usePlanChanges';
import { CLASS_DOC, branchNumber, todayIso } from '@/models/education-plan/classPlan';
import { copyDocToVersion, isThemeOngoing, unresolvedFlags, versionFlags } from '@/models/education-plan/planVersions.mjs';

/**
 * Tài liệu lớp theo phiên bản kế hoạch năm (BE:EDU-26): ô đỏ của bản chép và bản cũ có thể chép khi chưa có tài liệu
 * trên phiên bản hiện hành. docs = mọi tài liệu cùng loại của lớp; target = { themeId, weekStart, weekNo } của trang.
 */
export function useDocVersion(kind, doc, ctx, docs, target = {}) {
  const plan = ctx.yearPlan;
  const source = doc?.sourceDocKey ? docs.find((d) => d.id === doc.sourceDocKey) : null;
  const fromPlanId = source?.yearPlanId || (!doc && ctx.previousPlan?.id) || null;
  const enabled = !!plan && !!fromPlanId && fromPlanId !== plan.id && !ctx.superseded;
  const { data: changes } = usePlanChanges(plan?.id, fromPlanId, enabled);
  const today = todayIso();
  const flags = enabled && changes ? versionFlags(kind, doc, changes, plan, today) : [];

  let prevDoc = null;
  if (!doc && enabled && changes && ctx.previousPlan) {
    const prevId = ctx.previousPlan.id;
    const fromTheme = target.themeId ? changes.themes.find((t) => String(t.id) === target.themeId)?.fromId : null;
    const same = docs.filter((d) => d.classId === ctx.cls?.id && d.yearPlanId === prevId);
    if (kind === CLASS_DOC.BRANCH) prevDoc = same[0] || null;
    else if (fromTheme != null) {
      const ofTheme = same
        .filter((d) => d.themeId === String(fromTheme))
        .sort((a, b) => (a.weekStart || '').localeCompare(b.weekStart || ''));
      prevDoc = kind === CLASS_DOC.THEME ? ofTheme[0] || null : ofTheme[branchNumber(plan, target.weekStart) - 1] || ofTheme.at(-1) || null;
    }
  }
  const theme = target.themeId ? plan?.themes.find((t) => t.id === target.themeId) : null;
  return {
    changes,
    flags,
    unresolved: unresolvedFlags(flags, doc),
    prevDoc,
    // Chủ đề đã kết thúc: không đỏ, không bắt chép (FR-025)
    finished: !!theme && !isThemeOngoing(theme, today) && !!ctx.previousPlan,
    copy: () => copyDocToVersion(kind, prevDoc, changes, plan, target),
    flagOf: (goalId) => flags.find((f) => f.goalId === String(goalId)) || null,
  };
}
