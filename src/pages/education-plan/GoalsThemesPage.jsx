import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FilePlus2 } from '@/components/ui/icons';
import { ProgressBar } from '@/components';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { Card, EmptyState, PageHead, fmtDate } from '@/components/education-plan/eduUi';
import { AGE_GROUPS, EDU_STATUS, allGoalItems } from '@/models/education-plan/educationPlanConstants';
import { DomainTitle, GoalItemView } from '@/components/education-plan/PlanWidgets';

const today = new Date().toISOString().slice(0, 10);
const STATE_CHIP = { 'Đang diễn ra': 'chip--blue', 'Đã kết thúc': 'chip--gray', 'Sắp diễn ra': 'chip--orange' };

export default function GoalsThemesPage() {
  const { goals, themes, user, schoolYear } = useEducationPlan();
  const [tab, setTab] = useState('themes');
  const goal = goals.find((g) => g.ageGroupId === user.ageGroupId && g.schoolYear === schoolYear && g.status === EDU_STATUS.SENT);
  const approved = themes
    .filter((t) => t.ageGroupId === user.ageGroupId && t.schoolYear === schoolYear && t.status === EDU_STATUS.APPROVED)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const ageName = AGE_GROUPS.find((a) => a.id === user.ageGroupId)?.name;
  const items = allGoalItems(goal);

  return (
    <div className="page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Mục tiêu & chủ đề' }]}
        title="Mục tiêu năm học và kế hoạch chủ đề"
        desc={`Mục tiêu và các chủ đề đã duyệt của ${ageName}, năm học ${schoolYear}. Dùng làm căn cứ khi lập giáo án.`}
        actions={
          <Link to="/education/lessons/new" className="btn btn--primary">
            <FilePlus2 size={16} aria-hidden /> Lập giáo án
          </Link>
        }
      />
      <Card bodyClass={null}>
        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'themes'}
            className={`tab ${tab === 'themes' ? 'tab--active' : ''}`}
            onClick={() => setTab('themes')}
          >
            Kế hoạch chủ đề <span className="tab__count">{approved.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === 'goals'}
            className={`tab ${tab === 'goals' ? 'tab--active' : ''}`}
            onClick={() => setTab('goals')}
          >
            Mục tiêu năm học <span className="tab__count">{items.length}</span>
          </button>
        </div>
        <div className="card__body">
          {tab === 'themes' &&
            (approved.length === 0 ? (
              <EmptyState
                title="Chưa có kế hoạch chủ đề được duyệt"
                desc="Khi Phó hiệu trưởng duyệt kế hoạch chủ đề của tổ trưởng, kế hoạch sẽ hiện ở đây."
              />
            ) : (
              <div className="grid-3">
                {approved.map((t) => {
                  const total = new Date(t.endDate) - new Date(t.startDate);
                  const done = Math.min(Math.max((new Date(today) - new Date(t.startDate)) / total, 0), 1);
                  const pct = Math.round(done * 100);
                  const state = today < t.startDate ? 'Sắp diễn ra' : today > t.endDate ? 'Đã kết thúc' : 'Đang diễn ra';
                  return (
                    <div key={t.id} className="card ga-theme-card">
                      <div className="ga-theme-card__head">
                        <h3 className="card__title">{t.name}</h3>
                        <span className={`chip ${STATE_CHIP[state]}`}>{state}</span>
                      </div>
                      <div className="muted text-xs">
                        {fmtDate(t.startDate)} – {fmtDate(t.endDate)} · {t.weeks} tuần
                      </div>
                      <ProgressBar value={pct} total={100} label={`${pct}%`} />
                      <ul className="text-sm" style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                        {(t.branches || []).map((b) => (
                          <li key={b.index}>
                            Tuần {b.index}: {b.name}
                          </li>
                        ))}
                      </ul>
                      <div className="ga-tags">
                        {(t.rows || []).map((r) => (
                          <span key={r.id} className="chip chip--blue" title={r.requirement}>
                            {r.code}
                          </span>
                        ))}
                      </div>
                      <Link className="btn btn--sm" to={`/education/themes/${t.id}`}>
                        Xem kế hoạch chủ đề
                      </Link>
                      <Link className="btn btn--outline-primary btn--sm" to={`/education/lessons/new?chu-de=${t.id}`}>
                        <FilePlus2 size={16} aria-hidden /> Lập giáo án theo chủ đề
                      </Link>
                    </div>
                  );
                })}
              </div>
            ))}
          {tab === 'goals' &&
            (!goal ? (
              <EmptyState title="Chưa có mục tiêu năm học" desc="Phó hiệu trưởng chưa gửi mục tiêu năm học cho nhóm tuổi." />
            ) : (
              <>
                <div className="row mb-16" style={{ justifyContent: 'space-between' }}>
                  <span className="fw-600">{goal.title}</span>
                </div>
                {goal.domains.map((d) => (
                  <div key={d.name} className="ga-domain">
                    <div className="ga-domain__head">
                      <div className="row" style={{ gap: 10 }}>
                        <span className="ga-domain__bar" aria-hidden />
                        <DomainTitle name={d.name} />
                      </div>
                    </div>
                    <div className="ga-domain__body">
                      {d.items.map((it) => (
                        <GoalItemView key={it.code} item={it} />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ))}
        </div>
      </Card>
    </div>
  );
}
