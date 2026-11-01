import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Copy, FileDown, Pencil, Trash2 } from '@/components/ui/icons';
import { ROLES } from '@/models/User';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS, DOMAINS, EDU_STATUS, SCHOOL_SCOPE } from '@/models/education-plan/educationPlanConstants';
import { goalIdsToTicks, numberGoals, toRows } from '@/models/education-plan/goalTable';
import { GoalTable, PlanTabs, ThemeEventTable } from '@/components/education-plan/GoalTables';
import { yearPlanFile } from '@/utils/education-plan/yearPlanDoc';
import { Card, Modal, Notice, PageHead, fmtDate } from '@/components/education-plan/eduUi';
import { RejectedNotice, ReviewActions, ReviewHistory } from '@/components/education-plan/reviewUi';
import { StatusPage } from '@/components/ui/StatusPage';
import { Spinner } from '@/components/ui/States';
import { VersionBadge, YearPlanVersionPanel } from '@/components/education-plan/VersionWidgets';
import { chainOf, currentPlanOf } from '@/models/education-plan/planVersions.mjs';
import DocPreviewModal from '@/components/education-plan/DocPreviewModal';

const uid = () => Math.random().toString(36).slice(2, 9);
const ISSUE_NOTE =
  'Sau khi ban hành, các lớp trong nhóm tuổi dùng kế hoạch này để lập kế hoạch chủ đề và giáo án. Xuất file để in và ký tay.';
const editable = (s) => s === EDU_STATUS.DRAFT || s === EDU_STATUS.REJECTED || s === EDU_STATUS.EDITING;

/** Kế hoạch giáo dục năm học của một nhóm tuổi: bảng mục tiêu (A), chủ đề, sự kiện (B), người xây dựng và ban hành. */

