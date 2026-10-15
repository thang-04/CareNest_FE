import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, PenLine, Send, Undo2 } from '@/components/ui/icons';
import {
  Card,
  EduStatusBadge,
  Field,
  History,
  Notice,
  SignatureBox,
  SignatureView,
  fmtDate,
  fmtDateTime,
} from '@/components/education-plan/eduUi';
import { useAsync } from '@/hooks/useAsync';
import { useClasses } from '@/hooks/useSchool';
import { getUsers } from '@/services/masterDataService';
import { ROLES } from '@/models/User';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { toRows } from '@/models/education-plan/goalTable';
import { submitBlocker } from '@/models/education-plan/classPlan';
import { PENDING_OF, SIGN_ROLES, getEduConfig } from '@/models/education-plan/eduConfig';

/** Bước còn thiếu khi tài liệu chưa thể bắt đầu (lock = kết quả createBlocker). */
export const lockTarget = (lock, base, themeId) =>
  lock.need === 'branch'
    ? { to: base.replace('/class/', '/branches/'), label: 'Mở Chủ đề nhánh' }
    : { to: `${base}/themes/${themeId}`, label: 'Mở kế hoạch chủ đề' };

/* ---------- Ô nhập trong bảng (cùng kiểu ô của bảng mục tiêu năm) ---------- */

// Ô nhập tự cao theo nội dung để đọc đủ đoạn dài, không cuộn trong ô
const fitHeight = (el) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

