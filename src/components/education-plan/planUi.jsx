import { adaptCalendar, calendarPlan, publishedBranchCalendar, seedTeamBranchTemplates } from '@/models/education-plan/branchCalendar.mjs';
import { Tabs } from '@/components/ui/Tabs';
import { useId, useMemo, useRef } from 'react';
import { EmptyCard, PageHead } from '@/components/education-plan/eduUi';
import { useSearchParams } from 'react-router-dom';
import { SIGNER_SHORT } from '@/components/education-plan/reviewUi';
import { ROLES } from '@/models/User';
import { AGE_GROUPS, EDU_STATUS, ageRangeOptions, sameAgeRange, rangeOptionId } from '@/models/education-plan/educationPlanConstants';
import { useEducationPlan, useGoalDetails } from '@/hooks/education-plan/useEducationPlan';
import { toRows } from '@/models/education-plan/goalTable';
import { ddmm, emptyBranchPlan, themeBranchGroups, yearWeeks } from '@/models/education-plan/classPlan';
import { PENDING_OF } from '@/models/education-plan/eduConfig';
import { canPrincipalPublish } from '@/utils/education-plan/eduPermissions';
import { classTeamPlanSelection } from '@/models/education-plan/planVersions.mjs';
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
  const { user, goals, schoolYearId, classes, branchPlans, semesterPackages = [], creationCapabilities, staff: users } = useEducationPlan();
  const cls = classes.find((c) => c.id === classId) || null;
  const [params] = useSearchParams();
  const { current, listed, previous: listedPrevious, pending } = classTeamPlanSelection(goals, cls, schoolYearId, params.get('plan'));
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
  const isClassTeacher = !!cls && (cls.teacherIds || []).some((id) => String(id) === String(user.id));
  const isHomeroomTeacher = isClassTeacher && String(cls.homeroomTeacherId) === String(user.id);
  // BE EDU-110 (12): người soạn hồ sơ lớp theo vai trò soạn đã cấu hình (GV chủ nhiệm / tổ trưởng / PHT / HT) — dùng cờ
  // BE trả (năm chỉ xem vẫn là người soạn để thấy bản đang soạn); chưa có cờ (mock) thì coi GV chủ nhiệm là người soạn
  const capOf = (kind) => creationCapabilities.find((cap) => String(cap.classId) === String(classId) && cap.kind === kind);
  const authorOf = (kind) => (capOf(kind) ? capOf(kind).reasonCode !== 'AUTHOR_FORBIDDEN' : isHomeroomTeacher);
  const branchAuthor = authorOf('branch');
  const dossierAuthor = authorOf('theme');
  const asRows = (p) =>
    p ? { ...p, domains: p.domains.map((d) => ({ ...d, rows: toRows(d, () => Math.random().toString(36).slice(2, 9)) })) } : null;
  const branchPlan = useMemo(() => {
    // Chưa có chi tiết: không dựng từ bản tóm tắt (thiếu chủ đề ⇒ trang dựng bản nháp sai, mất tên nhánh)
    if (!raw || waiting) return null;
    const source = asRows(raw);
    if (!branchAuthor) {
      return publishedBranchCalendar(
        source,
        semesterPackages.filter((pkg) => pkg.classId === classId && pkg.yearPlanId === raw.id),
      );
    }
    const saved = branchPlans.find((b) => b.classId === classId && b.yearPlanId === raw.id);
    const base = adaptCalendar(saved || emptyBranchPlan({ classId, yearPlanId: raw.id }), source);
    return seedTeamBranchTemplates(base, source);
  }, [raw, branchPlans, semesterPackages, classId, waiting, branchAuthor]);
  // Kế hoạch năm dạng hàng của bảng (giống trang mục tiêu năm)
  const yearPlan = useMemo(() => {
    const approved = branchAuthor
      ? branchPlans.find((b) => b.classId === classId && b.yearPlanId === raw?.id && b.status === EDU_STATUS.APPROVED)
      : branchPlan;
    return raw && !waiting ? calendarPlan(asRows(raw), approved) : null;
  }, [raw, branchPlans, branchPlan, classId, waiting, branchAuthor]);
  const previousPlan = useMemo(() => (waiting ? null : asRows(rawPrevious)), [rawPrevious, waiting]);
  const teachers = cls ? (cls.teacherIds || []).map((id) => users.find((u) => u.id === id)).filter(Boolean) : [];
  const leaders = cls ? users.filter((u) => u.role === ROLES.TEAM_LEADER && u.ageGroupId === cls.ageGroupId) : [];
  // Danh sách lớp do BE giới hạn theo phạm vi (EDU-64): HT/PHT mọi lớp, tổ trưởng lớp cùng nhóm tuổi, GV chỉ lớp mình
  const canPickClass = classes.length > 1;
  const isGroupLeader = leaders.some((leader) => String(leader.id) === String(user.id));
  const canComposeClassDocs = branchAuthor || dossierAuthor;
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
      raw?.id === current?.id &&
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
 * chủ đề nhánh theo eduConfig.signers.branch, kế hoạch giáo dục ngày theo signers.week; bỏ Tổ trưởng khi ctx.skipLeader.
 * Chỉ là UX, service quyết định khi gửi.
 */
