import { adaptCalendar, calendarPlan, seedTeamBranchTemplates } from '@/models/education-plan/branchCalendar.mjs';
import { Tabs } from '@/components/ui/Tabs';
import { useId, useMemo, useRef } from 'react';
import { EmptyCard, PageHead } from '@/components/education-plan/eduUi';
import { useSearchParams } from 'react-router-dom';
import { SIGNER_SHORT } from '@/components/education-plan/reviewUi';
import { ROLES } from '@/models/User';
import { AGE_GROUPS, EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { useEducationPlan, useGoalDetails } from '@/hooks/education-plan/useEducationPlan';
import { toRows } from '@/models/education-plan/goalTable';
import { ddmm, emptyBranchPlan, themeBranchGroups, yearWeeks } from '@/models/education-plan/classPlan';
import { PENDING_OF } from '@/models/education-plan/eduConfig';
import { currentPlanOf, previousPlanOf } from '@/models/education-plan/planVersions.mjs';
import { SelectField } from '@/components';

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
  const listed = pinned || current;
  const listedPrevious = listed ? previousPlanOf(goals, listed) : null;
  // Danh sách chỉ có bản tóm tắt ⇒ tải chi tiết kế hoạch tổ của lớp (và phiên bản trước để chép) khi vào trang; đang tải lại
  // (kế hoạch vừa đổi) thì dùng tạm chi tiết đã có để trang đang sửa không bị dựng lại
  const details = useGoalDetails([listed?.id, listedPrevious?.id]);
  const lastDetail = useRef({});
  const full = (p) => {
    if (!p) return null;
    if (!p.summary) lastDetail.current[p.id] = p;
    return lastDetail.current[p.id] || p;
  };
  const raw = full(listed);
  const rawPrevious = full(listedPrevious);
  const waiting = (!!raw && raw.summary) || (!!rawPrevious && rawPrevious.summary);
  const asRows = (p) =>
    p ? { ...p, domains: p.domains.map((d) => ({ ...d, rows: toRows(d, () => Math.random().toString(36).slice(2, 9)) })) } : null;
  const branchPlan = useMemo(() => {
    // Chưa có chi tiết: không dựng từ bản tóm tắt (thiếu chủ đề ⇒ trang dựng bản nháp sai, mất tên nhánh)
    if (!raw || waiting) return null;
    const source = asRows(raw);
    const saved = branchPlans.find((b) => b.classId === classId && b.yearPlanId === raw.id);
    const base = adaptCalendar(saved || emptyBranchPlan({ classId, yearPlanId: raw.id }), source);
    return seedTeamBranchTemplates(base, source);
  }, [raw, branchPlans, classId, waiting]);
  // Kế hoạch năm dạng hàng của bảng (giống trang mục tiêu năm)
  const yearPlan = useMemo(() => {
    const approved = branchPlans.find((b) => b.classId === classId && b.yearPlanId === raw?.id && b.status === EDU_STATUS.APPROVED);
    return raw && !waiting ? calendarPlan(asRows(raw), approved) : null;
  }, [raw, branchPlans, classId, waiting]);
  const previousPlan = useMemo(() => (waiting ? null : asRows(rawPrevious)), [rawPrevious, waiting]);
  const pending = cls
    ? goals.find((g) => (!g.planLevel || g.planLevel === 'TEAM') && g.ageGroupId === cls.ageGroupId && g.schoolYear === schoolYear)
    : null;
  const teachers = cls ? (cls.teacherIds || []).map((id) => users.find((u) => u.id === id)).filter(Boolean) : [];
  const leaders = cls ? users.filter((u) => u.role === ROLES.TEAM_LEADER && u.ageGroupId === cls.ageGroupId) : [];
  const isClassTeacher = !!cls && (cls.teacherIds || []).some((id) => String(id) === String(user.id));
  const isHomeroomTeacher = isClassTeacher && String(cls.homeroomTeacherId) === String(user.id);
  // Danh sách lớp do BE giới hạn theo phạm vi (EDU-64): HT/PHT mọi lớp, tổ trưởng lớp cùng nhóm tuổi, GV chỉ lớp mình
  const canPickClass = classes.length > 1;
  const isGroupLeader = leaders.some((leader) => String(leader.id) === String(user.id));
  const canComposeClassDocs = isHomeroomTeacher;
  const isVp = user.role === ROLES.VICE_PRINCIPAL;
  // Chỉ để hiển thị chuỗi duyệt dự kiến; bước thật do service quyết định khi gửi
  const skipLeader = !leaders.length || leaders.some((u) => (cls?.teacherIds || []).includes(u.id));
  return {
    cls,
    classes,
    loading: waiting && details.loading,
    yearPlan,
    branchPlan,
    previousPlan,
    // Đang xem phiên bản đã bị thay thế: mọi tài liệu chỉ xem
    superseded: !!raw && raw.id !== current?.id,
    pendingYearPlan: pending,
    teachers,
    users,
    isClassTeacher,
    isHomeroomTeacher,
    canCreate: (kind) =>
      canComposeClassDocs &&
      creationCapabilities.some((cap) => String(cap.classId) === String(classId) && cap.kind === kind && cap.canCreate),
    canComposeClassDocs,
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
      send: doc?.permissions ? doc.permissions.canSubmit : ctx.canComposeClassDocs && !!doc && isOpen(doc),
      reject: doc?.permissions ? (doc.permissions.canReject ?? doc.permissions.canReturn) : myTurn,
      approve: doc?.permissions ? (doc.permissions.canApprove ?? doc.permissions.canIssue) : myTurn,
    },
    sendTo: chain.length ? SIGNER_SHORT[chain[0]] || chain[0] : 'đi',
  };
}

