/*
 * Phiên bản kế hoạch năm và tài liệu lớp theo phiên bản (BE:EDU-25/26, specs/004-year-plan-versioning).
 * Thay đổi giữa hai phiên bản do BE so sánh (GET /goals/{id}/changes); ở đây chỉ chép tài liệu sang id mới và chỉ ra ô
 * cần sửa để hiển thị. BE kiểm lại khi gửi duyệt. diffPlans chỉ dùng cho mock (BE giả).
 */
import { DOMAINS } from '@/models/education-plan/educationPlanConstants';
import { numberGoals, toRows } from '@/models/education-plan/goalTable';
import { addDays, CLASS_DOC, themeGoalBlocks, yearWeeks } from '@/models/education-plan/classPlan';

export const CHANGE = { UNCHANGED: 'UNCHANGED', CHANGED: 'CHANGED', REMOVED: 'REMOVED', ADDED: 'ADDED' };

export const versionOf = (plan) => Number(plan?.versionNo) || 1;

const sameChain = (a, b) => a.ageGroupId === b.ageGroupId && a.schoolYear === b.schoolYear;

/** Các phiên bản cùng (năm học, nhóm tuổi), theo số phiên bản tăng dần. */
export const chainOf = (goals, plan) => (plan ? goals.filter((g) => sameChain(g, plan)).sort((a, b) => versionOf(a) - versionOf(b)) : []);

/** Phiên bản hiện hành: đã ban hành, số lớn nhất (BE:EDU-25). */
export const currentPlanOf = (goals, ageGroupId, schoolYear) =>
  goals
    .filter((g) => g.ageGroupId === ageGroupId && g.schoolYear === schoolYear && g.status === 'APPROVED')
    .sort((a, b) => versionOf(b) - versionOf(a))[0] || null;

/** Phiên bản đã ban hành ngay trước plan (nguồn để chép tài liệu lớp). */
export const previousPlanOf = (goals, plan) =>
  chainOf(goals, plan)
    .filter((g) => g.status === 'APPROVED' && versionOf(g) < versionOf(plan))
    .at(-1) || null;

/** Khóa Web giáo án tuần: phiên bản ≥2 thêm id kế hoạch năm để không trùng tuần của phiên bản cũ (BE kiểm khớp). */
export const weekDocId = (classId, weekStart, plan) => `wp_${classId}_${weekStart}${versionOf(plan) > 1 ? `_${plan.id}` : ''}`;

export const isThemeOngoing = (theme, today) => !!theme && (!theme.end || theme.end >= today);

/* ---------- So sánh (mock) ---------- */

const lineage = (x) => String(x.lineageId ?? x.id);
const trim = (s) => String(s ?? '').trim();

const snapshot = (plan) => {
  const domains = DOMAINS.map((name) => (plan.domains || []).find((d) => d.name === name))
    .filter(Boolean)
    .map((d) => ({ ...d, rows: toRows(d, () => Math.random().toString(36).slice(2)) }));
  const numbers = numberGoals(domains);
  const themeLineage = new Map((plan.themes || []).map((t) => [t.id, lineage(t)]));
  const goals = [];
  const contents = [];
  domains.forEach((d) =>
    d.rows.forEach((r) => {
      if (r.kind !== 'goal' || !numbers[r.id]) return;
      goals.push({ id: r.id, lineage: lineage(r), goalNo: numbers[r.id], text: r.text });
      (r.contents || []).forEach((c) =>
        contents.push({
          id: c.id,
          lineage: lineage(c),
          goalLineage: lineage(r),
          text: c.text,
          themes: [...new Set((c.themes || []).map((t) => themeLineage.get(t)).filter(Boolean))].sort().join('|'),
        }),
      );
    }),
  );
  const themes = (plan.themes || []).map((t) => ({ ...t, lineage: lineage(t) }));
  return { goals, contents, themes };
};

const compareList = (from, to, fieldsOf, shape) => {
  const old = new Map(from.map((x) => [x.lineage, x]));
  const seen = new Set();
  const out = to.map((x) => {
    const before = old.get(x.lineage);
    seen.add(x.lineage);
    if (!before) return shape(x, null, CHANGE.ADDED, []);
    const fields = fieldsOf(before, x);
    return shape(x, before, fields.length ? CHANGE.CHANGED : CHANGE.UNCHANGED, fields);
  });
  from.filter((x) => !seen.has(x.lineage)).forEach((x) => out.push(shape(null, x, CHANGE.REMOVED, [])));
  return out;
};

