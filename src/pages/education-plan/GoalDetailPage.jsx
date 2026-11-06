import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Copy, FileDown, Pencil, Trash2 } from '@/components/ui/icons';
import { ROLES } from '@/models/User';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS, DOMAINS, EDU_STATUS, SCHOOL_SCOPE } from '@/models/education-plan/educationPlanConstants';
import { goalIdsToTicks, numberGoals, themeWithoutDates, toRows } from '@/models/education-plan/goalTable';
import { GoalTable, ThemeEventTable } from '@/components/education-plan/GoalTables';
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
  const [modal, setModal] = useState(null);
  // Thẻ thu gọn được như trang sửa (Tiền 03/11)
  const [folded, setFolded] = useState({});
  const fold = (key) => ({ collapsed: !!folded[key], onToggle: () => setFolded((f) => ({ ...f, [key]: !f[key] })) });
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [creating, setCreating] = useState(false);
  const found = goals.find((x) => x.id === id);
  // Giáo viên chỉ xem kế hoạch năm đã ban hành
  const g = found;

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
  const _isOwner = !g.owner || g.owner.userId === user.id;
  const isReview = g.status === 'REVIEW' || g.status === EDU_STATUS.PENDING_VP;
  const pending = isReview;
  const draftLike = editable(g.status) && !isReview;
  const editor = g.editing;
  const lockedByOther = !!editor && editor.userId !== user.id;
  // API thật: BE trả quyền của người xem (permissions); mock chưa có thì tự suy
  const perm = g.permissions;
  const free = draftLike && !lockedByOther;
  const isReviewerForPlan = isReview && (g.waitingRole ? g.waitingRole === user.role : isVp);
  const canEditNow = perm ? perm.canEdit : free && (isVp || isLeader);
  const canSend = perm ? perm.canSubmit : free && isLeader;
  const canIssue = perm ? (perm.canApprove ?? perm.canIssue) : isReviewerForPlan;
  const canReturn = perm ? perm.canReturn : isReviewerForPlan;
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
      navigate(`/education/goals/${plan.id}/edit`, { replace: true, state: { backTo: '/education/goals' } });
    }
  };

  // Gửi / trả lại / ban hành theo mẫu chung (reviewUi); service quyết định trạng thái
  const act = async (action, note) => {
    const next = {
      submit: { ...g, status: 'REVIEW', sentAt: now(), sentBy: me, history: log('Gửi duyệt', note) },
      reject: { ...g, status: EDU_STATUS.DRAFT, history: log('Trả lại để sửa', note, 'err') },
      approve: { ...g, status: EDU_STATUS.APPROVED, issued: me, history: log('Ban hành', note) },
    }[action];
    const saved = await saveGoal(next, { action });
    if (saved)
      toast(
        {
          submit: 'Đã gửi kế hoạch để duyệt',
          reject: 'Đã trả lại kế hoạch để sửa',
          approve:
            saved.status === EDU_STATUS.APPROVED
              ? 'Đã ban hành kế hoạch năm học. Xuất file để in và ký.'
              : 'Đã duyệt và chuyển bước tiếp theo.',
        }[action],
      );
    return saved;
  };

  return (
    <div className="page ga-page ga-goal-detail ga-year-page ga-class-editor">
      <div className="ga-sticky-head">
        <PageHead
          crumbs={[
            { label: 'Kế hoạch giáo dục' },
            isPrincipal
              ? { label: 'Kế hoạch toàn trường', to: '/education/school' }
              : { label: 'Mục tiêu năm học', to: '/education/goals' },
            { label: g.code },
          ]}
          title={g.title}
          // Đầu trang chỉ giữ nhãn phiên bản, bỏ nhãn trạng thái riêng (Tiền 31/10); trạng thái vẫn quyết định quyền và nút
          desc={<VersionBadge plan={g} goals={goals} />}
        />
        <div className="ga-year-toolbar" role="group" aria-label="Thao tác kế hoạch năm học">
          <div className="ga-year-toolbar__group">
            {canDelete && (
              <button className="btn btn--sm btn--outline-danger" onClick={() => setModal('delete')}>
                <Trash2 size={16} aria-hidden /> Xóa
              </button>
            )}
            {canCreateVersion && (
              <button className="btn btn--sm btn--outline-primary" onClick={() => setModal('version')}>
                <Copy size={16} aria-hidden /> Tạo phiên bản điều chỉnh
              </button>
            )}
            {canEditNow && (
              <Link
                className="btn btn--sm btn--outline-primary"
                to={`/education/goals/${g.id}/edit`}
                replace
                state={{ backTo: '/education/goals' }}
              >
                <Pencil size={16} aria-hidden /> {pending ? 'Sửa trước khi duyệt' : 'Chỉnh sửa'}
              </Link>
            )}
          </div>
          <div className="ga-year-toolbar__group ga-year-toolbar__group--end">
            <ReviewActions
              name="kế hoạch năm học"
              sendTo="Phó HT"
              approveLabel={g.review?.roles?.at(-1) === g.review?.waitingRole ? 'Ban hành' : 'Duyệt'}
              variant="btn--outline-primary"
              can={{ send: canSend, reject: canReturn, approve: canIssue }}
              // EDU-52: chủ đề chưa chọn ngày thì chưa ban hành được; sửa ngày ở màn chỉnh sửa
              beforeOpen={(action) => {
                const undated = action === 'approve' && themeWithoutDates(themes);
                if (undated)
                  toast(
                    `Chủ đề "${undated.name || undated.abbr}" chưa chọn ngày. Bấm "Sửa trước khi duyệt" để chọn ngày rồi ban hành.`,
                    'warn',
                  );
                return !undated;
              }}
              notes={{
                submit: 'Kế hoạch sẽ bị khóa cho tới khi Phó hiệu trưởng ban hành hoặc trả lại.',
                approve: `Kế hoạch có ${Object.keys(numbers).length} mục tiêu, ${themes.length} chủ đề. ${ISSUE_NOTE}`,
              }}
              onAct={act}
            />
            <button className="btn btn--sm btn--outline-primary" onClick={() => setPreview(yearPlanFile(plan, numbers, staff))}>
              <FileDown size={16} aria-hidden /> Xuất file
            </button>
          </div>
        </div>
      </div>

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
      {isReview && !canIssue && (
        <div className="mb-16">
          <Notice>{`Đã gửi duyệt${g.waitingRoleLabel ? ` (${g.waitingRoleLabel})` : ''}. Kế hoạch bị khóa cho tới khi được ban hành hoặc bị trả lại.`}</Notice>
        </div>
      )}

      <Card title="1. Thông tin chung" {...fold('info')}>
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

      <Card title="2. Chủ đề, sự kiện trong năm" {...fold('themes')}>
        <ThemeEventTable themes={themes} breaks={g.breaks || []} domains={domains} numbers={numbers} readOnly />
      </Card>
      <Card
        title="3. Mục tiêu, nội dung giáo dục"
        {...fold('goals')}
        actions={<span className="muted text-xs nowrap">{Object.keys(numbers).length} mục tiêu</span>}
      >
        <GoalTable domains={domains} themes={themes} numbers={numbers} ageGroupId={g.ageGroupId} readOnly />
      </Card>

      <YearPlanVersionPanel plan={g} goals={goals} />

      <div className="mt-16">
        <ReviewHistory items={history} />
      </div>
      {preview && <DocPreviewModal file={preview} onClose={() => setPreview(null)} />}

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
