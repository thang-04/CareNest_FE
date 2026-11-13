import { planLevel as levelOf, planRoute } from '@/models/education-plan/planLevel.mjs';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, RotateCcw } from '@/components/ui/icons';
import { ROLES } from '@/models/User';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS, EDU_STATUS, allGoalItems } from '@/models/education-plan/educationPlanConstants';
import { Card, EmptyState, PageHead, YearPlanStatusBadge, fmtDate } from '@/components/education-plan/eduUi';
import { StatCard } from '@/components/ui/StatCard';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { clickableRowProps } from '@/utils/clickableRow';
import { currentPlanOf, versionOf } from '@/models/education-plan/planVersions.mjs';
import { useAsync } from '@/hooks/useAsync';
import { usePolling } from '@/hooks/usePolling';
import { getReviewQueue } from '@/services/education-plan/educationPlanService';

const ageName = (id) => AGE_GROUPS.find((a) => a.id === id)?.name || '—';

/** Người soạn kế hoạch (chỉ người này sửa khi còn nháp) và người gửi Phó HT duyệt. */
function Owner({ plan }) {
  const o = plan.owner || (plan.createdBy ? { name: plan.createdBy } : null);
  return (
    <div className="text-xs">
      <div>{o ? `${o.name}${o.title ? ` (${o.title})` : ''}` : '—'}</div>
      {plan.sentBy && plan.sentBy.userId !== o?.userId && <div className="muted">Gửi: {plan.sentBy.name}</div>}
    </div>
  );
}

/** Mục kế hoạch giáo dục tổ dùng chung danh sách theo phạm vi của từng vai trò. */
export function GoalsEntry(props) {
  return <GoalListPage {...props} />;
}

