import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search } from '@/components/ui/icons';
import { ROLES } from '@/models/User';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS, EDU_STATUS, allGoalItems } from '@/models/education-plan/educationPlanConstants';
import { Card, EduStatusBadge, EmptyState, PageHead, fmtDate } from '@/components/education-plan/eduUi';
import { StatCardIcon } from '@/components/ui/StatCardIcon';

const ageName = (id) => AGE_GROUPS.find((a) => a.id === id)?.name || '—';

export default function GoalListPage() {
  const { goals, schoolYear, role, user } = useEducationPlan();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [age, setAge] = useState('');
  const isVP = role === ROLES.VICE_PRINCIPAL;

  const scoped = useMemo(
    () => goals.filter((g) => g.schoolYear === schoolYear && (isVP || (g.ageGroupId === user.ageGroupId && g.status === EDU_STATUS.SENT))),
    [goals, schoolYear, isVP, user],
  );
  const rows = scoped.filter((g) => (!age || g.ageGroupId === age) && (!q || (g.title + g.code).toLowerCase().includes(q.toLowerCase())));

  const sent = scoped.filter((g) => g.status === EDU_STATUS.SENT).length;

  return (
    <div className="page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Mục tiêu năm học' }]}
        title="Mục tiêu năm học"
        desc={isVP ? undefined : `Mục tiêu năm học ${schoolYear} do Phó hiệu trưởng gửi cho nhóm tuổi của bạn (chỉ xem).`}
        actions={
          isVP && (
            <Link to="/education/goals/new" className="btn btn--primary">
              <Plus size={16} aria-hidden /> Tạo mục tiêu năm học
            </Link>
          )
        }
      />

      {isVP && (
        <div className="stat-grid">
          <div className="stat-card stat-card--blue">
            <div className="stat-card__value">{scoped.length}</div>
            <div className="stat-card__label">Bộ mục tiêu trong năm học</div>
            <StatCardIcon tone="blue" />
          </div>
          <div className="stat-card stat-card--green">
            <div className="stat-card__value">{sent}</div>
            <div className="stat-card__label">Đã gửi tổ trưởng</div>
            <StatCardIcon tone="green" />
          </div>
          <div className="stat-card stat-card--orange">
            <div className="stat-card__value">{scoped.length - sent}</div>
            <div className="stat-card__label">Đang soạn (nháp)</div>
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
            title={isVP ? 'Chưa có mục tiêu năm học' : 'Chưa nhận được mục tiêu năm học'}
            desc={
              isVP
                ? 'Tạo mục tiêu cho từng nhóm tuổi để tổ trưởng bắt đầu lập kế hoạch chủ đề.'
                : 'Phó hiệu trưởng chưa gửi mục tiêu năm học cho nhóm tuổi của bạn.'
            }
            action={
              isVP && (
                <Link to="/education/goals/new" className="btn btn--primary">
                  <Plus size={16} aria-hidden /> Tạo mục tiêu năm học
                </Link>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mục tiêu</th>
                  <th>Nhóm tuổi áp dụng</th>
                  <th>Số mục tiêu</th>
                  <th>Ngày gửi</th>
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
                      {allGoalItems(g).length} mục tiêu · {g.domains.length} lĩnh vực
                    </td>
                    <td>{fmtDate(g.sentAt)}</td>
                    <td>
                      <EduStatusBadge status={g.status} />
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
