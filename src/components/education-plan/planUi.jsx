import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw, Send, Sparkles, Undo2 } from '@/components/ui/icons';
import { SidePanel } from '@/components/ui/SidePanel';
import {
  Card,
  EduStatusBadge,
  Field,
  History,
  Modal,
  Notice,
  SignatureBox,
  SignatureView,
  fmtDateTime,
} from '@/components/education-plan/eduUi';
import { useAsync } from '@/hooks/useAsync';
import { useClasses } from '@/hooks/useSchool';
import { getUsers } from '@/services/masterDataService';
import { generatePlanAiDraft } from '@/services/education-plan/educationPlanService';
import { ROLES } from '@/models/User';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';

/* ---------- Đọc / ghi theo đường dẫn "a.b.0.c" (nháp AI trả key dạng này) ---------- */

export const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

export const setPath = (obj, path, value) => {
  const [head, ...rest] = path.split('.');
  const base = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  base[head] = rest.length ? setPath(obj?.[head] ?? (/^\d+$/.test(rest[0]) ? [] : {}), rest.join('.'), value) : value;
  return base;
};

/** Chữ nhiều dòng ở chế độ xem. */
export function CellText({ text, empty = '—' }) {
  return text?.trim() ? <div className="ga-cell-text">{text}</div> : <span className="muted">{empty}</span>;
}

/** Ô nhập trong bảng: textarea khi sửa được, chữ thường khi chỉ xem. */
export function CellInput({ value, onChange, editable, placeholder, rows = 3, label }) {
  if (!editable) return <CellText text={value} />;
  return (
    <textarea
      className="textarea"
      rows={rows}
      value={value || ''}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/* ---------- Nháp AI ---------- */

/**
 * Panel nháp AI: tạo nháp từ ngữ cảnh, người dùng chọn từng mục rồi mới đưa vào tài liệu.
 * isFilled(key): ô đích đã có nội dung → mặc định không chọn để không ghi đè.
 */
export function AiDraftPanel({ open, title, type, context, onClose, onApply, isFilled = () => false, renderValue }) {
  const [state, setState] = useState({ loading: false, items: [], picked: {}, error: null });

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await generatePlanAiDraft(type, context);
      setState({
        loading: false,
        error: null,
        items: res.items,
        picked: Object.fromEntries(res.items.map((it) => [it.key, !isFilled(it.key)])),
      });
    } catch (err) {
      setState({ loading: false, items: [], picked: {}, error: err.message });
    }
    // context là đối tượng mới mỗi lần render; chỉ tạo lại khi mở panel hoặc bấm Tạo lại
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  useEffect(() => {
    if (open) run();
  }, [open, run]);

  const chosen = state.items.filter((it) => state.picked[it.key]);
  const toggle = (key) => setState((s) => ({ ...s, picked: { ...s.picked, [key]: !s.picked[key] } }));

  return (
    <SidePanel
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <div className="row row--wrap">
          <button type="button" className="btn btn--ghost" onClick={run} disabled={state.loading}>
            <RefreshCw size={16} /> Tạo lại
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={state.loading || chosen.length === 0}
            onClick={() => {
              onApply(chosen);
              onClose();
            }}
          >
            <Check size={16} /> Dùng {chosen.length} mục đã chọn
          </button>
        </div>
      }
    >
      <div className="stack">
        <Notice tone="warn">
          Đây là <b>nháp do AI tạo</b>. Kiểm tra và sửa trước khi dùng. Tài liệu vẫn phải gửi duyệt như bình thường. Ô đã có nội dung không
          được chọn sẵn để tránh ghi đè.
        </Notice>
        {state.loading && <p className="muted">Đang tạo nháp…</p>}
        {state.error && <Notice tone="err">{state.error}. Bạn vẫn có thể soạn tay.</Notice>}
        {!state.loading &&
          state.items.map((it) => (
            <div key={it.key} className="stack">
              <div className="row row--wrap">
                <label className="checkbox fw-600">
                  <input type="checkbox" checked={!!state.picked[it.key]} onChange={() => toggle(it.key)} />
                  {it.label}
                </label>
                <span className="chip chip--purple">Nháp AI</span>
                {isFilled(it.key) && <span className="chip chip--orange">Ô đã có nội dung</span>}
              </div>
              {renderValue ? renderValue(it.value) : <div className="ga-cell-text muted text-sm">{it.value}</div>}
            </div>
          ))}
      </div>
    </SidePanel>
  );
}

export function AiButton({ onClick, children = 'Tạo nháp bằng AI', disabled }) {
  return (
    <button type="button" className="btn btn--outline-primary btn--sm" onClick={onClick} disabled={disabled}>
      <Sparkles size={16} /> {children}
    </button>
  );
}

/* ---------- Lớp và quyền hiển thị ---------- */

