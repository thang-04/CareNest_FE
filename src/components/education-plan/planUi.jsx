import { useMemo } from 'react';
import { Check, Eye, Send } from '@/components/ui/icons';
import { Card, EduStatusBadge } from '@/components/education-plan/eduUi';
import { RejectedNotice, SIGNER_SHORT } from '@/components/education-plan/reviewUi';
import { ROLES } from '@/models/User';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { toRows } from '@/models/education-plan/goalTable';
import { PENDING_OF } from '@/models/education-plan/eduConfig';

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
  const { user, goals, schoolYear, classes, staff: users } = useEducationPlan();
  const cls = classes.find((c) => c.id === classId) || null;
  const raw = cls
    ? goals.find((g) => g.ageGroupId === cls.ageGroupId && g.schoolYear === schoolYear && g.status === EDU_STATUS.APPROVED)
    : null;
  // Kế hoạch năm dạng hàng của bảng (giống trang mục tiêu năm)
  const yearPlan = useMemo(
    () =>
      raw ? { ...raw, domains: raw.domains.map((d) => ({ ...d, rows: toRows(d, () => Math.random().toString(36).slice(2, 9)) })) } : null,
    [raw],
  );
  const pending = cls ? goals.find((g) => g.ageGroupId === cls.ageGroupId && g.schoolYear === schoolYear) : null;
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
    pendingYearPlan: pending,
    teachers,
    users,
    isClassTeacher,
    canPickClass,
    isGroupLeader,
    isVp,
    skipLeader,
  };
}

/* ---------- Gửi, duyệt (ký tay trên bản in) ---------- */

/** Đến lượt người dùng duyệt tài liệu: trạng thái chờ đúng vai trò; tổ trưởng phải là tổ trưởng của khối (chỉ là UX). */
export const isMyReviewTurn = (doc, ctx, user) =>
  !!doc && doc.status === PENDING_OF[user.role] && (user.role !== ROLES.TEAM_LEADER || ctx.isGroupLeader);

const isOpen = (doc) => !doc?.status || doc.status === EDU_STATUS.DRAFT || doc.status === EDU_STATUS.REJECTED;

/**
 * Nhãn nút sang trang gửi / duyệt theo việc người dùng cần làm. Kế hoạch chủ đề chỉ gửi ở cuối trang xem cả tập,
 * nên ở trang soạn chỉ có nút "Xem cả kế hoạch chủ đề" (tên theo file mẫu "KHGD CĐ" của MN Thái Dương).
 */
export function reviewLabel(doc, ctx, user, kind = 'branch') {
  if (kind !== 'branch') {
    if (isMyReviewTurn(doc, ctx, user)) return 'Duyệt kế hoạch chủ đề';
    // Giáo viên còn sửa được: nói rõ việc gửi duyệt nằm ở trang xem cả tập
    return ctx.isClassTeacher && isOpen(doc) ? 'Xem và gửi duyệt' : 'Xem cả kế hoạch chủ đề';
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
  const chain = (eduConfig?.signers?.[kind === 'branch' ? 'branch' : 'week'] || []).filter(
    (r) => r !== ROLES.TEAM_LEADER || !ctx.skipLeader,
  );
  const myTurn = isMyReviewTurn(doc, ctx, user);
  return {
    can: { send: ctx.isClassTeacher && !!doc && isOpen(doc), reject: myTurn, approve: myTurn },
    sendTo: chain.length ? SIGNER_SHORT[chain[0]] : 'đi',
  };
}

/**
 * Dòng trạng thái ở trang soạn: trạng thái, lý do bị trả lại và nút sang trang gửi / duyệt.
 * Giáo án tuần và kế hoạch chủ đề đi theo cả tập kế hoạch giáo dục chủ đề (bản ghi kế hoạch chủ đề).
 */
export function DocStatusStrip({ kind, doc, dossier, ctx, user, reviewTo, dirty, onGo }) {
  const holder = kind === 'week' ? dossier : doc;
  const status = holder?.status || EDU_STATUS.DRAFT;
  const label = reviewLabel(holder, ctx, user, kind === 'branch' ? 'branch' : 'theme');
  const blocked = dirty || (kind !== 'week' && !doc?.id);
  return (
    <Card>
      <div className="stack">
        <div className="row row--between row--wrap gap-3">
          {/* Trạng thái đã hiện ở đầu trang; giáo án tuần thì hiện trạng thái cả kế hoạch chủ đề */}
          {kind === 'week' ? (
            <div className="row row--wrap gap-2">
              <span className="muted text-sm">Kế hoạch chủ đề:</span>
              <EduStatusBadge status={status} />
            </div>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="btn btn--outline-primary btn--sm"
            disabled={blocked}
            title={blocked ? 'Lưu trước khi sang trang khác' : undefined}
            onClick={() => onGo(reviewTo)}
          >
            {label.startsWith('Duyệt') ? (
              <Check size={16} aria-hidden />
            ) : label.includes('gửi') || label.startsWith('Gửi') ? (
              <Send size={16} aria-hidden />
            ) : (
              <Eye size={16} aria-hidden />
            )}{' '}
            {label}
          </button>
        </div>
        <RejectedNotice status={holder?.status} history={holder?.history} />
      </div>
    </Card>
  );
}
