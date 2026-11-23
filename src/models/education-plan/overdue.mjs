// Spec 005 FR-021a: dòng của màn "Kế hoạch quá hạn" (chỉ Hiệu trưởng). Quyền mở và trạng thái hạn do BE trả
// (canExtend / timeLock.canUnlock hoặc reviewDeadline.canReopen); FE chỉ gom và lọc để hiển thị.

export const OVERDUE_KIND_LABEL = {
  SCHOOL_YEAR: 'Kế hoạch năm học',
  TEAM: 'Kế hoạch tổ',
  semester: 'Kế hoạch giáo dục chủ đề',
  dossier: 'Kế hoạch giáo dục ngày',
};

export const OVERDUE_DEADLINE_LABEL = { send: 'Quá hạn gửi', review: 'Quá hạn duyệt' };

const DAY_MS = 24 * 60 * 60 * 1000;
const daysSince = (iso, today) => (iso ? Math.max(0, Math.round((Date.parse(today) - Date.parse(iso)) / DAY_MS)) : null);
const isReviewExtension = (h) => h?.action?.toLowerCase() === 'reopen_review_deadline';
const lastExtend = (history = []) => [...history].reverse().find((h) => h.action === 'extend' || isReviewExtension(h));

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
      const reviewDeadline = d.reviewDeadline || null;
      const reviewLocked = d.status === 'REVIEW' && reviewDeadline?.locked && reviewDeadline?.canReopen;
      const extensionKind = isReviewExtension(ext) || (!ext && reviewDeadline?.reopenUntil) ? 'review' : 'send';
      return {
        key: `${kind}-${d.id}`,
        kind,
        docKey: d.id,
        classId: d.classId,
        className: cls(d.classId)?.name || '—',
        ageGroupId: String(cls(d.classId)?.ageGroupId ?? ''),
        title: kind === 'semester' ? `Học kỳ ${d.semesterNo}` : themeNameOf(d),
        semesterNo: kind === 'semester' ? d.semesterNo : semesterOf(d),
        deadline: reviewLocked ? reviewDeadline.lockFrom : d.deadline || null,
        daysOverdue: reviewLocked
          ? daysSince(reviewDeadline.lockFrom, today)
          : d.daysLeft != null
            ? Math.max(0, -d.daysLeft)
            : daysSince(d.deadline, today),
        status: d.status,
        version: d.version,
        reviewLocked,
        deadlineKind: reviewLocked ? 'review' : 'send',
        overdue: reviewLocked || (!!d.canExtend && !['APPROVED', 'REVIEW'].includes(d.status)),
        extensionKind,
        extension: ext
          ? { deadline: ext.deadline, by: ext.by, note: ext.note, at: ext.at }
          : reviewDeadline?.reopenUntil
            ? { deadline: reviewDeadline.reopenUntil, note: reviewDeadline.reason }
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
      const reviewDeadline = p.reviewDeadline || p.timeLock.reviewDeadline || null;
      const reviewLocked = p.status === 'REVIEW' && reviewDeadline?.locked && reviewDeadline?.canReopen;
      return {
        key: `plan-${p.id}`,
        kind: p.planLevel === 'SCHOOL_YEAR' ? 'SCHOOL_YEAR' : 'TEAM',
        planId: p.id,
        classId: null,
        className: '—',
        ageGroupId: String(p.ageGroupId ?? ''),
        title: p.title,
        semesterNo: null,
        deadline: reviewLocked ? reviewDeadline.lockFrom : p.timeLock.deadline || null,
        daysOverdue: reviewLocked
          ? daysSince(reviewDeadline.lockFrom, today)
          : p.timeLock.daysLeft != null
            ? Math.max(0, -p.timeLock.daysLeft)
            : daysSince(p.timeLock.extendedTo || p.timeLock.deadline, today),
        status: p.status,
        reviewLocked,
        deadlineKind: reviewLocked ? 'review' : 'send',
        overdue: reviewLocked || (!!p.timeLock.canUnlock && !['APPROVED', 'REVIEW'].includes(p.status)),
        extensionKind: reviewDeadline?.reopenUntil ? 'review' : 'send',
        extension: reviewDeadline?.reopenUntil
          ? { deadline: reviewDeadline.reopenUntil, note: reviewDeadline.reason }
          : p.timeLock.extendedTo
            ? { deadline: p.timeLock.extendedTo }
            : null,
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