/** Lọc nhóm tuổi trước rồi chọn lớp (spec 005 FR-022); đổi nhóm tuổi ⇒ mở lớp đầu tiên của nhóm đó. */
export function ClassPicker({ classes, classId, onPick }) {
  const id = useId();
  const current = classes.find((c) => c.id === classId);
  const groups = AGE_GROUPS.filter((g) => classes.some((c) => c.ageGroupId === g.id));
  const inGroup = classes.filter((c) => c.ageGroupId === current?.ageGroupId);
  return (
    <>
      {/* Chỉ một nhóm tuổi: hiện dạng chữ, không ô chọn bị khóa (Tiền 12/11/2026) */}
      {groups.length < 2 ? (
        <FilterText label="Nhóm tuổi" value={groups[0]?.name} />
      ) : (
        <div className="field">
          <label className="field__label" htmlFor={`${id}-age`}>
            Nhóm tuổi
          </label>
          <SelectField
            id={`${id}-age`}
            value={current?.ageGroupId || ''}
            onChange={(e) => {
              const first = classes.find((c) => c.ageGroupId === e.target.value);
              if (first) onPick(first.id);
            }}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </SelectField>
        </div>
      )}
      <div className="field">
        <label className="field__label" htmlFor={`${id}-class`}>
          Lớp
        </label>
        <SelectField id={`${id}-class`} value={current ? classId : ''} onChange={(e) => e.target.value && onPick(e.target.value)}>
          {!current && <option value="">Chọn lớp</option>}
          {(inGroup.length ? inGroup : classes).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
      </div>
    </>
  );
}

/**
 * Khung trang khi lớp / kế hoạch đang lọc không có dữ liệu: giữ đầu trang và hàng lọc (ghim), chỉ phần nội dung báo trống
 * để người dùng chọn lại ngay trên trang (Tiền 11/11/2026).
 */
export function ClassPageEmpty({ crumbs, title, classes, classId, onPick, canPick = classes.length > 1, emptyTitle, children }) {
  return (
    <div className="page ga-page">
      <div className="ga-sticky-head">
        <PageHead crumbs={crumbs} title={title} />
        <ClassFilterBar classes={classes} classId={classId} canPick={canPick} onPick={onPick}>
          {children}
        </ClassFilterBar>
      </div>
      <EmptyCard title={emptyTitle} />
    </div>
  );
}

/** Hàng lọc chung của các màn tài liệu lớp: Nhóm tuổi → Lớp rồi các ô lọc riêng của màn; ô chọn cùng cỡ (FR-022a). */
export function ClassFilterBar({ classes, classId, onPick, canPick = true, children, footer = null }) {
  const current = classes.find((c) => c.id === classId);
  return (
    <div className="card mb-16">
      <div className="filter-bar">
        {canPick ? (
          <ClassPicker classes={classes} classId={classId} onPick={onPick} />
        ) : (
          // Không chọn được lớp (giáo viên một lớp): vẫn giữ hàng lọc, hiện lớp dạng chữ để các trang cùng khung (Tiền 12/11/2026)
          current && (
            <>
              <FilterText label="Nhóm tuổi" value={AGE_GROUPS.find((g) => g.id === current.ageGroupId)?.name} />
              <FilterText label="Lớp" value={current.name} />
            </>
          )
        )}
        {children}
      </div>
      {/* footer: phần nằm chung thẻ với hàng lọc (vd. tên chủ đề nhánh + tab tuần/ngày của trang Kế hoạch giáo dục ngày) */}
      {footer}
    </div>
  );
}

/**
 * Hàng tab của một chủ đề (Tiền 12/11/2026): "Kế hoạch chủ đề" đứng đầu, sau đó mỗi chủ đề nhánh một tab
 * "Tuần a+b: tên" (Tiền 12/11/2026 bỏ chữ "Nhánh n"). current = 'theme' hoặc ngày bắt đầu tuần đang mở; nhánh nhiều tuần có thêm hàng chọn tuần.
 * onGo(to) đi qua guard của trang để hỏi khi còn thay đổi chưa lưu.
 */
export function ThemeBranchTabs({ yearPlan, branchDoc, themeId, classId, current, onGo, weeksDisabledReason = '' }) {
  const groups = themeBranchGroups(yearPlan, branchDoc, themeId);
  const base = `/education/class/${classId}`;
  const active = groups.find((g) => g.weeks.some((w) => w.start === current));
  const item = (key, label, to, disabled = false) => ({
    key,
    to,
    disabled,
    title: disabled ? weeksDisabledReason : label,
    label: <span className="ga-theme-tabs__label">{label}</span>,
  });
  const go = (items, value) => (key) => key !== value && onGo(items.find((t) => t.key === key).to);
  const branchItems = [
    item('theme', 'Kế hoạch chủ đề', `${base}/themes/${themeId}`),
    ...groups.map((g) =>
      item(g.weeks[0].start, `${g.label}${g.name ? `: ${g.name}` : ''}`, `${base}/weeks/${g.weeks[0].start}`, !!weeksDisabledReason),
    ),
    // Spec 006 FR-013: tab riêng "Bảng phủ MT" sau tab tuần cuối
    item('coverage', 'Bảng phủ MT', `${base}/themes/${themeId}?tab=coverage`),
  ];
  const branchValue = active ? active.weeks[0].start : current;
  const weekItems = active?.weeks.map((w) => item(w.start, `Tuần ${w.themeNo} · ${ddmm(w.start)}`, `${base}/weeks/${w.start}`)) || [];
  return (
    <>
      <Tabs
        className="ga-class-tabs ga-theme-tabs"
        ariaLabel="Kế hoạch chủ đề và các chủ đề nhánh"
        items={branchItems}
        value={branchValue}
        onChange={go(branchItems, branchValue)}
      />
      {weekItems.length > 1 && (
        <Tabs
          className="ga-class-tabs"
          ariaLabel={`Các tuần của nhánh ${active.no}`}
          items={weekItems}
          value={current}
          onChange={go(weekItems, current)}
        />
      )}
    </>
  );
}

/** Các chủ đề có tuần học của kế hoạch năm, theo thứ tự thời gian: [{ id, name }]. */
export const themesWithWeeks = (yearPlan) => {
  const seen = new Map();
  for (const w of yearWeeks(yearPlan)) if (w.type === 'week' && !seen.has(w.theme.id)) seen.set(w.theme.id, w.theme);
  return [...seen.values()];
};

/** Ô lọc chỉ có một giá trị: "Nhãn: giá trị" dạng chữ thay cho ô chọn bị khóa. */
export function FilterText({ label, value }) {
  if (!value) return null;
  return (
    <div className="field ga-filter-text">
      <span className="field__label">{label}</span>
      <span className="ga-filter-text__value">{value}</span>
    </div>
  );
}

/**
 * Ô chọn trong hàng lọc dạng "Nhãn: ô chọn" (Chủ đề, Tuần…) dùng chung các trang tài liệu lớp, nằm cạnh Nhóm tuổi / Lớp
 * (Tiền 12/11/2026). options: [{ value, label }].
 */
export function FilterSelect({ label, value, options, onChange }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <SelectField id={id} value={value} onChange={(e) => onChange(e.target.value)} title={options.find((o) => o.value === value)?.label}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
