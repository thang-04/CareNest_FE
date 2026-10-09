import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search } from '@/components/ui/icons';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { AGE_GROUPS, EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { Card, EduStatusBadge, EmptyState, PageHead, fmtDate } from '@/components/education-plan/eduUi';

const TABS = [
  { key: '', label: 'Tất cả' },
  { key: EDU_STATUS.DRAFT, label: 'Nháp' },
  { key: EDU_STATUS.PENDING_VP, label: 'Chờ duyệt' },
  { key: EDU_STATUS.APPROVED, label: 'Đã duyệt' },
  { key: EDU_STATUS.REJECTED, label: 'Bị từ chối' },
];

export default function ThemeListPage() {
  const { themes, user, schoolYear } = useEducationPlan();
  const navigate = useNavigate();
  const [tab, setTab] = useState('');
  const [q, setQ] = useState('');
  const ageName = AGE_GROUPS.find((a) => a.id === user.ageGroupId)?.name;

  const scoped = themes.filter((t) => t.ageGroupId === user.ageGroupId && t.schoolYear === schoolYear);
  const rows = scoped
    .filter((t) => (!tab || t.status === tab) && (!q || (t.name + t.code).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div className="page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch chủ đề' }]}
        title="Kế hoạch chủ đề"
        desc={`Mục tiêu theo chủ đề của ${ageName}, năm học ${schoolYear}. Kế hoạch được Phó hiệu trưởng duyệt sẽ chia sẻ cho giáo viên trong nhóm tuổi.`}
        actions={
          <Link to="/education/themes/new" className="btn btn--primary">
            <Plus size={16} aria-hidden /> Tạo kế hoạch chủ đề
          </Link>
        }
      />
      <Card bodyClass={null}>
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`tab ${tab === t.key ? 'tab--active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              <span className="tab__count">{t.key ? scoped.filter((x) => x.status === t.key).length : scoped.length}</span>
            </button>
          ))}
        </div>
        <div className="filter-bar">
          <label className="search-box">
            <Search size={17} className="muted" />
            <input placeholder="Tìm theo tên chủ đề hoặc mã" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm kiếm" />
          </label>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title="Không có kế hoạch chủ đề"
            desc={
              tab || q ? 'Không có kế hoạch nào khớp bộ lọc. Thử đổi bộ lọc khác.' : 'Tạo kế hoạch chủ đề đầu tiên từ mục tiêu năm học.'
            }
            action={
              !tab &&
              !q && (
                <Link to="/education/themes/new" className="btn btn--primary">
                  <Plus size={16} aria-hidden /> Tạo kế hoạch chủ đề
                </Link>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Chủ đề</th>
                  <th>Thời gian</th>
                  <th>Mã YCCĐ</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="row-click" onClick={() => navigate(`/education/themes/${t.id}`)}>
                    <td>
                      <div className="ga-cell-title">{t.name}</div>
                      <div className="ga-cell-sub">{t.code}</div>
                    </td>
                    <td>
                      <div>
                        {fmtDate(t.startDate)} – {fmtDate(t.endDate)}
                      </div>
                      <div className="ga-cell-sub">{t.weeks} tuần</div>
                    </td>
                    <td>
                      <div className="ga-tags">
                        {(t.rows || []).slice(0, 5).map((r) => (
                          <span key={r.id} className="chip chip--blue">
                            {r.code}
                          </span>
                        ))}
                        {(t.rows || []).length > 5 && <span className="chip chip--gray">+{t.rows.length - 5}</span>}
                      </div>
                    </td>
                    <td>
                      <EduStatusBadge status={t.status} />
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
