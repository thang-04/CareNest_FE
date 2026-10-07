import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLES, ROLE_LABELS } from '@/models/User';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { Card, EduStatusBadge, EmptyState, PageHead, fmtDateTime } from '@/components/education-plan/eduUi';
import { className, periodLabel, typeLabel } from '@/components/education-plan/lessonShared';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';

export default function ReviewListPage() {
  const { lessons, themes, user } = useEducationPlan();
  const navigate = useNavigate();
  const [tab, setTab] = useState('pending');
  const inGroup = lessons.filter((l) => l.ageGroupId === user.ageGroupId);
  const pending = inGroup.filter((l) => l.status === EDU_STATUS.PENDING_TL);
  // A history entry with a tone is a decision (approve / reject) made by a team leader
  const done = inGroup.filter((l) => l.history.some((h) => h.role === ROLE_LABELS[ROLES.TEAM_LEADER] && h.tone));
  const rows = tab === 'pending' ? pending : done;
  const submittedAt = (l) => [...l.history].reverse().find((h) => !h.tone)?.at;

  return (
    <div className="page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Duyệt giáo án' }]}
        title="Duyệt giáo án"
        desc="Xem xét chuyên môn giáo án của giáo viên trong nhóm tuổi. Giáo án bạn duyệt sẽ chuyển tiếp tới Phó hiệu trưởng."
      />
      <Card bodyClass={null}>
        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'pending'}
            className={`tab ${tab === 'pending' ? 'tab--active' : ''}`}
            onClick={() => setTab('pending')}
          >
            Chờ xem xét <span className="tab__count">{pending.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === 'done'}
            className={`tab ${tab === 'done' ? 'tab--active' : ''}`}
            onClick={() => setTab('done')}
          >
            Đã xử lý <span className="tab__count">{done.length}</span>
          </button>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title={tab === 'pending' ? 'Không có giáo án chờ xem xét' : 'Chưa xử lý giáo án nào'}
            desc={tab === 'pending' ? 'Khi giáo viên gửi giáo án, giáo án sẽ hiện ở đây.' : undefined}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Giáo án</th>
                  <th>Lớp / Giáo viên</th>
                  <th>Thời gian</th>
                  <th>Chủ đề</th>
                  <th>Gửi lúc</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr
                    key={l.id}
                    className="row-click"
                    onClick={() => navigate(tab === 'pending' ? `/education/reviews/${l.id}` : `/education/lessons/${l.id}`)}
                  >
                    <td>
                      <div className="ga-cell-title">{typeLabel(l.type)}</div>
                      <div className="ga-cell-sub">{l.code}</div>
                    </td>
                    <td>
                      <div>{className(l.classId)}</div>
                      <div className="ga-cell-sub">{l.createdBy}</div>
                    </td>
                    <td>{periodLabel(l)}</td>
                    <td>{themes.find((t) => t.id === l.themeId)?.name}</td>
                    <td>{fmtDateTime(submittedAt(l))}</td>
                    <td>
                      <EduStatusBadge status={l.status} />
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
