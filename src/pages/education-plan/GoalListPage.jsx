import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, RotateCcw } from '@/components/ui/icons';
import { ROLES } from '@/models/User';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS, EDU_STATUS, allGoalItems } from '@/models/education-plan/educationPlanConstants';
import { Card, EmptyState, PageHead, YearPlanStatusBadge, fmtDate } from '@/components/education-plan/eduUi';
import { StatCardIcon } from '@/components/ui/StatCardIcon';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { clickableRowProps } from '@/utils/clickableRow';
import { VersionBadge } from '@/components/education-plan/VersionWidgets';
import { versionOf } from '@/models/education-plan/planVersions.mjs';

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

/** Mục "Mục tiêu năm học": mọi vai trò dùng chung danh sách, mỗi người thấy theo phạm vi của mình. */
export function GoalsEntry() {
  return <GoalListPage />;
}

export default function GoalListPage() {
  const { goals, schoolYear, role, user, classes } = useEducationPlan();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [age, setAge] = useState('');
  const isVP = role === ROLES.VICE_PRINCIPAL;
  const isLeader = role === ROLES.TEAM_LEADER;
  const isPrincipal = role === ROLES.PRINCIPAL;

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
  const canCreate = isVP || (isLeader && !scoped.some((g) => g.ageGroupId === user.ageGroupId));
  const rows = scoped.filter((g) => (!age || g.ageGroupId === age) && (!q || (g.title + g.code).toLowerCase().includes(q.toLowerCase())));

  const issued = scoped.filter((g) => g.status === EDU_STATUS.APPROVED || g.status === EDU_STATUS.SENT).length;
  const pending = scoped.filter((g) => g.status === EDU_STATUS.PENDING_VP).length;

  return (
    <div className="page ga-page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Mục tiêu năm học' }]}
        title="Mục tiêu năm học"
        actions={
          canCreate && (
            <Link to="/education/goals/new" state={{ backTo: '/education/goals' }} className="btn btn--primary">
              <Plus size={16} aria-hidden /> Lập kế hoạch năm học
            </Link>
          )
        }
      />

      {/* Tổ trưởng, giáo viên chỉ có 1–2 kế hoạch mỗi năm: không cần thẻ tổng quan, tìm kiếm, lọc */}
      {isVP && (
        <div className="stat-grid">
          <div className="stat-card stat-card--blue">
            <div className="stat-card__value">{scoped.length}</div>
            <div className="stat-card__label">Kế hoạch trong năm học</div>
            <StatCardIcon tone="blue" />
          </div>
          <div className="stat-card stat-card--green">
            <div className="stat-card__value">{issued}</div>
            <div className="stat-card__label">Đã ban hành</div>
            <StatCardIcon tone="green" />
          </div>
          <div className="stat-card stat-card--orange">
            <div className="stat-card__value">{pending}</div>
            <div className="stat-card__label">Chờ duyệt ban hành</div>
            <StatCardIcon tone="orange" />
          </div>
        </div>
      )}

      <Card bodyClass={null}>
        {isVP && (
          <div className="filter-bar">
            <SearchSubmit value={q} placeholder="Tìm theo tên hoặc mã" label="Tìm kế hoạch" onSearch={setQ} />
            <select className="select" value={age} onChange={(e) => setAge(e.target.value)} aria-label="Lọc theo nhóm tuổi">
              <option value="">Tất cả nhóm tuổi</option>
              {AGE_GROUPS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {rows.length === 0 && scoped.length > 0 ? (
          // Có kế hoạch nhưng bộ lọc loại hết: không báo "chưa có", cho đặt lại bộ lọc
          <EmptyState
            title="Không có kế hoạch phù hợp"
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
            title="Chưa có kế hoạch năm học"
            desc={
              canCreate
                ? 'Lập kế hoạch năm học cho nhóm tuổi: mục tiêu, nội dung giáo dục và chủ đề, sự kiện trong năm.'
                : 'Kế hoạch năm học của nhóm tuổi bạn chưa được ban hành.'
            }
            action={
              canCreate && (
                <Link to="/education/goals/new" state={{ backTo: '/education/goals' }} className="btn btn--primary">
                  <Plus size={16} aria-hidden /> Lập kế hoạch năm học
                </Link>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Kế hoạch</th>
                  <th>Nhóm tuổi áp dụng</th>
                  <th>Số mục tiêu</th>
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
                    {...clickableRowProps(() => navigate(`/education/goals/${g.id}`, { state: { backTo: '/education/goals' } }))}
                  >
                    <td>
                      <div className="ga-cell-title">{g.title}</div>
                      <div className="ga-cell-sub">{g.code}</div>
                      {versionOf(g) > 1 && <VersionBadge plan={g} goals={goals} />}
                    </td>
                    <td>{ageName(g.ageGroupId)}</td>
                    <td>
                      {allGoalItems(g).length} mục tiêu · {(g.themes || []).length} chủ đề
                    </td>
                    <td>{fmtDate(g.sentAt)}</td>
                    <td>
                      <Owner plan={g} />
                    </td>
                    <td className="center">
                      <YearPlanStatusBadge status={g.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
