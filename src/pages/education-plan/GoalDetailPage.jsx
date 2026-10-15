import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, FileDown, PenLine, Pencil, Printer, Send, Trash2, Undo2 } from '@/components/ui/icons';
import { ROLES } from '@/models/User';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS, DOMAINS, EDU_STATUS, SCHOOL_SCOPE } from '@/models/education-plan/educationPlanConstants';
import { goalIdsToTicks, numberGoals, toRows } from '@/models/education-plan/goalTable';
import { GoalTable, PlanTabs, ThemeEventTable } from '@/components/education-plan/GoalTables';
import PlanSignatures from '@/components/education-plan/PlanSignatures';
import { downloadYearPlanDoc, planSigners, printYearPlan, yearSigners } from '@/utils/education-plan/yearPlanDoc';
import {
  Card,
  YearPlanStatusBadge,
  EmptyState,
  Field,
  Modal,
  Notice,
  PageHead,
  SignatureBox,
  fmtDate,
} from '@/components/education-plan/eduUi';

const uid = () => Math.random().toString(36).slice(2, 9);
const ISSUE_NOTE = 'Sau khi ban hành, các lớp trong nhóm tuổi dùng kế hoạch này để lập kế hoạch chủ đề và giáo án.';
const editable = (s) => s === EDU_STATUS.DRAFT || s === EDU_STATUS.REJECTED;

/** Kế hoạch giáo dục năm học của một nhóm tuổi: bảng mục tiêu (A), chủ đề, sự kiện (B), người xây dựng và ban hành. */
const POPUP_BLOCKED = 'Trình duyệt chặn cửa sổ in. Cho phép cửa sổ bật lên rồi bấm lại.';