export function docReview(kind, doc, ctx, user, eduConfig) {
  const policy = eduConfig?.workflowPolicy?.[kind === 'branch' ? 'branch' : 'theme'];
  const chain = (policy?.reviewers || eduConfig?.signers?.[kind === 'branch' ? 'branch' : 'week'] || []).filter(
    (r) => r !== ROLES.TEAM_LEADER || !ctx.skipLeader,
  );
  const myTurn = isMyReviewTurn(doc, ctx, user);
  const send = doc?.permissions ? doc.permissions.canSubmit : ctx.canComposeClassDocs && !!doc && isOpen(doc);
  const approve = doc?.permissions ? (doc.permissions.canApprove ?? doc.permissions.canIssue) : myTurn;
  // EDU-110 (8), (10), (11): HT soạn loại này, chuỗi duyệt rỗng ⇒ "Ban hành" (action principal_publish) thay "Gửi duyệt"
  const principalPublish =
    !!doc &&
    !approve &&
    canPrincipalPublish({ user, policy, status: doc.status, author: !!(doc.permissions?.canEdit || doc.permissions?.canSubmit) });
  return {
    can: {
      send: send && !principalPublish,
      reject: doc?.permissions ? (doc.permissions.canReject ?? doc.permissions.canReturn) : myTurn,
      approve: approve || principalPublish,
    },
    principalPublish,
    approveLabel: principalPublish ? 'Ban hành' : undefined,
    approveAction: principalPublish ? 'principal_publish' : undefined,
    sendTo: chain.length ? SIGNER_SHORT[chain[0]] || chain[0] : 'đi',
  };
}

/** Lọc nhóm tuổi trước rồi chọn lớp (spec 005 FR-022); đổi nhóm tuổi ⇒ mở lớp đầu tiên của nhóm đó. */
export const classFilterPath = (base, classId, ageGroupId) =>
  classId ? `${base}/${classId}` : `${base}/no-class?ageGroup=${encodeURIComponent(ageGroupId)}`;

export function ClassPicker({ classes, classId, onPick, showAllAges = false }) {
  const [params] = useSearchParams();
  const id = useId();
  const current = classes.find((c) => c.id === classId);
  const groups = ageRangeOptions(
    showAllAges ? AGE_GROUPS : AGE_GROUPS.filter((g) => classes.some((c) => sameAgeRange(c.ageGroupId, g.id))),
    { includeIncomplete: showAllAges },
  );
  const selectedAge = rangeOptionId(current?.ageGroupId ?? (showAllAges ? params.get('ageGroup') : null), groups);
  const inGroup = selectedAge ? classes.filter((c) => sameAgeRange(c.ageGroupId, selectedAge)) : classes;
  return (
    <>
      {/* Chỉ một nhóm tuổi: hiện dạng chữ, không ô chọn bị khóa (Tiền 12/11/2026) */}
      {!showAllAges && groups.length < 2 ? (
        <FilterText label="Nhóm tuổi" value={groups[0]?.name} />
      ) : (
        <div className="field">
          <label className="field__label" htmlFor={`${id}-age`}>
            Nhóm tuổi
          </label>
          <SelectField
            id={`${id}-age`}
            value={selectedAge}
            onChange={(e) => {
              const first = classes.find((c) => sameAgeRange(c.ageGroupId, e.target.value));
              if (first) onPick(first.id);
              else if (showAllAges && e.target.value) onPick(null, e.target.value);
            }}
          >
            {showAllAges && !selectedAge && (
              <option value="" disabled>
                Chọn nhóm tuổi
              </option>
            )}
            {groups.map((g) => (
              <option key={g.id} value={g.id} disabled={g.missingRange}>
                {g.name}
                {g.missingRange ? ' (thiếu khoảng tháng)' : ''}
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
          {!current && <option value="">{inGroup.length ? 'Chọn lớp' : 'Chưa có lớp'}</option>}
          {inGroup.map((c) => (
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
export function ClassPageEmpty({
  crumbs,
  title,
  classes,
  classId,
  onPick,
  canPick = classes.length > 1,
  showAllAges = false,
  emptyTitle,
  children,
}) {
  return (
    <div className="page ga-page">
      <div className="ga-sticky-head">
        <PageHead crumbs={crumbs} title={title} />
        <ClassFilterBar classes={classes} classId={classId} canPick={canPick} showAllAges={showAllAges} onPick={onPick}>
          {children}
        </ClassFilterBar>
      </div>
      <EmptyCard title={emptyTitle} />
    </div>
  );
}

/** Hàng lọc chung của các màn tài liệu lớp: Nhóm tuổi → Lớp rồi các ô lọc riêng của màn; ô chọn cùng cỡ (FR-022a). */
export function ClassFilterBar({ classes, classId, onPick, canPick = true, showAllAges = false, children, footer = null, filters = true }) {
  // Trang chi tiết không có hàng lọc (chỉ trang danh sách có); giữ phần footer (tên chủ đề, tab) nếu có
  if (!filters) return footer ? <div className="card mb-16">{footer}</div> : null;
  const current = classes.find((c) => c.id === classId);
  return (
    <div className="card mb-16">
      <div className="filter-bar">
        {canPick || showAllAges ? (
          <ClassPicker classes={classes} classId={classId} onPick={onPick} showAllAges={showAllAges} />
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
