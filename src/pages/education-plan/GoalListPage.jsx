import { planLevel as levelOf, planRoute } from '@/models/education-plan/planLevel.mjs';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, RotateCcw } from '@/components/ui/icons';
import { ROLES } from '@/models/User';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS, EDU_STATUS, allGoalItems, ageRangeOptions } from '@/models/education-plan/educationPlanConstants';
import { Card, EmptyState, PageHead, YearPlanStatusBadge, fmtDate } from '@/components/education-plan/eduUi';
import { StatCard } from '@/components/ui/StatCard';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { clickableRowProps } from '@/utils/clickableRow';
import { versionOf } from '@/models/education-plan/planVersions.mjs';
import { useAsync } from '@/hooks/useAsync';
import { usePolling } from '@/hooks/usePolling';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { Pagination } from '@/components/ui/Pagination';
import { getGoalPage, getGoalStats, getReviewQueue } from '@/services/education-plan/educationPlanService';
import { isReviewTurn } from '@/models/education-plan/reviewTurn.mjs';
import { Button } from '@/components';
import { DEFAULT_WORKFLOW_POLICY } from '@/models/education-plan/eduConfig';
import { canEduApprove, isEduVicePrincipal } from '@/utils/education-plan/eduPermissions';

const PAGE_SIZE = 5;
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
  const { schoolYearId, yearOption, role, user, eduConfig } = useEducationPlan();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [age, setAge] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [page, setPage] = useState(1);
  const isVP = isEduVicePrincipal(user);
  const isPrincipal = role === ROLES.PRINCIPAL;

  const policyKey = annual ? 'schoolYear' : 'year';
  const yearPolicy = eduConfig?.workflowPolicy?.[policyKey] || DEFAULT_WORKFLOW_POLICY[policyKey];
  const isYearCreator = (yearPolicy.creators || []).includes(role) && !(yearPolicy.reviewers || []).includes(role);
  const principalViewer = isPrincipal && !isYearCreator;

  // edu-list-paging (Tiền 25/11/2026): BE lọc theo phạm vi người xem (BE:EDU-06), tìm, lọc nhóm tuổi, phân trang 5/trang;
  // mặc định ẩn bản đã thay thế (currentOnly). Số liệu thẻ + nhóm tuổi đã có kế hoạch lấy từ /goals/stats
  const list = useAsync(
    () => getGoalPage(user, { planLevel, schoolYearId, ageRange: age, q, currentOnly: !showOld, page: page - 1, size: PAGE_SIZE }),
    [user.id, planLevel, schoolYearId, age, q, showOld, page],
    { enabled: !!schoolYearId, refreshOnDataChange: true },
  );
  const stats = useAsync(() => getGoalStats(user, { planLevel, schoolYearId }), [user.id, planLevel, schoolYearId], {
    enabled: !!schoolYearId,
    refreshOnDataChange: true,
  });
  const rows = list.data?.items || [];
  const total = list.data?.totalElements || 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  useEffect(() => {
    if (list.data && page > lastPage) setPage(lastPage);
  }, [list.data, page, lastPage]);
  const withPlan = stats.data?.ageGroupIdsWithPlan || [];
  // Bản Chờ duyệt không nằm trong danh sách (chỉ bản đã ban hành); thẻ "Chờ duyệt" đếm theo hàng chờ của BE và dẫn sang đó
  // FR6.2: PHT không có mã duyệt nào thì không có hàng đợi duyệt
  const queueEnabled = !!schoolYearId && ((isVP && canEduApprove(user)) || isPrincipal);
  const queue = useAsync(() => getReviewQueue(user, schoolYearId), [user.id, schoolYearId], {
    refreshOnDataChange: true,
    enabled: queueEnabled,
  });
  usePolling(() => queue.reload({ silent: true }), { enabled: queueEnabled });

  const creationScopes = eduConfig?.[annual ? 'schoolYearCreationScopes' : 'yearCreationScopes'];
  // EDU-89: năm đã kết thúc / năm sắp tới chưa tới ngày mở chuẩn bị ⇒ chỉ xem, không lập kế hoạch
  const yearOpt = yearOption;
  const yearWritable = !!yearOpt && (yearOpt.status === 'ACTIVE' || yearOpt.preparing);
  const canCreate =
    annual &&
    yearWritable &&
    !principalViewer &&
    (creationScopes
      ? creationScopes.some((id) => !withPlan.includes(id))
      : isYearCreator && (!user.ageGroupId || !withPlan.includes(user.ageGroupId)));

  // Bản đã ban hành có bản mới hơn thay thế: hiện "Đã thay thế" (cờ current từ BE), mặc định ẩn (Tiền 12/11/2026)
  const replaced = (g) => g.status === EDU_STATUS.APPROVED && g.current === false;
  const oldCount = stats.data?.replaced || 0;
  const issued = stats.data?.issued || 0;
  const scopedCount = stats.data?.total || 0;
  const goTo = (fn) => (v) => {
    fn(v);
    setPage(1);
  };
  // EDU-93: hàng chờ có cả hồ sơ của bước khác (chỉ xem); "Chờ bạn duyệt" chỉ đếm hồ sơ đúng lượt
  const pending = (queue.data || []).filter((g) => levelOf(g) === planLevel && isReviewTurn(g) !== false).length;

  return (
    <div className="page ga-page">
      <PageHead crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: pageLabel }]} title={pageLabel} />

      {/* Tổ trưởng, giáo viên chỉ có 1–2 kế hoạch mỗi năm: không cần thẻ tổng quan, tìm kiếm, lọc */}
      {(isVP || isPrincipal) && (
        <div className="stat-grid">
          <StatCard
            tone="blue"
            label={annual ? 'Kế hoạch trong năm học' : 'Kế hoạch giáo dục tổ'}
            value={scopedCount}
            loading={stats.loading && !stats.data}
          />
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
                <SearchSubmit value={q} placeholder="Tìm theo tên hoặc mã" label="Tìm kế hoạch" onSearch={goTo(setQ)} />
                <select className="select" value={age} onChange={(e) => goTo(setAge)(e.target.value)} aria-label="Lọc theo nhóm tuổi">
                  <option value="">Tất cả nhóm tuổi</option>
                  {ageRangeOptions().map((a) => (
                    <option key={a.rangeKey} value={a.rangeKey}>
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
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : list.loading && !list.data ? (
          <LoadingState />
        ) : rows.length === 0 && scopedCount > 0 ? (
          // Có kế hoạch nhưng bộ lọc loại hết: không báo "chưa có", cho đặt lại bộ lọc
          <EmptyState
            title="Không có kết quả phù hợp"
            action={
              <Button
                onClick={() => {
                  setQ('');
                  setAge('');
                  setPage(1);
                }}
              >
                <RotateCcw size={15} /> Đặt lại bộ lọc
              </Button>
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
        {total > PAGE_SIZE && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} unit="kế hoạch" />}
        {oldCount > 0 && (
          <div className="card__body">
            <button type="button" className="link-btn" aria-expanded={showOld} onClick={() => goTo(setShowOld)((v) => !v)}>
              {showOld ? 'Ẩn phiên bản cũ' : `Hiện phiên bản cũ (${oldCount})`}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
