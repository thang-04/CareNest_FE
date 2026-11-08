import { calendarPlan } from '@/models/education-plan/branchCalendar.mjs';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Eye, Send } from '@/components/ui/icons';
import { SIGNER_SHORT } from '@/components/education-plan/reviewUi';
import { ROLES } from '@/models/User';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { toRows } from '@/models/education-plan/goalTable';
import { PENDING_OF } from '@/models/education-plan/eduConfig';
import { currentPlanOf, previousPlanOf } from '@/models/education-plan/planVersions.mjs';

/** Bước còn thiếu khi tài liệu chưa thể bắt đầu (lock = kết quả createBlocker). */
export const lockTarget = (lock, base, themeId) =>
  lock.need === 'branch'
    ? { to: base.replace('/class/', '/branches/'), label: 'Mở Chủ đề nhánh' }
    : { to: `${base}/themes/${themeId}`, label: 'Mở kế hoạch chủ đề' };

// Ô nhập trong bảng đã chuyển lên phần chung (dùng cả ở Đánh giá hằng ngày)
export { Cell, focusCell } from '@/components/ui/TableCell';

/* ---------- Lớp, kế hoạch năm đã ban hành và vai trò của người dùng với lớp ---------- */

/** Dữ liệu dùng chung của màn lớp. Kế hoạch năm chỉ dùng bản đã được Phó HT ban hành. */
export function useClassPlanContext(classId) {
  // Lớp, giáo viên, tổ trưởng nạp cùng tài liệu của lớp (theo phạm vi người xem)
  const { user, goals, schoolYear, classes, branchPlans, creationCapabilities, staff: users } = useEducationPlan();
  const cls = classes.find((c) => c.id === classId) || null;
  // Phiên bản hiện hành = bản đã ban hành mới nhất (BE:EDU-25); phiên bản trước để chép tài liệu cũ
  const current = cls ? currentPlanOf(goals, cls.ageGroupId, schoolYear) : null;
  // ?plan=<id>: xem tài liệu của một phiên bản cũ đã ban hành cùng nhóm tuổi (chỉ xem, BE:EDU-26)
  const [params] = useSearchParams();
  const pinned =
    current &&
    goals.find(
      (g) =>
        g.id === params.get('plan') &&
        (!g.planLevel || g.planLevel === 'TEAM') &&
        g.status === EDU_STATUS.APPROVED &&
        g.ageGroupId === current.ageGroupId,
    );
  const raw = pinned || current;
  const rawPrevious = raw ? previousPlanOf(goals, raw) : null;
  const asRows = (p) =>
    p ? { ...p, domains: p.domains.map((d) => ({ ...d, rows: toRows(d, () => Math.random().toString(36).slice(2, 9)) })) } : null;
  // Kế hoạch năm dạng hàng của bảng (giống trang mục tiêu năm)
  const yearPlan = useMemo(() => {
    const approved = branchPlans.find((b) => b.classId === classId && b.yearPlanId === raw?.id && b.status === EDU_STATUS.APPROVED);
    return raw ? calendarPlan(asRows(raw), approved) : null;
  }, [raw, branchPlans, classId]);
  const previousPlan = useMemo(() => asRows(rawPrevious), [rawPrevious]);
  const pending = cls
    ? goals.find((g) => (!g.planLevel || g.planLevel === 'TEAM') && g.ageGroupId === cls.ageGroupId && g.schoolYear === schoolYear)
    : null;
  const teachers = cls ? (cls.teacherIds || []).map((id) => users.find((u) => u.id === id)).filter(Boolean) : [];
  const leaders = cls ? users.filter((u) => u.role === ROLES.TEAM_LEADER && u.ageGroupId === cls.ageGroupId) : [];
  const isClassTeacher = !!cls && (cls.teacherIds || []).includes(user.id);
  // Mỗi giáo viên chỉ được xếp một lớp: người có lớp chỉ làm việc với lớp đó, không có ô chọn lớp
  const canPickClass = classes.length > 1 && !classes.some((c) => (c.teacherIds || []).includes(user.id));
  const isGroupLeader = user.role === ROLES.TEAM_LEADER && !!cls && user.ageGroupId === cls.ageGroupId;
  const isVp = user.role === ROLES.VICE_PRINCIPAL;
  // Chỉ để hiển thị chuỗi duyệt dự kiến; bước thật do service quyết định khi gửi
  const skipLeader = !leaders.length || leaders.some((u) => (cls?.teacherIds || []).includes(u.id));
  return {
    cls,
    classes,
    loading: false,
    yearPlan,
    previousPlan,
    // Đang xem phiên bản đã bị thay thế: mọi tài liệu chỉ xem
    superseded: !!raw && raw.id !== current?.id,
    pendingYearPlan: pending,
    teachers,
    users,
    isClassTeacher,
    canCreate: (kind) => creationCapabilities.some((cap) => String(cap.classId) === String(classId) && cap.kind === kind && cap.canCreate),
    canPickClass,
    isGroupLeader,
    isVp,
    skipLeader,
  };
}