/** Ô chữ trong bảng: gõ thẳng khi sửa được, chữ thường (giữ xuống dòng) khi chỉ xem. */
export function Cell({ value, onChange, editable, label, placeholder, onKeyDown }) {
  const ref = useRef(null);
  // Đo lại chiều cao sau khi bảng có độ rộng thật (lần vẽ đầu cột còn hẹp nên ô bị cao) và khi đổi cỡ cửa sổ
  useLayoutEffect(() => {
    fitHeight(ref.current);
    const id = requestAnimationFrame(() => fitHeight(ref.current));
    return () => cancelAnimationFrame(id);
  });
  useEffect(() => {
    const onResize = () => fitHeight(ref.current);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  if (!editable) return <div className="ga-goal-table__pad ga-cell-text">{value?.trim() ? value : <span className="muted">—</span>}</div>;
  return (
    <textarea
      className="ga-cell-input"
      rows={1}
      ref={ref}
      onInput={(e) => fitHeight(e.target)}
      aria-label={label}
      placeholder={placeholder}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}

/** Bấm vào phần trống của ô (dưới ô nhập khi hàng cao hơn) cũng đặt con trỏ vào ô nhập, như bảng tính. */
export const focusCell = (e) => {
  if (e.target.tagName !== 'TD') return;
  const input = e.target.querySelector('.ga-cell-input');
  if (!input) return;
  e.preventDefault();
  input.focus();
};

/* ---------- Lớp, kế hoạch năm đã ban hành và vai trò của người dùng với lớp ---------- */

/** Dữ liệu dùng chung của màn lớp. Kế hoạch năm chỉ dùng bản đã ban hành (đủ chữ ký Tổ trưởng và Phó HT). */
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

/* ---------- Ký, gửi, duyệt ---------- */

// Chủ đề nhánh duyệt theo signers.branch; hồ sơ chủ đề (kế hoạch chủ đề + giáo án các nhánh) theo signers.week
const signerKey = (kind) => (kind === 'branch' ? 'branch' : 'week');

/** Chuỗi duyệt theo cấu hình của trường (bỏ bước tổ trưởng khi tổ trưởng dạy lớp đó); chỉ để hiển thị, service quyết định thật. */
export const chainOf = (kind, skipLeader) => {
  const roles = getEduConfig().signers[signerKey(kind)].filter((r) => r !== ROLES.TEAM_LEADER || !skipLeader);
  // Mẫu trường: chủ đề nhánh có chữ ký người xây dựng; hồ sơ chủ đề chỉ có chữ ký người duyệt ở từng tuần
  return `Giáo viên soạn, ${kind === 'branch' ? 'ký' : 'gửi'} → ${roles.length ? roles.map((r) => `${SIGN_ROLES[r]} duyệt và ký`).join(' → ') : 'không cần duyệt'}`;
};

/** Đến lượt người dùng duyệt tài liệu: trạng thái chờ đúng vai trò; tổ trưởng phải là tổ trưởng của khối (chỉ là UX). */
export const isMyReviewTurn = (doc, ctx, user) =>
  !!doc && doc.status === PENDING_OF[user.role] && (user.role !== ROLES.TEAM_LEADER || ctx.isGroupLeader);

const isOpen = (doc) => !doc?.status || doc.status === EDU_STATUS.DRAFT || doc.status === EDU_STATUS.REJECTED;

/** Nhãn nút sang trang gửi / duyệt theo việc người dùng cần làm. */
export function reviewLabel(doc, ctx, user, kind = 'branch') {
  const noun = kind === 'branch' ? '' : ' hồ sơ chủ đề';
  if (isMyReviewTurn(doc, ctx, user)) return `Duyệt${noun}`;
  if (ctx.isClassTeacher && isOpen(doc)) return kind === 'branch' ? 'Ký, gửi duyệt' : `Gửi duyệt${noun}`;
  return kind === 'branch' ? 'Xem duyệt, chữ ký' : `Xem${noun}`;
}

/**
 * Phần ký / gửi / duyệt ở CUỐI trang (như trang mục tiêu năm của Phó HT), không mở hộp thoại:
 * - giáo viên: chủ đề nhánh ký người xây dựng rồi gửi; hồ sơ chủ đề gửi một lần (không ký); tuần bị trả lại gửi lại;
 * - người đến lượt duyệt: nhận xét + chữ ký rồi "Duyệt và ký", hoặc ghi lý do rồi "Trả lại".
 * kind: branch | theme (hồ sơ chủ đề) | week. onAct(action, body) trả tài liệu mới hoặc null.
 */
export function SignPanel({ kind, doc, ctx, user, dirty, onAct, title = 'Ký, gửi duyệt và duyệt', note: hint }) {
  const { branchPlans, weekPlans, classThemePlans } = useEducationPlan();
  const [note, setNote] = useState('');
  const [signature, setSignature] = useState(null);
  // Người duyệt phải bấm "Ký" (xác nhận chữ ký) trước, rồi mới bấm "Duyệt" được; đổi chữ ký thì phải ký lại
  const [signedSig, setSignedSig] = useState(null);
  const reviewerSigned = !!signature && signedSig === signature;
  const [tried, setTried] = useState(null);
  const [busy, setBusy] = useState(false);
  const status = doc?.status || EDU_STATUS.DRAFT;
  // Hồ sơ chủ đề không duyệt chung: duyệt ở khung từng tuần
  const canReview = kind !== 'theme' && isMyReviewTurn(doc, ctx, user);
  // Giáo viên gửi: chủ đề nhánh (Nháp / Bị trả lại), hồ sơ chủ đề (Nháp), tuần bị trả lại (gửi lại riêng)
  const canSend =
    ctx.isClassTeacher &&
    !!doc &&
    (kind === 'branch' ? isOpen(doc) : kind === 'theme' ? status === EDU_STATUS.DRAFT : status === EDU_STATUS.REJECTED);
  const builderSigns = kind === 'branch';
  const signedByMe = (doc?.builders || []).some((b) => b.userId === user.id);
  // Chủ đề nhánh: mọi giáo viên của lớp phải ký; người gửi ký luôn khi bấm gửi, nên chỉ xét những người còn lại
  const missingOthers =
    builderSigns && canSend
      ? (ctx.teachers || []).filter((t) => t.id !== user.id && !(doc?.builders || []).some((b) => b.userId === t.id))
      : [];
  const lastReject = [...(doc?.history || [])].reverse().find((h) => h.tone === 'err');
  const orderBlock = canSend ? submitBlocker(kind, doc, { branchPlans, weekPlans, classThemePlans, yearPlan: ctx.yearPlan }) : null;
  const blocked = dirty || !doc?.id;
  const run = async (action) => {
    setTried(action);
    if (action === 'reject' && !note.trim()) return;
    const needSig = action === 'approve' || action === 'sign' || (action === 'submit' && builderSigns);
    if (needSig && !signature) return;
    setBusy(true);
    const res = await onAct(action, { note: note.trim() || undefined, signature: needSig ? signature : undefined });
    setBusy(false);
    if (res) {
      setNote('');
      setSignature(null);
      setSignedSig(null);
      setTried(null);
    }
  };
  const sendLabel = kind === 'branch' ? 'Ký và gửi duyệt' : kind === 'theme' ? 'Gửi duyệt hồ sơ chủ đề' : 'Gửi lại tuần này';

  return (
    <Card title={title}>
      <div className="stack">
        <div className="row row--wrap gap-2">
          <EduStatusBadge status={status} />
          <span className="muted text-sm">{chainOf(kind, ctx.skipLeader)}</span>
        </div>
        {hint && <span className="muted text-sm">{hint}</span>}
        {status === EDU_STATUS.REJECTED && lastReject?.note && (
          <Notice tone="err">
            Bị trả lại bởi {lastReject.by} ({fmtDateTime(lastReject.at)}): {lastReject.note}
          </Notice>
        )}
        {orderBlock && <Notice tone="warn">{orderBlock}</Notice>}
        {missingOthers.length > 0 && (
          <Notice tone="warn">
            Cần đủ chữ ký của các giáo viên lớp. Còn chờ: {missingOthers.map((t) => t.fullName).join(', ')} bấm "Chỉ ký (chưa gửi)".
          </Notice>
        )}
        {(canSend || canReview) && (
          <>
            <Field
              label={canReview ? 'Nhận xét (bắt buộc khi trả lại)' : 'Ghi chú gửi kèm'}
              error={tried === 'reject' && !note.trim() ? 'Vui lòng ghi lý do trả lại' : undefined}
            >
              <textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            {(canReview || builderSigns) && (
              <div className="review-sign">
                <div style={{ flex: 1 }}>
                  <div className="subsection-title">
                    {canReview ? `Chữ ký người duyệt (${SIGN_ROLES[user.role] || ''})` : 'Chữ ký người xây dựng (giáo viên)'}
                  </div>
                  {canReview && reviewerSigned ? (
                    <div className="stack">
                      <SignatureView sig={signature} name={user.fullName} />
                      <div className="row row--wrap gap-2">
                        <span className="chip chip--green">Đã ký</span>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setSignedSig(null)}>
                          Ký lại
                        </button>
                      </div>
                    </div>
                  ) : (
                    <SignatureBox value={signature} onChange={setSignature} invalid={!!tried && tried !== 'reject' && !signature} />
                  )}
                </div>
              </div>
            )}
            <div className="row row--wrap gap-2">
              {/* Chủ đề nhánh: mọi giáo viên được phân công vào lớp đều ký người xây dựng được trước khi gửi */}
              {canSend && builderSigns && !signedByMe && (
                <button
                  type="button"
                  className="btn btn--outline-primary"
                  disabled={busy || blocked || !signature}
                  title={blocked ? 'Lưu trước khi ký' : signature ? undefined : 'Chọn chữ ký trước'}
                  onClick={() => run('sign')}
                >
                  <PenLine size={16} aria-hidden /> Chỉ ký (chưa gửi)
                </button>
              )}
              {canSend && (
                <button
                  type="button"
                  className="btn btn--warning"
                  disabled={busy || blocked || !!orderBlock || missingOthers.length > 0 || (builderSigns && !signature)}
                  title={
                    orderBlock || (missingOthers.length ? 'Chờ đủ chữ ký của các giáo viên lớp' : blocked ? 'Lưu trước khi gửi' : undefined)
                  }
                  onClick={() => run('submit')}
                >
                  <Send size={16} aria-hidden /> {sendLabel}
                </button>
              )}
              {canReview && (
                <>
                  <button type="button" className="btn btn--outline-danger" disabled={busy} onClick={() => run('reject')}>
                    <Undo2 size={16} aria-hidden /> Trả lại
                  </button>
                  {!reviewerSigned && (
                    <button
                      type="button"
                      className="btn btn--outline-primary"
                      disabled={busy || !signature}
                      title={signature ? undefined : 'Chọn chữ ký trước'}
                      onClick={() => setSignedSig(signature)}
                    >
                      <PenLine size={16} aria-hidden /> Ký
                    </button>
                  )}
                  {/* Ký xong (bấm "Ký") mới bấm duyệt được */}
                  <button
                    type="button"
                    className="btn btn--success"
                    disabled={busy || !reviewerSigned}
                    title={reviewerSigned ? undefined : 'Ký trước rồi mới duyệt'}
                    onClick={() => run('approve')}
                  >
                    <Check size={16} aria-hidden /> Duyệt
                  </button>
                </>
              )}
            </div>
          </>
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
 * Giáo án tuần và kế hoạch chủ đề đi theo hồ sơ chủ đề (dossier = bản ghi kế hoạch chủ đề).
 * Phải lưu trước khi sang trang khác để không mất phần đang sửa.
 */
export function DocStatusStrip({ kind, doc, dossier, ctx, user, reviewTo, dirty, onGo }) {
  const { branchPlans, weekPlans, classThemePlans } = useEducationPlan();
  const holder = kind === 'branch' ? doc : kind === 'theme' ? doc : dossier;
  const status = doc?.status || EDU_STATUS.DRAFT;
  const teacherOpen = ctx.isClassTeacher && isOpen(holder);
  const orderBlock =
    teacherOpen && kind !== 'week'
      ? submitBlocker(kind, holder, { branchPlans, weekPlans, classThemePlans, yearPlan: ctx.yearPlan })
      : null;
  const lastReject = [...(holder?.history || [])].reverse().find((h) => h.tone === 'err');
  // Tuần duyệt riêng: đến lượt mình duyệt tuần này / tuần bị trả lại thì gửi lại riêng (ở trang hồ sơ chủ đề)
  const rejected = ctx.isClassTeacher && doc?.status === EDU_STATUS.REJECTED;
  const label =
    kind === 'branch'
      ? reviewLabel(doc, ctx, user, 'branch')
      : kind === 'week' && isMyReviewTurn(doc, ctx, user)
        ? 'Duyệt tuần này'
        : rejected && kind === 'week'
          ? 'Gửi lại tuần này'
          : rejected && kind === 'theme'
            ? 'Gửi lại cùng tuần 1'
            : reviewLabel(holder, ctx, user, 'theme');
  const blocked = dirty || (kind !== 'week' && !doc?.id);
  return (
    <Card>
      <div className="stack">
        <div className="row row--between row--wrap gap-3">
          <div className="row row--wrap gap-2">
            <span className="muted text-sm">Trạng thái:</span>
            <EduStatusBadge status={status} />
          </div>
          <button
            type="button"
            className="btn btn--outline-primary btn--sm"
            disabled={blocked}
            title={blocked ? 'Lưu trước khi sang trang khác' : undefined}
            onClick={() => onGo(reviewTo)}
          >
            {label.startsWith('Duyệt') ? <Check size={16} aria-hidden /> : <Send size={16} aria-hidden />} {label}
          </button>
        </div>
        {holder?.status === EDU_STATUS.REJECTED && lastReject?.note && (
          <Notice tone="err">
            Bị trả lại bởi {lastReject.by} ({fmtDateTime(lastReject.at)}): {lastReject.note}
          </Notice>
        )}
        {kind !== 'branch' && teacherOpen && (
          <Notice>
            Hồ sơ chủ đề gồm kế hoạch chủ đề và giáo án tất cả các nhánh, gửi duyệt một lần ở cuối trang hồ sơ chủ đề. Mỗi tuần duyệt riêng
            (kế hoạch chủ đề duyệt cùng tuần 1); tuần bị trả lại thì sửa và gửi lại ngay ở cuối trang giáo án tuần đó.
          </Notice>
        )}
        {orderBlock && <Notice tone="warn">{orderBlock} Vẫn soạn và lưu được.</Notice>}
      </div>
    </Card>
  );
}

/**
 * Khung duyệt cuối giáo án tuần theo mẫu MN Thái Dương: "Duyệt giáo án từ ngày … đến ngày …", ngày ký, Người duyệt.
 * Không có chữ ký người xây dựng.
 */
export function WeekApproval({ doc, week, ctx }) {
  const approvals = doc?.approvals || [];
  // Ô chưa ký theo chuỗi duyệt (bỏ tổ trưởng khi tổ trưởng dạy lớp đó)
  const chain = getEduConfig().signers.week.filter((r) => r !== ROLES.TEAM_LEADER || !ctx?.skipLeader);
  const slots =
    doc?.status === EDU_STATUS.APPROVED || !chain.length
      ? approvals
      : chain.map((r) => approvals.find((a) => a.roleKey === r) || { pending: SIGN_ROLES[r] });
  return (
    <Card title={`Duyệt giáo án từ ngày ${fmtDate(week.start)} đến ngày ${fmtDate(week.end)}`}>
      <div className="row row--wrap gap-3">
        {(slots.length ? slots : [{ pending: '' }]).map((a, i) => (
          <div key={i} className="stack center">
            <div className="muted text-sm">
              {a?.at
                ? `Ngày ${Number(a.at.slice(8, 10))} tháng ${Number(a.at.slice(5, 7))} năm ${a.at.slice(0, 4)}`
                : 'Ngày … tháng … năm …'}
            </div>
            <div className="fw-600">Người duyệt{a.role || a.pending ? ` (${a.role || a.pending})` : ''}</div>
            {a.sig ? <SignatureView sig={a.sig} name={a.name} /> : <span className="muted">Chưa duyệt</span>}
            <div className="fw-600">{a?.name || ''}</div>
            {a?.note && <div className="muted text-xs">Nhận xét: {a.note}</div>}
          </div>
        ))}
      </div>
    </Card>
  );
}

/** Khung chữ ký cuối tài liệu: Người xây dựng (giáo viên của lớp) và Người duyệt (tổ trưởng, Phó HT). */
export function DocSignatures({ doc, teachers, approveTitle = 'Người duyệt', approverRoles = [] }) {
  const builders = doc?.builders || [];
  const approvals = doc?.approvals || [];
  const person = (key, title, s, name) => (
    <div key={key} className="stack center">
      <div className="fw-600">{title}</div>
      {s ? <SignatureView sig={s.sig} name={s.name} /> : <span className="muted">Chưa ký</span>}
      <div className="fw-600">{s?.name || name || '—'}</div>
      {s?.at && <div className="muted text-xs">Ký ngày {fmtDate(s.at)}</div>}
      {s?.note && <div className="muted text-xs">Nhận xét: {s.note}</div>}
    </div>
  );
  return (
    <Card title="Ký xác nhận">
      <div className="grid-2">
        <div className="stack">
          <div className="section-title center">Người xây dựng</div>
          <div className="grid-2">
            {(teachers.length ? teachers : [{ id: '-', fullName: '' }]).map((t) =>
              person(
                t.id,
                'Giáo viên',
                builders.find((b) => b.userId === t.id),
                t.fullName,
              ),
            )}
          </div>
        </div>
        <div className="stack">
          <div className="section-title center">{approveTitle}</div>
          <div className="grid-2">
            {/* Mỗi người duyệt theo cấu hình một ô (chưa ký thì để trống); đã có chữ ký thì hiện theo thứ tự đã ký */}
            {approverRoles.length
              ? approverRoles.map((r) =>
                  person(
                    r,
                    SIGN_ROLES[r],
                    approvals.find((a) => a.roleKey === r),
                  ),
                )
              : approvals.length
                ? approvals.map((a, i) => person(i, a.role, a))
                : person('none', 'Chưa duyệt', null)}
          </div>
        </div>
      </div>
    </Card>
  );
}