/** Cùng quy tắc BE research R6: đổi số MT/thứ tự/lĩnh vực không tính; MT đổi khi câu hoặc nội dung của nó đổi. */
export function diffPlans(from, to) {
  const a = snapshot(from);
  const b = snapshot(to);
  const contents = compareList(
    a.contents,
    b.contents,
    (x, y) => [...(trim(x.text) !== trim(y.text) ? ['text'] : []), ...(x.themes !== y.themes ? ['themes'] : [])],
    (now, before, change, fields) => ({
      lineageId: (now || before).lineage,
      id: now?.id ?? null,
      fromId: before?.id ?? null,
      goalLineageId: (now || before).goalLineage,
      change,
      fields,
      text: (now || before).text,
    }),
  );
  const touched = new Set(contents.filter((c) => c.change !== CHANGE.UNCHANGED).map((c) => c.goalLineageId));
  const goals = compareList(
    a.goals,
    b.goals,
    (x, y) => [...(trim(x.text) !== trim(y.text) ? ['text'] : []), ...(touched.has(y.lineage) ? ['contents'] : [])],
    (now, before, change, fields) => ({
      lineageId: (now || before).lineage,
      id: now?.id ?? null,
      fromId: before?.id ?? null,
      change,
      fields,
      goalNo: now?.goalNo ?? null,
      fromGoalNo: before?.goalNo ?? null,
      text: now?.text ?? null,
      fromText: before?.text ?? null,
    }),
  );
  const themes = compareList(
    a.themes,
    b.themes,
    (x, y) => [
      ...(trim(x.name) !== trim(y.name) ? ['name'] : []),
      ...(trim(x.abbr) !== trim(y.abbr) ? ['abbr'] : []),
      ...((x.start || '') !== (y.start || '') || (x.end || '') !== (y.end || '') ? ['dates'] : []),
    ],
    (now, before, change, fields) => ({
      lineageId: (now || before).lineage,
      id: now?.id ?? null,
      fromId: before?.id ?? null,
      change,
      fields,
      name: now?.name ?? null,
      fromName: before?.name ?? null,
    }),
  );
  return { planId: to.id, versionNo: versionOf(to), fromPlanId: from.id, fromVersionNo: versionOf(from), goals, contents, themes };
}

/* ---------- Chép tài liệu lớp sang phiên bản mới ---------- */

const idMap = (list) => new Map((list || []).filter((x) => x.fromId != null && x.id != null).map((x) => [String(x.fromId), String(x.id)]));

const clone = (v) => JSON.parse(JSON.stringify(v ?? null));

const SERVER_FIELDS = ['status', 'approvals', 'history', 'adjustments', 'superseded', 'yearPlanVersion', 'sourceDocKey', 'versionChecks'];

/**
 * Bản chép Nháp trên phiên bản plan từ source (phiên bản cũ): đổi id MT/chủ đề theo lineage; tham chiếu tới mục bị bỏ
 * giữ nguyên để hiện đỏ (FR-023). week: { weekStart, weekNo, themeId } của tuần đích.
 */
