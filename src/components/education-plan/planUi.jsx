import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, PenLine, Send, Undo2 } from '@/components/ui/icons';
import {
  Card,
  EduStatusBadge,
  Field,
  History,
  Modal,
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
import { PENDING_OF, SIGN_ROLES, getEduConfig } from '@/models/education-plan/eduConfig';

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
    isGroupLeader,
    isVp,
    skipLeader,
  };
}

/* ---------- Ký, gửi, duyệt ---------- */

/** Chuỗi duyệt theo cấu hình của trường (bỏ bước tổ trưởng khi tổ trưởng dạy lớp đó); chỉ để hiển thị, service quyết định thật. */
const chainOf = (kind, skipLeader) => {
  const roles = getEduConfig().signers[kind].filter((r) => r !== ROLES.TEAM_LEADER || !skipLeader);
  return `Giáo viên soạn, ký → ${roles.length ? roles.map((r) => `${SIGN_ROLES[r]} duyệt và ký`).join(' → ') : 'không cần duyệt'}`;
};

/**
 * Trạng thái + nút theo vai trò cho tài liệu của lớp: giáo viên ký người xây dựng / gửi duyệt,
 * tổ trưởng / Phó HT duyệt (ký) hoặc trả lại (bắt buộc lý do). onAct(action, body) trả tài liệu mới hoặc null.
 */
export function ReviewBar({ kind, doc, title, ctx, onAct, dirty, user }) {
  const { isClassTeacher, isGroupLeader, skipLeader } = ctx;
  const [modal, setModal] = useState(null);
  const [note, setNote] = useState('');
  const [signature, setSignature] = useState(null);
  const [tried, setTried] = useState(false);
  const status = doc?.status || EDU_STATUS.DRAFT;
  const editable = status === EDU_STATUS.DRAFT || status === EDU_STATUS.REJECTED;
  const signed = (doc?.builders || []).some((b) => b.userId === user.id);
  const canTeacherAct = isClassTeacher && editable;
  // Đến lượt người dùng duyệt: trạng thái chờ đúng vai trò; tổ trưởng phải là tổ trưởng của khối
  const canReview = status === PENDING_OF[user.role] && (user.role !== ROLES.TEAM_LEADER || isGroupLeader);
  const lastReject = [...(doc?.history || [])].reverse().find((h) => h.tone === 'err');
  const needSig = modal === 'sign' || modal === 'submit' || modal === 'approve';

  const open = (m) => {
    setNote('');
    setSignature(null);
    setTried(false);
    setModal(m);
  };
  const confirm = async () => {
    setTried(true);
    if (modal === 'reject' && !note.trim()) return;
    if (needSig && !signature) return;
    const res = await onAct(modal, { note: note.trim() || undefined, signature: needSig ? signature : undefined });
    if (res) setModal(null);
  };
  const blocked = dirty || !doc?.id;

  return (
    <Card
      title={title}
      actions={
        <div className="row row--wrap">
          {canTeacherAct && !signed && (
            <button
              type="button"
              className="btn btn--outline-primary btn--sm"
              disabled={blocked}
              title={blocked ? 'Lưu trước khi ký' : undefined}
              onClick={() => open('sign')}
            >
              <PenLine size={16} aria-hidden /> Ký người xây dựng
            </button>
          )}
          {canTeacherAct && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={blocked}
              title={blocked ? 'Lưu trước khi gửi' : undefined}
              onClick={() => open('submit')}
            >
              <Send size={16} aria-hidden /> Ký và gửi duyệt
            </button>
          )}
          {canReview && (
            <>
              <button type="button" className="btn btn--outline-primary btn--sm" onClick={() => open('reject')}>
                <Undo2 size={16} aria-hidden /> Trả lại
              </button>
              <button type="button" className="btn btn--primary btn--sm" onClick={() => open('approve')}>
                <Check size={16} aria-hidden /> Duyệt và ký
              </button>
            </>
          )}
        </div>
      }
    >
      <div className="stack">
        <div className="row row--wrap">
          <EduStatusBadge status={status} />
          <span className="muted text-sm">{chainOf(kind, skipLeader)}</span>
        </div>
        {status === EDU_STATUS.REJECTED && lastReject?.note && (
          <Notice tone="err">
            Bị trả lại bởi {lastReject.by} ({fmtDateTime(lastReject.at)}): {lastReject.note}
          </Notice>
        )}
        <details>
          <summary className="muted text-sm">Lịch sử xử lý ({doc?.history?.length || 0})</summary>
          <div className="mt-8">
            <History items={doc?.history} />
          </div>
        </details>
      </div>
      {modal && (
        <Modal
          title={{ sign: 'Ký người xây dựng', submit: 'Ký và gửi duyệt', approve: 'Duyệt và ký', reject: 'Trả lại để sửa' }[modal]}
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" className="btn btn--ghost" onClick={() => setModal(null)}>
                Hủy
              </button>
              <button type="button" className="btn btn--primary" onClick={confirm}>
                Xác nhận
              </button>
            </>
          }
        >
          {modal === 'submit' && <p>Sau khi gửi, nội dung bị khóa cho tới khi được duyệt hoặc bị trả lại. {chainOf(kind, skipLeader)}.</p>}
          {modal !== 'sign' && (
            <Field
              label={modal === 'reject' ? 'Lý do trả lại' : 'Nhận xét'}
              required={modal === 'reject'}
              error={tried && modal === 'reject' && !note.trim() ? 'Vui lòng ghi lý do' : undefined}
            >
              <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          )}
          {needSig && (
            <Field label="Chữ ký" required>
              <SignatureBox value={signature} onChange={setSignature} invalid={tried && !signature} />
            </Field>
          )}
        </Modal>
      )}
    </Card>
  );
}

/** Khung chữ ký cuối tài liệu: Người xây dựng (giáo viên của lớp) và Người duyệt (tổ trưởng, Phó HT). */
export function DocSignatures({ doc, teachers, approveTitle = 'Người duyệt' }) {
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
            {approvals.length ? approvals.map((a, i) => person(i, a.role, a)) : person('none', 'Chưa duyệt', null)}
          </div>
        </div>
      </div>
    </Card>
  );
}