export default function GoalDetailPage() {
  const { id } = useParams();
  const { goals, themes: themePlans, user, saveGoal, deleteGoal, toast } = useEducationPlan();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  const [note, setNote] = useState('');
  const [signature, setSignature] = useState(null);
  const [tried, setTried] = useState(false);
  const [tab, setTab] = useState('goals');
  const found = goals.find((x) => x.id === id);
  // Giáo viên chỉ xem kế hoạch năm đã ban hành (đủ chữ ký Tổ trưởng và Phó HT)
  const g = user.role === ROLES.TEACHER && found?.status !== EDU_STATUS.APPROVED ? null : found;

  if (!g)
    return (
      <div className="page ga-page">
        <PageHead
          crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Mục tiêu năm học', to: '/education/goals' }]}
          title="Kế hoạch năm học"
        />
        <Card>
          <EmptyState
            title="Không tìm thấy kế hoạch năm học"
            action={
              <Link className="btn" to="/education/goals">
                Về danh sách
              </Link>
            }
          />
        </Card>
      </div>
    );

  const isVp = user.role === ROLES.VICE_PRINCIPAL;
  const isLeader = user.role === ROLES.TEAM_LEADER && user.ageGroupId === g.ageGroupId;
  const isPrincipal = user.role === ROLES.PRINCIPAL;
  const ageName = AGE_GROUPS.find((a) => a.id === g.ageGroupId)?.name;
  const usedBy = themePlans.filter((t) => t.goalId === g.id);
  const { domains, themes } = goalIdsToTicks(
    DOMAINS.map((name) => g.domains.find((d) => d.name === name) || { name, rows: [] }).map((d) => ({
      id: d.id || d.name,
      name: d.name,
      rows: toRows(d, uid),
    })),
    g.themes || [],
  );
  const numbers = numberGoals(domains);
  const plan = { ...g, domains, themes };
  const builders = g.builders || [];
  const history = g.history || [];
  const now = () => new Date().toISOString().slice(0, 10);
  const log = (action, extra) => [...history, { at: now(), by: user.name, action, note: extra || undefined }];

  const open = (kind) => {
    setNote('');
    setSignature(null);
    setTried(false);
    setModal(kind);
  };
  const act = () => {
    setTried(true);
    if (modal === 'reject') {
      if (!note.trim()) return;
      saveGoal({ ...g, status: EDU_STATUS.REJECTED, history: log('Trả lại để sửa', note.trim()) });
      toast('Đã trả lại kế hoạch cho tổ trưởng');
    } else if (modal === 'issue') {
      // Phó HT đã ký người xây dựng trước khi gửi; ban hành dùng lại chữ ký đó, ghi ngày ban hành
      saveGoal({ ...g, status: EDU_STATUS.APPROVED, issued: { ...vice, at: now() }, history: log('Ban hành', note.trim()) });
      toast('Đã ban hành kế hoạch năm học');
    } else if (modal === 'sign') {
      // Người ký không soạn nội dung (vd. Hiệu trưởng khi cấu hình thêm) ký người xây dựng ngay trên trang chi tiết
      if (!signature) return;
      const sig = { userId: user.id, name: user.name, role: user.title, roleKey: user.role, at: now(), sig: signature };
      saveGoal({ ...g, builders: [...builders.filter((b) => b.userId !== user.id), sig], history: log('Ký người xây dựng') });
      toast('Đã ký người xây dựng');
    } else if (modal === 'send') {
      saveGoal({ ...g, status: EDU_STATUS.PENDING_VP, sentAt: now(), history: log('Gửi Phó hiệu trưởng ban hành', note.trim()) });
      toast('Đã gửi Phó hiệu trưởng ký ban hành');
    }
    setModal(null);
  };
  const signedByMe = builders.some((b) => b.userId === user.id);
  // Gửi ban hành khi đủ chữ ký của mọi người xây dựng theo cấu hình (mặc định Tổ trưởng và Phó HT)
  const signers = yearSigners(g);
  const { vice } = planSigners(g);
  const bothSigned = signers.every((x) => x.sign);
  const mustSign = signers.some((x) => x.role === user.role) && (user.role !== ROLES.TEAM_LEADER || isLeader);

  return (
    <div className="page ga-page">
      <PageHead
        crumbs={[
          { label: 'Kế hoạch giáo dục' },
          isPrincipal ? { label: 'Kế hoạch toàn trường', to: '/education/school' } : { label: 'Mục tiêu năm học', to: '/education/goals' },
          { label: g.code },
        ]}
        title={g.title}
        desc={
          <span className="row" style={{ gap: 12 }}>
            <YearPlanStatusBadge status={g.status} size="lg" />
            <span>{g.title}</span>
          </span>
        }
        actions={
          <>
            <button className="btn btn--ghost" onClick={() => downloadYearPlanDoc(plan, numbers)}>
              <FileDown size={16} aria-hidden /> Xuất Word
            </button>
            <button className="btn btn--ghost" onClick={() => printYearPlan(plan, numbers) || toast(POPUP_BLOCKED, 'warn')}>
              <Printer size={16} aria-hidden /> In / Lưu PDF
            </button>
            {isVp && g.status === EDU_STATUS.DRAFT && (
              <button className="btn btn--outline-danger" onClick={() => setModal('delete')}>
                <Trash2 size={16} aria-hidden /> Xóa
              </button>
            )}
            {(isVp || isLeader) && editable(g.status) && (
              <Link className="btn btn--outline-primary" to={`/education/goals/${g.id}/edit`}>
                <Pencil size={16} aria-hidden /> Chỉnh sửa
              </Link>
            )}
            {mustSign && editable(g.status) && !signedByMe && (isVp || isLeader) && (
              <Link className="btn btn--outline-primary" to={`/education/goals/${g.id}/edit?buoc=ky`}>
                <PenLine size={16} aria-hidden /> Ký người xây dựng
              </Link>
            )}
            {mustSign && editable(g.status) && !signedByMe && !isVp && !isLeader && (
              <button className="btn btn--outline-primary" onClick={() => open('sign')}>
                <PenLine size={16} aria-hidden /> Ký người xây dựng
              </button>
            )}
            {isLeader && editable(g.status) && (
              <button
                className="btn btn--primary"
                disabled={!bothSigned}
                title={bothSigned ? undefined : 'Cần đủ chữ ký của người xây dựng'}
                onClick={() => open('send')}
              >
                <Send size={16} aria-hidden /> Gửi Phó HT ban hành
              </button>
            )}
            {isVp && g.status === EDU_STATUS.PENDING_VP && (
              <>
                <button className="btn btn--outline-primary" onClick={() => open('reject')}>
                  <Undo2 size={16} aria-hidden /> Trả lại
                </button>
                <button className="btn btn--primary" onClick={() => open('issue')}>
                  <Check size={16} aria-hidden /> Ban hành
                </button>
              </>
            )}
          </>
        }
      />

      {g.status === EDU_STATUS.REJECTED && history.at(-1)?.note && (
        <div className="mb-16">
          <Notice tone="err">
            Bị trả lại ({history.at(-1).by}, {fmtDate(history.at(-1).at)}): {history.at(-1).note}
          </Notice>
        </div>
      )}
      {editable(g.status) && (isVp || isLeader || mustSign) && !bothSigned && (
        <div className="mb-16">
          <Notice>
            Cần đủ chữ ký của người xây dựng trước khi gửi ban hành:{' '}
            {signers.map((x) => `${x.title} ${x.sign ? `đã ký (${x.sign.name})` : 'chưa ký'}`).join(', ')}.
          </Notice>
        </div>
      )}
      {g.status === EDU_STATUS.PENDING_VP && !isVp && (
        <div className="mb-16">
          <Notice>Đã đủ chữ ký và gửi Phó hiệu trưởng ban hành. Kế hoạch bị khóa cho tới khi được ban hành hoặc bị trả lại.</Notice>
        </div>
      )}

      <Card title="Thông tin chung">
        <dl className="info-list">
          <dt>Năm học</dt>
          <dd>{g.schoolYear}</dd>
          <dt>Nhóm tuổi áp dụng</dt>
          <dd>{ageName}</dd>
          <dt>Phạm vi</dt>
          <dd>{SCHOOL_SCOPE}</dd>
          <dt>Số mục tiêu</dt>
          <dd>
            {Object.keys(numbers).length} mục tiêu · {themes.length} chủ đề
          </dd>
          <dt>Ngày lập</dt>
          <dd>{fmtDate(g.createdAt)}</dd>
          <dt>Ngày gửi</dt>
          <dd>{fmtDate(g.sentAt)}</dd>
          <dt>Mô tả</dt>
          <dd>{g.description || '—'}</dd>
        </dl>
      </Card>

      <Card className="mt-16" bodyClass={null}>
        <PlanTabs tab={tab} onTab={setTab} counts={{ themes: themes.length, goals: Object.keys(numbers).length }} />
        <div className="card__body">
          {tab === 'themes' ? (
            <ThemeEventTable themes={themes} breaks={g.breaks || []} domains={domains} numbers={numbers} readOnly />
          ) : (
            <GoalTable domains={domains} themes={themes} numbers={numbers} readOnly />
          )}
        </div>
      </Card>
      <PlanSignatures plan={plan} className="mt-16" />

      {(modal === 'send' || modal === 'reject' || modal === 'issue' || modal === 'sign') && (
        <Modal
          title={
            {
              send: 'Gửi Phó hiệu trưởng ban hành',
              reject: 'Trả lại kế hoạch',
              issue: 'Ban hành kế hoạch năm học',
              sign: 'Ký người xây dựng',
            }[modal]
          }
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn" onClick={() => setModal(null)}>
                Hủy
              </button>
              <button className="btn btn--primary" onClick={act}>
                Xác nhận
              </button>
            </>
          }
        >
          {modal === 'send' && <p>Kế hoạch đã đủ chữ ký người xây dựng, sẽ bị khóa cho tới khi Phó hiệu trưởng ban hành hoặc trả lại.</p>}
          {modal === 'issue' && <p>{`Kế hoạch có ${Object.keys(numbers).length} mục tiêu, ${themes.length} chủ đề. ${ISSUE_NOTE}`}</p>}
          <Field
            label={modal === 'reject' ? 'Lý do trả lại' : 'Ghi chú'}
            required={modal === 'reject'}
            error={tried && modal === 'reject' && !note.trim() ? 'Vui lòng ghi lý do' : undefined}
          >
            <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {modal === 'sign' && (
            <Field label="Chữ ký" required>
              <SignatureBox value={signature} onChange={setSignature} invalid={tried && !signature} />
            </Field>
          )}
        </Modal>
      )}

      {modal === 'delete' && (
        <Modal
          title={`Xóa “${g.title}”?`}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn" onClick={() => setModal(null)}>
                Giữ lại
              </button>
              <button
                className="btn btn--outline-danger"
                disabled={usedBy.length > 0}
                onClick={() => {
                  deleteGoal(g.id);
                  toast('Đã xóa kế hoạch năm học');
                  navigate('/education/goals');
                }}
              >
                <Trash2 size={16} aria-hidden /> Xóa kế hoạch
              </button>
            </>
          }
        >
          {usedBy.length > 0 ? (
            <Notice tone="err">Không xóa được vì đã có kế hoạch chủ đề sử dụng kế hoạch này.</Notice>
          ) : (
            <p>Bản nháp sẽ bị xóa khỏi hệ thống và không khôi phục lại được.</p>
          )}
        </Modal>
      )}
    </div>
  );
}
