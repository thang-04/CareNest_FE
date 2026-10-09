import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, CalendarRange, FilePlus2, Search } from '@/components/ui/icons';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { Card, EduStatusBadge, EmptyState, PageHead } from '@/components/education-plan/eduUi';
import { className, periodLabel, typeLabel } from '@/components/education-plan/lessonShared';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';

const TABS = [
  { key: '', label: 'Tất cả' },
  { key: EDU_STATUS.DRAFT, label: 'Nháp' },
  { key: 'pending', label: 'Đang chờ duyệt' },
  { key: EDU_STATUS.APPROVED, label: 'Đã duyệt' },
  { key: EDU_STATUS.REJECTED, label: 'Bị từ chối' },
];
// 'pending' groups both approval steps (team leader, then vice principal)
const match = (tab, s) => !tab || (tab === 'pending' ? s === EDU_STATUS.PENDING_TL || s === EDU_STATUS.PENDING_VP : s === tab);

export default function LessonListPage() {
  const { lessons, themes, user } = useEducationPlan();
  const navigate = useNavigate();
  const [tab, setTab] = useState('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');

  const mine = lessons.filter((l) => l.classId === user.classId);
  const rows = mine
    .filter(
      (l) =>
        match(tab, l.status) &&
        (!type || l.type === type) &&
        (!q || (l.code + (themes.find((t) => t.id === l.themeId)?.name || '')).toLowerCase().includes(q.toLowerCase())),
    )
    .sort((a, b) => (b.date || b.weekStart).localeCompare(a.date || a.weekStart));

  return (
    <div className="page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Giáo án của lớp' }]}
        title={`Giáo án lớp ${className(user.classId)}`}
        desc="Kế hoạch tuần và giáo án ngày của lớp. Giáo án được tổ trưởng xem xét trước, sau đó Phó hiệu trưởng phê duyệt."
        actions={
          <Link to="/education/lessons/new" className="btn btn--primary">
            <FilePlus2 size={16} aria-hidden /> Lập giáo án
          </Link>
        }
      />
      <Card bodyClass={null}>
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={`tab ${tab === t.key ? 'tab--active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              <span className="tab__count">{mine.filter((l) => match(t.key, l.status)).length}</span>
            </button>
          ))}
        </div>
        <div className="filter-bar">
          <label className="search-box">
            <Search size={17} className="muted" />
            <input placeholder="Tìm theo mã hoặc chủ đề" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm kiếm" />
          </label>
          <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Lọc theo loại">
            <option value="">Tất cả loại</option>
            <option value="week">Kế hoạch tuần</option>
            <option value="day">Giáo án ngày</option>
          </select>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title="Không có giáo án"
            desc={tab || type || q ? 'Không có giáo án nào khớp bộ lọc.' : 'Lập kế hoạch tuần hoặc giáo án ngày đầu tiên cho lớp.'}
            action={
              !tab &&
              !type &&
              !q && (
                <Link to="/education/lessons/new" className="btn btn--primary">
                  <FilePlus2 size={16} aria-hidden /> Lập giáo án
                </Link>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Giáo án</th>
                  <th>Thời gian</th>
                  <th>Chủ đề</th>
                  <th>Giờ sinh hoạt</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className="row-click" onClick={() => navigate(`/education/lessons/${l.id}`)}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <span className="muted">
                          {l.type === 'week' ? <CalendarRange size={18} aria-hidden /> : <CalendarDays size={18} aria-hidden />}
                        </span>
                        <span>
                          <div className="ga-cell-title">{typeLabel(l.type)}</div>
                          <div className="ga-cell-sub">{l.code}</div>
                        </span>
                      </div>
                    </td>
                    <td>{periodLabel(l)}</td>
                    <td>{themes.find((t) => t.id === l.themeId)?.name || '—'}</td>
                    <td>{l.slots?.length || 0}</td>
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
