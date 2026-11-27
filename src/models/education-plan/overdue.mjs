// Spec 005 FR-021a: dòng của màn "Kế hoạch quá hạn" (chỉ Hiệu trưởng). Quyền mở và trạng thái hạn do BE trả
// (canExtend / timeLock.canUnlock); FE chỉ gom và lọc để hiển thị. EDU-109 (9): một hạn hiệu lực = extendedTo ?? deadline,
// một thao tác Mở hạn; loại gửi/duyệt chỉ suy từ trạng thái (Chờ duyệt ⇒ duyệt).

export const OVERDUE_KIND_LABEL = {
  SCHOOL_YEAR: 'Kế hoạch năm học',
  TEAM: 'Kế hoạch tổ',
  semester: 'Kế hoạch giáo dục chủ đề',
  dossier: 'Kế hoạch giáo dục ngày',
};

export const OVERDUE_DEADLINE_LABEL = { send: 'Quá hạn gửi', review: 'Quá hạn duyệt' };

/** Chỉ lấy hồ sơ lớp đúng dòng đã mở và đúng nguồn tổ đang xem. */
export function overdueClassTarget(docs, { docKey, classId, planId, semesterNo, themeId }) {
  if (!docKey || !classId || !planId) return null;
  return (
    docs.find(
      (doc) =>
        String(doc.id) === docKey &&
        String(doc.classId) === classId &&
        String(doc.yearPlanId) === planId &&
        (semesterNo ? String(doc.semesterNo) === semesterNo : themeId != null && String(doc.themeId) === themeId),
    ) || null
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;
const daysSince = (iso, today) => (iso ? Math.max(0, Math.round((Date.parse(today) - Date.parse(iso)) / DAY_MS)) : null);
const isExtend = (h) => ['extend', 'reopen_review_deadline'].includes(h?.action?.toLowerCase());
const lastExtend = (history = []) => [...history].reverse().find(isExtend);
const kindOf = (status) => (status === 'REVIEW' ? 'review' : 'send');

/**
 * Gộp kế hoạch giáo dục chủ đề, kế hoạch giáo dục ngày, kế hoạch năm/tổ thành dòng: { key, kind, docKey?, planId?, classId, className, ageGroupId,
 * title, semesterNo, deadline, daysOverdue, status, version, overdue, extension, doc }.
 */
export function overdueRows({ semesterPackages = [], themeDossiers = [], yearPlans = [], classes = [], themeNameOf = () => '', today }) {
  const cls = (id) => classes.find((c) => c.id === id);
  const semesterOf = (d) =>
    semesterPackages.find(
      (p) => p.classId === d.classId && p.yearPlanId === d.yearPlanId && (p.themeIds || []).map(String).includes(String(d.themeId)),
    )?.semesterNo ?? null;
  const classRows = [...semesterPackages.map((d) => ({ d, kind: 'semester' })), ...themeDossiers.map((d) => ({ d, kind: 'dossier' }))].map(
    ({ d, kind }) => {
      const ext = lastExtend(d.history);
      const deadline = d.extendedTo ?? d.deadline ?? null;
      return {
        key: `${kind}-${d.id}`,
        kind,
        docKey: d.id,
        classId: d.classId,
        className: cls(d.classId)?.name || '—',
        ageGroupId: String(cls(d.classId)?.ageGroupId ?? ''),
        title: kind === 'semester' ? `Học kỳ ${d.semesterNo}` : themeNameOf(d),
        semesterNo: kind === 'semester' ? d.semesterNo : semesterOf(d),
        deadline,
        daysOverdue: d.daysLeft != null ? Math.max(0, -d.daysLeft) : daysSince(deadline, today),
        status: d.status,
        version: d.version,
        deadlineKind: kindOf(d.status),
        overdue: !!d.canExtend,
        extensionKind: kindOf(d.status),
        extension: ext
          ? { deadline: ext.deadline, by: ext.by, note: ext.note, at: ext.at }
          : d.extendedTo
            ? { deadline: d.extendedTo }
            : null,
        doc: d,
      };
    },
  );
  const planRows = yearPlans
    .filter((p) => p.timeLock)
    .map((p) => {
      const deadline = p.timeLock.extendedTo ?? p.timeLock.deadline ?? null;
      return {
        key: `plan-${p.id}`,
        kind: p.planLevel === 'SCHOOL_YEAR' ? 'SCHOOL_YEAR' : 'TEAM',
        planId: p.id,
        classId: null,
        className: '—',
        ageGroupId: String(p.ageGroupId ?? ''),
        title: p.title,
        semesterNo: null,
        deadline,
        daysOverdue: p.timeLock.daysLeft != null ? Math.max(0, -p.timeLock.daysLeft) : daysSince(deadline, today),
        status: p.status,
        deadlineKind: kindOf(p.status),
        overdue: !!p.timeLock.canUnlock,
        extensionKind: kindOf(p.status),
        extension: p.timeLock.extendedTo ? { deadline: p.timeLock.extendedTo } : null,
        doc: p,
      };
    });
  return [...planRows, ...classRows].filter((row) => row.status !== 'APPROVED');
}

/** tab: 'overdue' (đang quá hạn, mở được) | 'extended' (đã mở hạn); các bộ lọc rỗng = tất cả. */
export function filterOverdue(
  rows,
  { tab = 'overdue', deadlineKind = '', ageGroupId = '', classId = '', kind = '', semesterNo = '' } = {},
) {
  return rows.filter(
    (r) =>
      (tab === 'overdue' ? r.overdue : !!r.extension) &&
      (!deadlineKind || (tab === 'overdue' ? r.deadlineKind : r.extensionKind) === deadlineKind) &&
      (!ageGroupId || r.ageGroupId === String(ageGroupId)) &&
      (!classId || String(r.classId) === String(classId)) &&
      (!kind || r.kind === kind) &&
      (!semesterNo || String(r.semesterNo) === String(semesterNo)),
  );
}
