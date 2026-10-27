import { useMemo, useState } from 'react';
import { Check, Eye, Send, Undo2 } from '@/components/ui/icons';
import { Card, EduStatusBadge, Field, History, Notice, fmtDateTime } from '@/components/education-plan/eduUi';
import { useAsync } from '@/hooks/useAsync';
import { useClasses } from '@/hooks/useSchool';
import { getUsers } from '@/services/masterDataService';
import { ROLES } from '@/models/User';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { toRows } from '@/models/education-plan/goalTable';
import { submitBlocker } from '@/models/education-plan/classPlan';
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
  const { user, goals, schoolYear } = useEducationPlan();
  const { classes, loading } = useClasses();
  const usersQ = useAsync(() => getUsers(), []);
  const users = useMemo(() => usersQ.data || [], [usersQ.data]);
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
    loading: loading || usersQ.loading,
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
 * Phần gửi / duyệt ở CUỐI trang, không có chữ ký trong hệ thống (duyệt xong in ra ký tay):
 * - giáo viên của lớp: "Gửi duyệt" (chủ đề nhánh, hồ sơ chủ đề) khi còn nháp hoặc bị trả lại;
 * - người đến lượt duyệt: nhận xét rồi "Duyệt", hoặc ghi lý do rồi "Trả lại".
 * kind: branch | theme. onAct(action, body) trả tài liệu mới hoặc null. actions: nút thêm (vd. xuất / in khi đã duyệt).
 */
export function SignPanel({ kind, doc, ctx, user, dirty, onAct, title = 'Gửi duyệt và duyệt', actions }) {
  const { branchPlans, weekPlans, classThemePlans, toast } = useEducationPlan();
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(null);
  const [busy, setBusy] = useState(false);
  const status = doc?.status || EDU_STATUS.DRAFT;
  const canReview = isMyReviewTurn(doc, ctx, user);
  const canSend = ctx.isClassTeacher && !!doc && isOpen(doc);
  const lastReject = [...(doc?.history || [])].reverse().find((h) => h.tone === 'err');
  const orderBlock = canSend ? submitBlocker(kind, doc, { branchPlans, weekPlans, classThemePlans, yearPlan: ctx.yearPlan }) : null;
  const blocked = dirty || !doc?.id;
  const run = async (action) => {
    setTried(action);
    if (action === 'reject' && !note.trim()) return;
    // Chưa đủ điều kiện gửi: chỉ nhắc ở góc màn hình khi bấm, không hiện sẵn trên trang
    if (action === 'submit' && orderBlock) return toast(orderBlock, 'warn');
    setBusy(true);
    const res = await onAct(action, { note: note.trim() || undefined });
    setBusy(false);
    if (res) {
      setNote('');
      setTried(null);
    }
  };

  return (
    <Card title={title}>
      <div className="stack">
        <div className="row row--wrap gap-2">
          <EduStatusBadge status={status} />
        </div>
        {status === EDU_STATUS.REJECTED && lastReject?.note && (
          <Notice tone="err">
            Bị trả lại bởi {lastReject.by} ({fmtDateTime(lastReject.at)}): {lastReject.note}
          </Notice>
        )}
        {(canSend || canReview) && (
          <Field
            label={canReview ? 'Nhận xét (bắt buộc khi trả lại)' : 'Ghi chú gửi kèm'}
            error={tried === 'reject' && !note.trim() ? 'Vui lòng ghi lý do trả lại' : undefined}
          >
            <textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        )}
        {(canSend || canReview || actions) && (
          <div className="row row--wrap gap-2">
            {canSend && (
              <button
                type="button"
                className="btn btn--warning"
                disabled={busy || blocked}
                title={blocked ? 'Chờ lưu xong rồi gửi' : undefined}
                onClick={() => run('submit')}
              >
                <Send size={16} aria-hidden /> {kind === 'branch' ? 'Gửi duyệt' : 'Gửi duyệt kế hoạch chủ đề'}
              </button>
            )}
            {canReview && (
              <>
                <button type="button" className="btn btn--outline-danger" disabled={busy} onClick={() => run('reject')}>
                  <Undo2 size={16} aria-hidden /> Trả lại
                </button>
                <button type="button" className="btn btn--success" disabled={busy} onClick={() => run('approve')}>
                  <Check size={16} aria-hidden /> Duyệt
                </button>
              </>
            )}
            {actions}
          </div>
        )}
        <details>
          <summary className="muted text-sm">Lịch sử xử lý ({doc?.history?.length || 0})</summary>
          <div className="mt-8">
            <History items={doc?.history} />
          </div>
        </details>
      </div>
    </Card>
  );
}

/**
 * Dòng trạng thái ở trang soạn: trạng thái, lý do bị trả lại và nút sang trang gửi / duyệt.
 * Giáo án tuần và kế hoạch chủ đề đi theo cả tập kế hoạch giáo dục chủ đề (bản ghi kế hoạch chủ đề).
 */
export function DocStatusStrip({ kind, doc, dossier, ctx, user, reviewTo, dirty, onGo }) {
  const holder = kind === 'week' ? dossier : doc;
  const status = holder?.status || EDU_STATUS.DRAFT;
  const lastReject = [...(holder?.history || [])].reverse().find((h) => h.tone === 'err');
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
        {holder?.status === EDU_STATUS.REJECTED && lastReject?.note && (
          <Notice tone="err">
            Bị trả lại bởi {lastReject.by} ({fmtDateTime(lastReject.at)}): {lastReject.note}
          </Notice>
        )}
      </div>
    </Card>
  );
}
