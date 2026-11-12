// Spec 005 FR-021a: dòng của màn "Kế hoạch quá hạn" (chỉ Hiệu trưởng). Quyền mở và trạng thái hạn do BE trả
// (canExtend / timeLock.canUnlock, deadlineState); FE chỉ gom và lọc để hiển thị.

export const OVERDUE_KIND_LABEL = {
  SCHOOL_YEAR: 'Kế hoạch năm học',
  TEAM: 'Kế hoạch tổ',
  semester: 'Gói học kỳ',
  dossier: 'Hồ sơ chủ đề',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const daysSince = (iso, today) => (iso ? Math.max(0, Math.round((Date.parse(today) - Date.parse(iso)) / DAY_MS)) : null);
const lastExtend = (history = []) => [...history].reverse().find((h) => h.action === 'extend') || null;

/**
 * Gộp gói học kỳ, hồ sơ chủ đề, kế hoạch năm/tổ thành dòng: { key, kind, docKey?, planId?, classId, className, ageGroupId,
 * title, semesterNo, deadline, daysOverdue, status, version, overdue, extension, doc }.
 */
export function overdueRows({ semesterPackages = [], themeDossiers = [], yearPlans = [], classes = [], themeNameOf = () => '', today }) {
  const cls = (id) => classes.find((c) => c.id === id);
  const semesterOf = (d) =>
    semesterPackages.find((p) => p.classId === d.classId && (p.themeIds || []).map(String).includes(String(d.themeId)))?.semesterNo ?? null;
  const classRows = [...semesterPackages.map((d) => ({ d, kind: 'semester' })), ...themeDossiers.map((d) => ({ d, kind: 'dossier' }))].map(
    ({ d, kind }) => {
      const ext = lastExtend(d.history);
      return {
        key: `${kind}-${d.id}`,
        kind,
        docKey: d.id,
        classId: d.classId,
        className: cls(d.classId)?.name || '—',
        ageGroupId: String(cls(d.classId)?.ageGroupId ?? ''),
        title: kind === 'semester' ? `Học kỳ ${d.semesterNo}` : themeNameOf(d),
        semesterNo: kind === 'semester' ? d.semesterNo : semesterOf(d),
        deadline: d.deadline || null,
        daysOverdue: d.daysLeft != null ? Math.max(0, -d.daysLeft) : daysSince(d.deadline, today),
        status: d.status,
        version: d.version,
        overdue: !!d.canExtend && d.status !== 'APPROVED',
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
    .map((p) => ({
      key: `plan-${p.id}`,
      kind: p.planLevel === 'SCHOOL_YEAR' ? 'SCHOOL_YEAR' : 'TEAM',
      planId: p.id,
      classId: null,
      className: '—',
      ageGroupId: String(p.ageGroupId ?? ''),
      title: p.title,
      semesterNo: null,
      deadline: p.timeLock.deadline || null,
      daysOverdue: daysSince(p.timeLock.extendedTo || p.timeLock.deadline, today),
      status: p.status,
      overdue: !!p.timeLock.canUnlock,
      extension: p.timeLock.extendedTo ? { deadline: p.timeLock.extendedTo } : null,
      doc: p,
    }));
  return [...planRows, ...classRows];
}

/** tab: 'overdue' (đang quá hạn, mở được) | 'extended' (đã mở hạn); các bộ lọc rỗng = tất cả. */
export function filterOverdue(rows, { tab = 'overdue', ageGroupId = '', classId = '', kind = '', semesterNo = '' } = {}) {
  return rows.filter(
    (r) =>
      (tab === 'overdue' ? r.overdue : !!r.extension) &&
      (!ageGroupId || r.ageGroupId === String(ageGroupId)) &&
      (!classId || r.classId === classId) &&
      (!kind || r.kind === kind) &&
      (!semesterNo || String(r.semesterNo) === String(semesterNo)),
  );
}