/** Dữ liệu dùng chung của màn lớp: lớp, giáo viên, kế hoạch năm đã ban hành của khối, vai trò của người dùng với lớp. */
export function useClassPlanContext(classId) {
  const { user, yearPlans, yearId } = useEducationPlan();
  const { classes, loading } = useClasses({ all: true });
  const usersQ = useAsync(() => getUsers(), []);
  const users = useMemo(() => usersQ.data || [], [usersQ.data]);
  const cls = classes.find((c) => c.id === classId) || null;
  const yearPlan = cls ? yearPlans.find((p) => p.ageGroupId === cls.ageGroupId && p.schoolYear === yearId) || null : null;
  const teachers = cls ? (cls.teacherIds || []).map((id) => users.find((u) => u.id === id)).filter(Boolean) : [];
  const leaders = cls ? users.filter((u) => u.role === ROLES.TEAM_LEADER && u.ageGroupId === cls.ageGroupId) : [];
  const isClassTeacher = !!cls && (cls.teacherIds || []).includes(user.id);
  const isGroupLeader = user.role === ROLES.TEAM_LEADER && !!cls && user.ageGroupId === cls.ageGroupId;
  const isVp = user.role === ROLES.VICE_PRINCIPAL;
  // Chỉ để hiển thị chuỗi duyệt dự kiến; bước thật do BE quyết định khi gửi.
  const skipLeader = !leaders.length || leaders.some((u) => (cls?.teacherIds || []).includes(u.id));
  const nameOf = (id) => users.find((u) => u.id === id)?.fullName || '—';
  return {
    cls,
    classes,
    loading: loading || usersQ.loading,
    yearPlan,
    teachers,
    users,
    isClassTeacher,
    isGroupLeader,
    isVp,
    skipLeader,
    nameOf,
  };
}

/* ---------- Thanh duyệt ---------- */

/**
 * Trạng thái + chuỗi duyệt + nút theo vai trò, dùng cho chủ đề nhánh, kế hoạch chủ đề và giáo án tuần.
 * onAct(action, { note, signature }) trả về tài liệu mới hoặc null khi lỗi.
 */
export function ReviewBar({ doc, title, isClassTeacher, isGroupLeader, isVp, skipLeader, onAct, beforeSubmit, dirty }) {
  const [modal, setModal] = useState(null);
  const [note, setNote] = useState('');
  const [signature, setSignature] = useState(null);
  const [tried, setTried] = useState(false);
  const status = doc?.status || EDU_STATUS.DRAFT;
  const editable = status === EDU_STATUS.DRAFT || status === EDU_STATUS.REJECTED;
  const canSubmit = isClassTeacher && editable && !!doc;
  const canReview = (status === EDU_STATUS.PENDING_TL && isGroupLeader) || (status === EDU_STATUS.PENDING_VP && isVp);
  const finalStep = status === EDU_STATUS.PENDING_VP;
  const lastReject = [...(doc?.history || [])].reverse().find((h) => h.tone === 'err');

  const open = (kind) => {
    setNote('');
    setSignature(null);
    setTried(false);
    setModal(kind);
  };
  const confirm = async () => {
    setTried(true);
    if (modal === 'reject' && !note.trim()) return;
    if (modal === 'approve' && finalStep && !signature) return;
    const action = modal === 'submit' ? 'submit' : modal;
    const res = await onAct(action, {
      note: note.trim() || undefined,
      signature: modal === 'approve' && finalStep ? signature : undefined,
    });
    if (res) setModal(null);
  };

  const chain = skipLeader
    ? 'Giáo viên soạn → Phó hiệu trưởng duyệt (tổ trưởng dạy lớp này nên bỏ bước tổ trưởng)'
    : 'Giáo viên soạn → Tổ trưởng duyệt → Phó hiệu trưởng duyệt';

  return (
    <Card
      title={title}
      actions={
        <div className="row row--wrap">
          {canSubmit && (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={dirty}
              title={dirty ? 'Lưu thay đổi trước khi gửi' : undefined}
              onClick={() => (beforeSubmit ? beforeSubmit(() => open('submit')) : open('submit'))}
            >
              <Send size={16} /> Gửi duyệt
            </button>
          )}
          {canReview && (
            <>
              <button type="button" className="btn btn--outline-primary btn--sm" onClick={() => open('reject')}>
                <Undo2 size={16} /> Trả lại
              </button>
              <button type="button" className="btn btn--primary btn--sm" onClick={() => open('approve')}>
                <Check size={16} /> {finalStep ? 'Duyệt và ký' : 'Duyệt, chuyển Phó HT'}
              </button>
            </>
          )}
        </div>
      }
    >
      <div className="stack">
        <div className="row row--wrap">
          <EduStatusBadge status={status} />
          <span className="muted text-sm">{chain}</span>
        </div>
        {status === EDU_STATUS.REJECTED && lastReject?.note && (
          <Notice tone="err">
            Bị trả lại bởi {lastReject.by} ({fmtDateTime(lastReject.at)}): {lastReject.note}
          </Notice>
        )}
        {doc?.approvedBy && (
          <div className="row row--wrap">
            <span className="muted text-sm">Người duyệt:</span>
            <SignatureView sig={doc.approvedBy.sig} name={doc.approvedBy.name} />
            <span className="muted text-sm">
              {doc.approvedBy.name} · {fmtDateTime(doc.approvedBy.at)}
            </span>
          </div>
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
          title={
            { submit: 'Gửi duyệt', approve: finalStep ? 'Duyệt và ký' : 'Duyệt và chuyển Phó hiệu trưởng', reject: 'Trả lại để sửa' }[modal]
          }
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
          {modal === 'submit' && <p>Sau khi gửi, nội dung bị khóa cho tới khi được duyệt hoặc bị trả lại. {chain}.</p>}
          <Field
            label={modal === 'reject' ? 'Lý do trả lại' : 'Nhận xét'}
            required={modal === 'reject'}
            error={tried && modal === 'reject' && !note.trim() ? 'Vui lòng ghi lý do' : undefined}
          >
            <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {modal === 'approve' && finalStep && (
            <Field label="Chữ ký người duyệt" required>
              <SignatureBox value={signature} onChange={setSignature} invalid={tried && !signature} />
            </Field>
          )}
        </Modal>
      )}
    </Card>
  );
}