export function copyDocToVersion(kind, source, changes, plan, week = {}) {
  const goals = idMap(changes.goals);
  const themes = idMap(changes.themes);
  const goalNo = new Map((changes.goals || []).filter((g) => g.id != null).map((g) => [String(g.id), g.goalNo]));
  const doc = clone(source);
  SERVER_FIELDS.forEach((f) => delete doc[f]);
  Object.assign(doc, {
    yearPlanId: plan.id,
    sourceDocKey: source.id,
    versionChecks: [],
    status: 'DRAFT',
    approvals: [],
    history: [],
  });
  if (kind === CLASS_DOC.BRANCH) {
    doc.id = `bp_${source.classId}_${plan.id}`;
    return doc;
  }
  doc.themeId = kind === CLASS_DOC.WEEK && week.themeId ? week.themeId : themes.get(String(source.themeId)) || source.themeId;
  if (kind === CLASS_DOC.THEME) {
    doc.id = `tp_${source.classId}_${doc.themeId}`;
    doc.rows = Object.fromEntries(Object.entries(source.rows || {}).map(([id, row]) => [goals.get(id) || id, clone(row)]));
    return doc;
  }
  const weekStart = week.weekStart || source.weekStart;
  Object.assign(doc, { id: weekDocId(source.classId, weekStart, plan), weekStart, weekNo: week.weekNo ?? source.weekNo });
  doc.days = (doc.days || []).map((d, i) => ({ ...d, date: addDays(weekStart, i) }));
  doc.picks = Object.fromEntries(
    Object.entries(source.picks || {}).map(([cell, list]) => [
      cell,
      (list || []).map((p) => {
        const to = goals.get(String(p.goalId));
        return to ? { ...p, goalId: to, goalNo: goalNo.get(to) ?? p.goalNo, id: String(p.id).replace(/^[^#]*/, to) } : { ...p };
      }),
    ]),
  );
  return doc;
}

/** Kế hoạch chủ đề chép: giữ dòng của MT không còn ở phiên bản (đỏ) tới khi giáo viên bỏ, không tự mất khi lưu. */
export const danglingRows = (doc, plan) => {
  if (!doc?.sourceDocKey) return {};
  const ids = new Set(plan.domains.flatMap((d) => d.rows.filter((r) => r.kind === 'goal').map((r) => r.id)));
  return Object.fromEntries(Object.entries(doc.rows || {}).filter(([id]) => !ids.has(id)));
};

/* ---------- Ô đỏ ---------- */

const goalRefs = (kind, doc, plan) => {
  if (kind === CLASS_DOC.THEME) {
    const own = themeGoalBlocks(plan.domains, numberGoals(plan.domains), doc.themeId).flatMap((b) => b.goals.map((g) => g.id));
    return [...new Set([...Object.keys(doc.rows || {}), ...own])].map((id) => ({ goalId: id, cells: [] }));
  }
  const byGoal = new Map();
  Object.entries(doc.picks || {}).forEach(([cell, list]) =>
    (list || []).forEach((p) => byGoal.set(String(p.goalId), [...(byGoal.get(String(p.goalId)) || []), cell])),
  );
  return [...byGoal].map(([goalId, cells]) => ({ goalId, cells: [...new Set(cells)] }));
};

const FIELD_LABEL = { name: 'tên', abbr: 'viết tắt', dates: 'thời gian' };

/**
 * Ô cần sửa của bản chép theo phiên bản mới (BE:EDU-26, FR-024/025): tham chiếu không còn ở phiên bản (removed) hoặc
 * mục đã đổi (changed, hết đỏ khi đánh dấu "Đã kiểm tra"). Chủ đề đã kết thúc không đỏ.
 * Trả [{ ref, type, label, message, goalId?, cells?, week? }].
 */
export function versionFlags(kind, doc, changes, plan, today) {
  if (!doc?.sourceDocKey || !changes || !plan) return [];
  const v = changes.versionNo;
  if (kind === CLASS_DOC.BRANCH) {
    const starts = new Set(
      yearWeeks(plan)
        .filter((w) => w.type === 'week')
        .map((w) => w.start),
    );
    const weeks = Object.entries(doc.names || {})
      .filter(([start, name]) => String(name || '').trim() && !starts.has(start) && addDays(start, 4) >= today)
      .map(([start]) => ({
        ref: `week:${start}`,
        type: 'removed',
        week: start,
        label: `Tuần ${start.slice(8, 10)}/${start.slice(5, 7)}`,
        message: `Tuần này không còn là tuần học ở kế hoạch năm phiên bản ${v}. Bỏ tên nhánh của tuần này.`,
      }));
    const themes = (changes.themes || [])
      .filter(
        (t) =>
          t.change === CHANGE.CHANGED &&
          isThemeOngoing(
            plan.themes.find((x) => x.id === String(t.id)),
            today,
          ),
      )
      .map((t) => ({
        ref: `theme:${t.id}`,
        type: 'changed',
        label: `Chủ đề ${t.name}`,
        message: `Chủ đề "${t.fromName}" đã đổi ${t.fields.map((f) => FIELD_LABEL[f] || f).join(', ')} ở phiên bản ${v}. Kiểm tra tên nhánh các tuần.`,
      }));
    return [...weeks, ...themes];
  }
  const theme = plan.themes.find((t) => t.id === String(doc.themeId));
  if (!isThemeOngoing(theme, today)) return [];
  const goals = new Map((changes.goals || []).filter((g) => g.id != null).map((g) => [String(g.id), g]));
  const removed = new Map((changes.goals || []).filter((g) => g.fromId != null).map((g) => [String(g.fromId), g]));
  return goalRefs(kind, doc, plan).flatMap(({ goalId, cells }) => {
    const g = goals.get(goalId);
    if (!g) {
      const old = removed.get(goalId);
      return [
        {
          ref: `goal:${goalId}`,
          type: 'removed',
          goalId,
          cells,
          label: old?.fromGoalNo ? `MT${old.fromGoalNo} (cũ)` : 'MT cũ',
          message: `${old?.fromText ? `"${old.fromText}" ` : ''}đã bị bỏ ở kế hoạch năm phiên bản ${v}. Bỏ hoặc chọn lại mục tiêu.`,
        },
      ];
    }
    if (g.change !== CHANGE.CHANGED) return [];
    return [
      {
        ref: `goal:${goalId}`,
        type: 'changed',
        goalId,
        cells,
        label: `MT${g.goalNo}`,
        message: `MT${g.goalNo} đã đổi ở kế hoạch năm phiên bản ${v}${g.fields.includes('text') ? `: "${g.text}"` : ' (nội dung giáo dục)'}.`,
      },
    ];
  });
}

/** Ô còn đỏ: mục bị bỏ còn tham chiếu, hoặc mục đổi chưa đánh dấu "Đã kiểm tra". */
export const unresolvedFlags = (flags, doc) => flags.filter((f) => f.type === 'removed' || !(doc?.versionChecks || []).includes(f.ref));

/** Đánh dấu "Đã kiểm tra" một mục đổi. */
export const checkFlag = (doc, flag) => ({ ...doc, versionChecks: [...new Set([...(doc.versionChecks || []), flag.ref])] });

/** Bỏ tham chiếu tới mục bị bỏ (dòng kế hoạch chủ đề, hoạt động đã xếp trong ô tuần, tên nhánh của tuần). */
export function dropReference(kind, doc, flag) {
  if (kind === CLASS_DOC.BRANCH) {
    const names = { ...(doc.names || {}) };
    const notes = { ...(doc.notes || {}) };
    delete names[flag.week];
    delete notes[flag.week];
    return { ...doc, names, notes };
  }
  if (kind === CLASS_DOC.THEME) {
    const rows = { ...(doc.rows || {}) };
    delete rows[flag.goalId];
    return { ...doc, rows };
  }
  return {
    ...doc,
    picks: Object.fromEntries(
      Object.entries(doc.picks || {}).map(([cell, list]) => [cell, (list || []).filter((p) => String(p.goalId) !== flag.goalId)]),
    ),
  };
}

/** MT mới ở phiên bản (nhãn "mới", không đỏ — US4-9). */
export const addedGoalIds = (changes) => new Set((changes?.goals || []).filter((g) => g.change === CHANGE.ADDED).map((g) => String(g.id)));

/* ---------- Đánh giá trẻ theo giáo án ngày đang dùng ---------- */

const goalRowsOf = (plan) => (plan?.domains || []).flatMap((d) => (d.rows || []).filter((r) => r.kind === 'goal'));

/**
 * BE:EDU-19/26 (Tiền 28/10): đánh giá trẻ theo MT của giáo án ngày đang dùng. MT đã chấm (id của phiên bản bất kỳ) chuyển
 * sang MT cùng lineage của phiên bản targetPlanId; MT bị bỏ không còn. Id không phải MT (tiêu chí cũ) giữ nguyên.
 */
export function remapCriteriaToPlan(goals, targetPlanId, assessment) {
  const target = goals.find((g) => g.id === targetPlanId);
  if (!assessment || !target) return assessment;
  const lineage = new Map(goals.flatMap((p) => goalRowsOf(p).map((r) => [r.id, String(r.lineageId ?? r.id)])));
  const own = new Map(goalRowsOf(target).map((r) => [String(r.lineageId ?? r.id), r.id]));
  const map = (ids) => (ids ? [...new Set(ids.map((id) => (lineage.has(id) ? own.get(lineage.get(id)) : id)).filter(Boolean))] : ids);
  return {
    ...assessment,
    criteriaMet: map(assessment.criteriaMet) || [],
    criteriaNotMet: map(assessment.criteriaNotMet),
    criteriaEffort: map(assessment.criteriaEffort),
    criteriaOffered: map(assessment.criteriaOffered),
  };
}