/* ---------- Gửi, duyệt (ký tay trên bản in) ---------- */

/** Đến lượt người dùng duyệt tài liệu: trạng thái chờ đúng vai trò; tổ trưởng phải là tổ trưởng của khối (chỉ là UX). */
export const isMyReviewTurn = (doc, ctx, user) => {
  if (!doc) return false;
  if (doc.permissions)
    return !!(doc.permissions.canApprove ?? doc.permissions.canIssue) || !!(doc.permissions.canReject ?? doc.permissions.canReturn);
  if (doc.status === 'REVIEW' && (doc.review?.waitingRole ?? doc.waitingRole) === user.role) {
    return user.role !== ROLES.TEAM_LEADER || ctx.isGroupLeader;
  }
  return doc.status === PENDING_OF[user.role] && (user.role !== ROLES.TEAM_LEADER || ctx.isGroupLeader);
};

const isOpen = (doc) => !doc?.status || doc.status === EDU_STATUS.DRAFT || doc.status === EDU_STATUS.REJECTED;

/**
 * Nhãn nút sang trang gửi / duyệt theo việc người dùng cần làm. Kế hoạch chủ đề chỉ gửi ở cuối trang xem cả tập,
 * nên ở trang soạn chỉ có nút "Xem cả kế hoạch chủ đề" (tên theo file mẫu "KHGD CĐ" của MN Thái Dương).
 */
export function reviewLabel(doc, ctx, user, kind = 'branch') {
  if (kind !== 'branch') {
    if (isMyReviewTurn(doc, ctx, user)) return 'Duyệt kế hoạch chủ đề';
    // Giáo viên còn sửa được: gửi duyệt ở trang kế hoạch chủ đề
    return ctx.isClassTeacher && isOpen(doc) ? 'Gửi duyệt' : 'Xem kế hoạch chủ đề';
  }
  if (isMyReviewTurn(doc, ctx, user)) return 'Duyệt';
  if (ctx.isClassTeacher && isOpen(doc)) return 'Gửi duyệt';
  return 'Xem';
}

/**
 * Quyền hiển thị nút gửi / duyệt tài liệu của lớp theo mẫu chung (reviewUi) và người duyệt đầu tiên của chuỗi:
 * chủ đề nhánh theo eduConfig.signers.branch, hồ sơ chủ đề theo signers.week; bỏ Tổ trưởng khi ctx.skipLeader.
 * Chỉ là UX, service quyết định khi gửi.
 */
export function docReview(kind, doc, ctx, user, eduConfig) {
  const policy = eduConfig?.workflowPolicy?.[kind === 'branch' ? 'branch' : 'theme'];
  const chain = (policy?.reviewers || eduConfig?.signers?.[kind === 'branch' ? 'branch' : 'week'] || []).filter(
    (r) => r !== ROLES.TEAM_LEADER || !ctx.skipLeader,
  );
  const myTurn = isMyReviewTurn(doc, ctx, user);
  return {
    can: {
      send: doc?.permissions ? doc.permissions.canSubmit : ctx.isClassTeacher && !!doc && isOpen(doc),
      reject: doc?.permissions ? (doc.permissions.canReject ?? doc.permissions.canReturn) : myTurn,
      approve: doc?.permissions ? (doc.permissions.canApprove ?? doc.permissions.canIssue) : myTurn,
    },
    sendTo: chain.length ? SIGNER_SHORT[chain[0]] || chain[0] : 'đi',
  };
}

/**
 * Nút sang trang hồ sơ để xem / gửi / duyệt. Luôn bấm được (Tiền 05/11): còn thay đổi chưa lưu thì lưu trước (onSave)
 * rồi mới sang (onGoNow, không hỏi rời trang); lưu lỗi thì ở lại.
 */
export function DocReviewButton({
  kind,
  doc,
  dossier,
  ctx,
  user,
  reviewTo,
  dirty,
  onGo,
  onSave,
  onGoNow,
  className = 'btn btn--outline-primary btn--sm',
}) {
  const holder = kind === 'week' ? dossier : doc;
  const label = reviewLabel(holder, ctx, user, kind === 'branch' ? 'branch' : 'theme');
  const go = async () => {
    if (dirty && onSave) {
      if (!(await onSave())) return;
      return (onGoNow || onGo)(reviewTo);
    }
    onGo(reviewTo);
  };
  return (
    <button type="button" className={className} title={dirty && onSave ? 'Lưu rồi sang trang kế hoạch chủ đề' : undefined} onClick={go}>
      {label.startsWith('Duyệt') ? (
        <Check size={16} aria-hidden />
      ) : label.includes('gửi') || label.startsWith('Gửi') ? (
        <Send size={16} aria-hidden />
      ) : (
        <Eye size={16} aria-hidden />
      )}{' '}
      {label}
    </button>
  );
}