export default function GoalDetailPage() {
  const { id } = useParams();
  const { goals, themes: themePlans, user, saveGoal, deleteGoal, createGoalVersion, toast, staff } = useEducationPlan();
  const [preview, setPreview] = useState(null);
  const navigate = useNavigate();
  // Mắt xích lịch sử cho màn soạn: biết trang trước chi tiết (vd. danh sách) để Đóng lùi đúng về đó
  const cameFrom = useLocation().state?.backTo;
  const [modal, setModal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState('goals');
  const found = goals.find((x) => x.id === id);
  // Giáo viên chỉ xem kế hoạch năm đã ban hành
  const g = user.role === ROLES.TEACHER && found?.status !== EDU_STATUS.APPROVED ? null : found;

  if (!g)
    return (
      <div className="page ga-page">
        <PageHead
          crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Mục tiêu năm học', to: '/education/goals' }]}
          title="Kế hoạch năm học"
        />
        <StatusPage
          kind="404"
          title="Không tìm thấy kế hoạch năm học"
          action={
            <Link className="btn" to="/education/goals">
              Về danh sách
            </Link>
          }
        />
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
  const history = g.history || [];
  const now = () => new Date().toISOString().slice(0, 10);
  const log = (action, extra, tone) => [...history, { at: now(), by: user.name, action, note: extra || undefined, tone }];
  const me = { userId: user.id, name: user.name, role: user.role, title: user.title, at: now() };
  // Phó HT và tổ trưởng cùng soạn, mỗi lúc một người (BE:EDU-03, EDU-10); Phó HT duyệt, trả lại hoặc tự sửa khi đang chờ
  const isOwner = !g.owner || g.owner.userId === user.id;
  const draftLike = editable(g.status);
  const pending = g.status === EDU_STATUS.PENDING_VP;
  const editor = g.status === EDU_STATUS.EDITING ? g.editing : null;
  const lockedByOther = !!editor && editor.userId !== user.id;
  // API thật: BE trả quyền của người xem (permissions); mock chưa có thì tự suy
  const perm = g.permissions;
  const free = draftLike && !lockedByOther;
  const canEditNow = perm ? perm.canEdit : (free && (isVp || isLeader)) || (pending && isVp);
  const canSend = perm ? perm.canSubmit : free && isLeader;
  const canIssue = perm ? perm.canIssue : isVp && (pending || (free && isOwner));
  const canReturn = perm ? perm.canReturn : isVp && pending;
  const canDelete = perm ? perm.canDelete : isVp && !lockedByOther && (g.status === EDU_STATUS.DRAFT || g.editingFrom === EDU_STATUS.DRAFT);
  // BE:EDU-25 — sửa bản đã ban hành = tạo phiên bản mới; bản đã ban hành giữ nguyên
  const canCreateVersion =
    perm?.canCreateVersion ??
    ((isVp || isLeader) &&
      currentPlanOf(goals, g.ageGroupId, g.schoolYear)?.id === g.id &&
      chainOf(goals, g).every((x) => x.status === EDU_STATUS.APPROVED));
  const closeDelete = () => {
    setModal(null);
    setDeleteError('');
  };
  // Chỉ báo "Đã xóa" và rời màn khi BE đã xóa; lỗi (403/409/5xx) hiện trong hộp, ở lại màn
  const removePlan = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteGoal(g.id);
      navigate('/education/goals');
      toast('Đã xóa kế hoạch năm học');
    } catch (err) {
      setDeleteError(err.message || 'Không xóa được kế hoạch năm học. Thử lại sau.');
      setDeleting(false);
    }
  };
  const newVersion = async () => {
    setCreating(true);
    const plan = await createGoalVersion(g.id);
    setCreating(false);
    setModal(null);
    if (plan) {
      toast(`Đã tạo ${plan.code}. Sửa rồi gửi / ban hành như kế hoạch mới.`);
      navigate(`/education/goals/${plan.id}/edit`, { state: { backTo: `/education/goals/${g.id}`, backToPrev: cameFrom } });
    }
  };

  // Gửi / trả lại / ban hành theo mẫu chung (reviewUi); service quyết định trạng thái
  const act = async (action, note) => {
    const next = {
      submit: { ...g, status: EDU_STATUS.PENDING_VP, sentAt: now(), sentBy: me, history: log('Gửi Phó hiệu trưởng duyệt', note) },
      reject: { ...g, status: EDU_STATUS.REJECTED, history: log('Trả lại để sửa', note, 'err') },
      approve: { ...g, status: EDU_STATUS.APPROVED, issued: me, history: log('Ban hành', note) },
    }[action];
    const saved = await saveGoal(next);
    if (saved)
      toast(
        {
          submit: 'Đã gửi Phó hiệu trưởng duyệt',
          reject: 'Đã trả lại kế hoạch cho tổ trưởng',
          approve: 'Đã ban hành kế hoạch năm học. Xuất file để in và ký.',
        }[action],
      );
    return saved;
  };

  return (
    <div className="page ga-page ga-goal-detail">
      <PageHead
        crumbs={[
          { label: 'Kế hoạch giáo dục' },
          isPrincipal ? { label: 'Kế hoạch toàn trường', to: '/education/school' } : { label: 'Mục tiêu năm học', to: '/education/goals' },
          { label: g.code },
        ]}
        title={g.title}
        // Đầu trang chỉ giữ nhãn phiên bản, bỏ nhãn trạng thái riêng (Tiền 31/10); trạng thái vẫn quyết định quyền và nút
        desc={<VersionBadge plan={g} goals={goals} />}
        actions={
          <>
            {/* Xuất / in ở mọi bước; bản đã ban hành thì Phó HT in ra ký, giáo viên in để dùng */}
            <button className="btn btn--ghost" onClick={() => setPreview(yearPlanFile(plan, numbers, staff))}>
              <FileDown size={16} aria-hidden /> Xuất
            </button>
            {preview && <DocPreviewModal file={preview} onClose={() => setPreview(null)} />}
            {canDelete && (
              <button className="btn btn--outline-danger" onClick={() => setModal('delete')}>
                <Trash2 size={16} aria-hidden /> Xóa
              </button>
            )}
            {canCreateVersion && (
              <button className="btn btn--outline-primary" onClick={() => setModal('version')}>
                <Copy size={16} aria-hidden /> Tạo phiên bản điều chỉnh
              </button>
            )}
            {canEditNow && (
              <Link
                className="btn btn--outline-primary"
                to={`/education/goals/${g.id}/edit`}
                state={{ backTo: `/education/goals/${g.id}`, backToPrev: cameFrom }}
              >
                <Pencil size={16} aria-hidden /> {pending ? 'Sửa trước khi duyệt' : 'Chỉnh sửa'}
              </Link>
            )}
            <ReviewActions
              name="kế hoạch năm học"
              sendTo="Phó HT"
              approveLabel="Ban hành"
              size=""
              can={{ send: canSend, reject: canReturn, approve: canIssue }}
              notes={{
                submit: 'Kế hoạch sẽ bị khóa cho tới khi Phó hiệu trưởng ban hành hoặc trả lại.',
                approve: `Kế hoạch có ${Object.keys(numbers).length} mục tiêu, ${themes.length} chủ đề. ${ISSUE_NOTE}`,
              }}
              onAct={act}
            />
          </>
        }
      />

      {g.status === EDU_STATUS.REJECTED && (
        <div className="mb-16">
          <RejectedNotice status={g.status} history={history} />
        </div>
      )}
      {lockedByOther && (
        <div className="mb-16">
          <Notice tone="warn">
            Đang được {editor.name} sửa từ {editor.at}.
          </Notice>
        </div>
      )}
      {g.status === EDU_STATUS.PENDING_VP && !isVp && (
        <div className="mb-16">
          <Notice>Đã gửi Phó hiệu trưởng duyệt. Kế hoạch bị khóa cho tới khi được ban hành hoặc bị trả lại.</Notice>
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
            <GoalTable domains={domains} themes={themes} numbers={numbers} ageGroupId={g.ageGroupId} readOnly />
          )}
        </div>
      </Card>

      <YearPlanVersionPanel plan={g} goals={goals} />

      <div className="mt-16">
        <ReviewHistory items={history} />
      </div>

      {modal === 'version' && (
        <Modal
          title="Tạo phiên bản điều chỉnh?"
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn" onClick={() => setModal(null)}>
                Hủy
              </button>
              <button className="btn btn--primary" disabled={creating} onClick={newVersion}>
                <Copy size={16} aria-hidden /> Tạo phiên bản
              </button>
            </>
          }
        >
          <p>
            Bản đã ban hành giữ nguyên. Hệ thống chép toàn bộ mục tiêu, nội dung, chủ đề, đợt nghỉ thành một phiên bản mới để sửa, rồi gửi /
            ban hành như kế hoạch mới. Lớp vẫn dùng bản hiện hành tới khi phiên bản mới được ban hành; sau đó các ô liên quan trong tài liệu
            lớp sẽ hiện đỏ để giáo viên sửa.
          </p>
        </Modal>
      )}

      {modal === 'delete' && (
        <Modal
          title={`Xóa “${g.title}”?`}
          onClose={deleting ? undefined : closeDelete}
          footer={
            <>
              <button className="btn" onClick={closeDelete} disabled={deleting}>
                Giữ lại
              </button>
              <button className="btn btn--outline-danger" disabled={usedBy.length > 0 || deleting} onClick={removePlan}>
                {deleting ? <Spinner small /> : <Trash2 size={16} aria-hidden />} Xóa kế hoạch
              </button>
            </>
          }
        >
          {deleteError && <Notice tone="err">{deleteError}</Notice>}
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