export default function GoalListPage({ planLevel = 'TEAM' }) {
  const annual = planLevel === 'SCHOOL_YEAR';
  const basePath = planRoute({ planLevel });
  const pageLabel = annual ? 'Kế hoạch năm học' : 'Kế hoạch giáo dục tổ';
  const { goals: allGoals, schoolYear, role, user, classes, eduConfig } = useEducationPlan();
  const goals = allGoals.filter((g) => levelOf(g) === planLevel);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [age, setAge] = useState('');
  const [showOld, setShowOld] = useState(false);
  const isVP = role === ROLES.VICE_PRINCIPAL;
  const isLeader = role === ROLES.TEAM_LEADER;
  const isPrincipal = role === ROLES.PRINCIPAL;

  const yearPolicy =
    eduConfig?.workflowPolicy?.[annual ? 'schoolYear' : 'year'] ||
    (annual
      ? { creators: [ROLES.VICE_PRINCIPAL], reviewers: [ROLES.PRINCIPAL] }
      : { creators: [ROLES.TEAM_LEADER], reviewers: [ROLES.VICE_PRINCIPAL] });
  const isYearCreator = (yearPolicy.creators || []).includes(role) && !(yearPolicy.reviewers || []).includes(role);
  const principalViewer = isPrincipal && !isYearCreator;

  // API thật (có permissions): danh sách BE đã theo phạm vi người xem (BE:EDU-06), không lọc lại ở client.
  // Mock: tổ trưởng thấy mọi bản của nhóm tuổi mình; giáo viên chỉ bản đã ban hành của nhóm tuổi các lớp mình dạy
  const scoped = useMemo(() => {
    const taught = classes.filter((c) => (c.teacherIds || []).includes(user.id)).map((c) => c.ageGroupId);
    const issuedPlan = (g) => g.status === EDU_STATUS.APPROVED || g.status === EDU_STATUS.SENT;
    const visible = (g) =>
      g.permissions ||
      isVP ||
      (isPrincipal && g.status !== EDU_STATUS.DRAFT && g.status !== EDU_STATUS.EDITING) ||
      (isLeader && g.ageGroupId === user.ageGroupId) ||
      (issuedPlan(g) && (g.ageGroupId === user.ageGroupId || taught.includes(g.ageGroupId)));
    return goals.filter((g) => g.schoolYear === schoolYear && visible(g));
  }, [goals, classes, schoolYear, isVP, isPrincipal, isLeader, user]);
  // Bản Chờ duyệt không nằm trong danh sách (chỉ bản đã ban hành); thẻ "Chờ duyệt" đếm theo hàng chờ của BE và dẫn sang đó
  const queue = useAsync(() => getReviewQueue(user), [user.id], { refreshOnDataChange: true, enabled: isVP || isPrincipal });
  usePolling(() => queue.reload({ silent: true }), { enabled: isVP || isPrincipal });

  const creationScopes = eduConfig?.[annual ? 'schoolYearCreationScopes' : 'yearCreationScopes'];
  const canCreate =
    annual &&
    !principalViewer &&
    (creationScopes
      ? creationScopes.some((id) => !scoped.some((g) => g.ageGroupId === id))
      : isYearCreator && (!user.ageGroupId || !scoped.some((g) => g.ageGroupId === user.ageGroupId)));

  // Bản đã ban hành nhưng có bản mới hơn thay thế: hiện "Đã thay thế", mặc định gom lại để danh sách chỉ còn bản đang dùng (Tiền 12/11/2026)
  const replaced = (g) =>
    g.status === EDU_STATUS.APPROVED && !(g.current ?? currentPlanOf(goals, g.ageGroupId, g.schoolYear, planLevel)?.id === g.id);
  const matched = scoped.filter(
    (g) => (!age || g.ageGroupId === age) && (!q || (g.title + g.code).toLowerCase().includes(q.toLowerCase())),
  );
  // Chỉ gom bản thay thế khi danh sách còn bản đang dùng của cùng nhóm tuổi; không thì vẫn hiện để danh sách không trống
  const foldable = (g) => replaced(g) && matched.some((x) => !replaced(x) && x.ageGroupId === g.ageGroupId);
  const oldCount = matched.filter(foldable).length;
  const rows = showOld ? matched : matched.filter((g) => !foldable(g));

  const issued = scoped.filter((g) => g.status === EDU_STATUS.APPROVED || g.status === EDU_STATUS.SENT).length;
  const pending = (queue.data || []).filter((g) => levelOf(g) === planLevel).length;

  return (
    <div className="page ga-page">
      <PageHead crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: pageLabel }]} title={pageLabel} />

      {/* Tổ trưởng, giáo viên chỉ có 1–2 kế hoạch mỗi năm: không cần thẻ tổng quan, tìm kiếm, lọc */}
      {(isVP || isPrincipal) && (
        <div className="stat-grid">
          <StatCard tone="blue" label={annual ? 'Kế hoạch trong năm học' : 'Kế hoạch giáo dục tổ'} value={scoped.length} />
          <StatCard tone="green" label="Đã ban hành" value={issued} />
          <StatCard
            tone="orange"
            label="Chờ bạn duyệt"
            value={pending}
            loading={queue.loading && !queue.data}
            onClick={() => navigate('/education/plan-reviews')}
          />
        </div>
      )}

      <Card bodyClass={null}>
        {(isVP || isPrincipal || canCreate) && (
          <div className="filter-bar">
            {(isVP || isPrincipal) && (
              <>
                <SearchSubmit value={q} placeholder="Tìm theo tên hoặc mã" label="Tìm kế hoạch" onSearch={setQ} />
                <select className="select" value={age} onChange={(e) => setAge(e.target.value)} aria-label="Lọc theo nhóm tuổi">
                  <option value="">Tất cả nhóm tuổi</option>
                  {AGE_GROUPS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            {canCreate && (
              <div className="filter-bar__end">
                <Link to={`${basePath}/new`} state={{ backTo: basePath }} className="btn btn--primary">
                  <Plus size={16} aria-hidden /> {annual ? 'Lập kế hoạch năm học' : 'Lập kế hoạch giáo dục tổ'}
                </Link>
              </div>
            )}
          </div>
        )}
        {rows.length === 0 && scoped.length > 0 ? (
          // Có kế hoạch nhưng bộ lọc loại hết: không báo "chưa có", cho đặt lại bộ lọc
          <EmptyState
            title="Không có kết quả phù hợp"
            action={
              <button
                className="btn"
                onClick={() => {
                  setQ('');
                  setAge('');
                }}
              >
                <RotateCcw size={15} /> Đặt lại bộ lọc
              </button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            // Người chỉ xem chỉ thấy bản đã ban hành (BE spec 002 FR-011)
            title={isYearCreator ? `Chưa có ${pageLabel.toLowerCase()}` : 'Chưa có bản ban hành'}
          />
        ) : (
          <div className="table-wrap">
            <table className="table ga-plan-table ga-list-table">
              <thead>
                <tr>
                  <th>{annual ? 'Tên kế hoạch năm học' : 'Tên kế hoạch tổ'}</th>
                  <th>Nhóm tuổi áp dụng</th>
                  {annual && <th>Số mục tiêu</th>}
                  <th>Ngày gửi</th>
                  <th className="min-w-200">Người soạn</th>
                  <th className="center">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr
                    key={g.id}
                    className="row-click"
                    {...clickableRowProps(() => navigate(`${basePath}/${g.id}`, { state: { backTo: basePath } }))}
                  >
                    <td>
                      <div className="ga-cell-title">{g.title}</div>
                      {annual && <div className="text-xs text-primary">Phiên bản {versionOf(g)}</div>}
                    </td>
                    <td>{ageName(g.ageGroupId)}</td>
                    {annual && (
                      <td>
                        {g.summary ? g.goalCount : allGoalItems(g).length} mục tiêu · {g.summary ? g.themeCount : (g.themes || []).length}{' '}
                        chủ đề
                      </td>
                    )}
                    <td>{fmtDate(g.sentAt ?? g.sentBy?.at)}</td>
                    <td>
                      <Owner plan={g} />
                    </td>
                    <td className="center">
                      <YearPlanStatusBadge doc={g} status={replaced(g) ? 'REPLACED' : g.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {oldCount > 0 && (
          <div className="card__body">
            <button type="button" className="link-btn" aria-expanded={showOld} onClick={() => setShowOld((v) => !v)}>
              {showOld ? 'Ẩn phiên bản cũ' : `Hiện phiên bản cũ (${oldCount})`}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
