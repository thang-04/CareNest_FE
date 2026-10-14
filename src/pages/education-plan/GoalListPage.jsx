import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search } from '@/components/ui/icons';
import { ROLES } from '@/models/User';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS, EDU_STATUS, allGoalItems } from '@/models/education-plan/educationPlanConstants';
import { Card, EmptyState, PageHead, YearPlanStatusBadge, fmtDate } from '@/components/education-plan/eduUi';
import { StatCardIcon } from '@/components/ui/StatCardIcon';
import { yearSigners } from '@/utils/education-plan/yearPlanDoc';

const ageName = (id) => AGE_GROUPS.find((a) => a.id === id)?.name || '—';

/** Trạng thái 2 chữ ký cần để ban hành: Tổ trưởng (ký khi gửi) và Phó HT (ký ban hành). */
function SignState({ plan }) {
  return (
    <div className="text-xs">
      {yearSigners(plan).map(({ role, title, sign }) => (
        <div key={role} className={sign ? '' : 'muted'}>
          {title}: {sign ? `đã ký (${sign.name})` : 'chưa ký'}
        </div>
      ))}
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
            ? 'Mỗi nhóm tuổi một kế hoạch: Phó hiệu trưởng và tổ trưởng cùng soạn, tổ trưởng gửi, Phó hiệu trưởng ký ban hành.'
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
          <label className="search-box">
            <Search size={17} className="muted" />
            <input placeholder="Tìm theo tên hoặc mã" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm kiếm" />
          </label>
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
        {rows.length === 0 ? (
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
            <table className="table">
              <thead>
                <tr>
                  <th>Kế hoạch</th>
                  <th>Nhóm tuổi áp dụng</th>
                  <th>Số mục tiêu</th>
                  <th>Ngày gửi</th>
                  <th>Chữ ký người xây dựng</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id} className="row-click" onClick={() => navigate(`/education/goals/${g.id}`)}>
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
                      <SignState plan={g} />
                    </td>
                    <td>
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
