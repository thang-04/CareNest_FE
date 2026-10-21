import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Plus, RotateCcw } from '@/components/ui/icons';
import { ROLES } from '@/models/User';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS, EDU_STATUS, allGoalItems } from '@/models/education-plan/educationPlanConstants';
import { Card, EmptyState, PageHead, YearPlanStatusBadge, fmtDate } from '@/components/education-plan/eduUi';
import { StatCardIcon } from '@/components/ui/StatCardIcon';
import { useClasses } from '@/hooks/useSchool';
import { LoadingState } from '@/components/ui/States';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { clickableRowProps } from '@/utils/clickableRow';

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

/** Mục "Mục tiêu năm học": giáo viên chỉ xem kế hoạch năm đã ban hành của khối lớp mình dạy; vai trò khác thấy danh sách. */
export function GoalsEntry() {
  const { user } = useEducationPlan();
  return user.role === ROLES.TEACHER ? <TeacherYearGoals /> : <GoalListPage />;
}

function TeacherYearGoals() {
  const { user, goals, schoolYear } = useEducationPlan();
  const { classes, loading } = useClasses();
  if (loading) return <LoadingState />;
  const groups = classes.filter((c) => (c.teacherIds || []).includes(user.id)).map((c) => c.ageGroupId);
  const issued = goals.find((g) => groups.includes(g.ageGroupId) && g.schoolYear === schoolYear && g.status === EDU_STATUS.APPROVED);
  if (issued) return <Navigate to={`/education/goals/${issued.id}`} replace />;
  return (
    <div className="page ga-page">
      <PageHead crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Mục tiêu năm học' }]} title="Mục tiêu năm học" />
      <Card>
        <EmptyState title="Kế hoạch giáo dục năm học của khối chưa được ban hành" />
      </Card>
    </div>
  );
}

export default function GoalListPage() {
  const { goals, schoolYear, role, user } = useEducationPlan();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [age, setAge] = useState('');
  const isVP = role === ROLES.VICE_PRINCIPAL;
  const isLeader = role === ROLES.TEAM_LEADER;

  // Tổ trưởng cùng soạn kế hoạch của nhóm tuổi mình nên thấy cả bản nháp; giáo viên chỉ thấy bản đã ban hành
  const scoped = useMemo(
    () =>
      goals.filter(
        (g) =>
          g.schoolYear === schoolYear &&
          (isVP || (g.ageGroupId === user.ageGroupId && (isLeader || g.status === EDU_STATUS.APPROVED || g.status === EDU_STATUS.SENT))),
      ),
    [goals, schoolYear, isVP, isLeader, user],
  );
  const canCreate = isVP || (isLeader && !scoped.some((g) => g.ageGroupId === user.ageGroupId));
  const rows = scoped.filter((g) => (!age || g.ageGroupId === age) && (!q || (g.title + g.code).toLowerCase().includes(q.toLowerCase())));

  const issued = scoped.filter((g) => g.status === EDU_STATUS.APPROVED || g.status === EDU_STATUS.SENT).length;
  const pending = scoped.filter((g) => g.status === EDU_STATUS.PENDING_VP).length;

  return (
    <div className="page ga-page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Mục tiêu năm học' }]}
        title="Mục tiêu năm học"
        desc={
          isVP || isLeader
            ? 'Mỗi nhóm tuổi một kế hoạch do tổ trưởng hoặc Phó hiệu trưởng soạn. Tổ trưởng gửi, Phó hiệu trưởng duyệt ban hành rồi in ra ký.'
            : `Kế hoạch năm học ${schoolYear} đã ban hành cho nhóm tuổi của bạn (chỉ xem).`
        }
        actions={
          canCreate && (
            <Link to="/education/goals/new" className="btn btn--primary">
              <Plus size={16} aria-hidden /> Lập kế hoạch năm học
            </Link>
          )
        }
      />

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
            <div className="stat-card__label">Chờ Phó HT ban hành</div>
            <StatCardIcon tone="orange" />
          </div>
        </div>
      )}

      <Card bodyClass={null}>
        <div className="filter-bar">
          <SearchSubmit value={q} placeholder="Tìm theo tên hoặc mã" label="Tìm kế hoạch" onSearch={setQ} />
          {isVP && (
            <select className="select" value={age} onChange={(e) => setAge(e.target.value)} aria-label="Lọc theo nhóm tuổi">
              <option value="">Tất cả nhóm tuổi</option>
              {AGE_GROUPS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </div>
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
                <Link to="/education/goals/new" className="btn btn--primary">
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
                  <tr key={g.id} className="row-click" {...clickableRowProps(() => navigate(`/education/goals/${g.id}`))}>
                    <td>
                      <div className="ga-cell-title">{g.title}</div>
                      <div className="ga-cell-sub">{g.code}</div>
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
