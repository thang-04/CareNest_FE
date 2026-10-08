import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { Card, EduStatusBadge, EmptyState, PageHead, fmtDate, fmtDateTime } from '@/components/education-plan/eduUi';
import { className, periodLabel, typeLabel } from '@/components/education-plan/lessonShared';
import { AGE_GROUPS, EDU_STATUS, EDU_STATUS_LABELS, allGoalItems } from '@/models/education-plan/educationPlanConstants';

const ageName = (id) => AGE_GROUPS.find((a) => a.id === id)?.name || '—';

const TABS = [
  { key: 'goals', label: 'Mục tiêu năm học' },
  { key: 'themes', label: 'Kế hoạch chủ đề' },
  { key: 'lessons', label: 'Giáo án' },
];

// Bản nháp chưa gửi đi thuộc về người soạn; Hiệu trưởng chỉ xem những gì đã gửi hoặc đã duyệt.
const isShared = (status) => status !== EDU_STATUS.DRAFT;

/**
 * Principal: read-only view of the whole school's education plans (SRS 4.4 – Lesson plan View: Full).
 * No approval here: the Vice Principal approves (UC "View Lesson Plans").
 */
export default function SchoolPlansPage() {
  const { goals, themes, lessons, schoolYear } = useEducationPlan();
  const navigate = useNavigate();
  const [tab, setTab] = useState('goals');
  const [age, setAge] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');

  const data = useMemo(() => {
    const yearThemes = themes.filter((t) => t.schoolYear === schoolYear && isShared(t.status));
    const themeIds = new Set(themes.filter((t) => t.schoolYear === schoolYear).map((t) => t.id));
    return {
      goals: goals
        .filter((g) => g.schoolYear === schoolYear && isShared(g.status))
        .map((g) => ({
          id: g.id,
          to: `/education/goals/${g.id}`,
          title: g.title,
          code: g.code,
          scope: ageName(g.ageGroupId),
          ageGroupId: g.ageGroupId,
          detail: `${allGoalItems(g).length} mục tiêu · ${g.domains.length} lĩnh vực`,
          by: g.createdBy,
          at: fmtDate(g.sentAt),
          status: g.status,
        })),
      themes: yearThemes.map((t) => ({
        id: t.id,
        to: `/education/themes/${t.id}`,
        title: `Chủ đề: ${t.name}`,
        code: t.code,
        scope: ageName(t.ageGroupId),
        ageGroupId: t.ageGroupId,
        detail: `${fmtDate(t.startDate)} – ${fmtDate(t.endDate)}`,
        by: t.createdBy,
        at: fmtDateTime(t.history?.at(-1)?.at),
        status: t.status,
      })),
      lessons: lessons
        .filter((l) => themeIds.has(l.themeId) && isShared(l.status))
        .map((l) => ({
          id: l.id,
          to: `/education/lessons/${l.id}`,
          title: `${typeLabel(l.type)} · Tuần ${l.weekIndex}: ${l.branch}`,
          code: l.code,
          scope: `Lớp ${className(l.classId)}`,
          ageGroupId: l.ageGroupId,
          detail: periodLabel(l),
          by: l.createdBy,
          at: fmtDateTime(l.history?.at(-1)?.at),
          status: l.status,
        })),
    };
  }, [goals, themes, lessons, schoolYear]);

  const all = data[tab];
  const rows = all.filter(
    (r) =>
      (!age || r.ageGroupId === age) &&
      (!status || r.status === status) &&
      (!q || `${r.title} ${r.code} ${r.by || ''}`.toLowerCase().includes(q.toLowerCase())),
  );
  const statuses = [...new Set(all.map((r) => r.status))];
  const count = (list, s) => list.filter((r) => r.status === s).length;
  const pending = (list) => count(list, EDU_STATUS.PENDING_TL) + count(list, EDU_STATUS.PENDING_VP) + count(list, EDU_STATUS.SENT);

  const stats = [
    { label: 'Bộ mục tiêu đã gửi', value: data.goals.length, tone: 'blue', tab: 'goals' },
    { label: 'Kế hoạch chủ đề đã duyệt', value: count(data.themes, EDU_STATUS.APPROVED), tone: 'green', tab: 'themes' },
    { label: 'Giáo án đã duyệt', value: count(data.lessons, EDU_STATUS.APPROVED), tone: 'purple', tab: 'lessons' },
    { label: 'Đang chờ duyệt', value: pending(data.themes) + pending(data.lessons), tone: 'orange', tab: 'lessons' },
  ];

  const switchTab = (key) => {
    setTab(key);
    setStatus('');
  };

  return (
    <div className="page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch toàn trường' }]}
        title="Kế hoạch giáo dục toàn trường"
        desc={`Năm học ${schoolYear}: mục tiêu năm học, kế hoạch chủ đề và giáo án đã gửi của các nhóm tuổi (chỉ xem). Phó hiệu trưởng là người phê duyệt.`}
      />
      <div className="stat-grid">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            className={`stat-card stat-card--${s.tone} ${tab === s.tab ? 'stat-card--active' : ''}`}
            onClick={() => switchTab(s.tab)}
          >
            <div className="stat-card__value">{s.value}</div>
            <div className="stat-card__label">{s.label}</div>
          </button>
        ))}
      </div>
      <Card bodyClass={null}>
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`tab ${tab === t.key ? 'tab--active' : ''}`}
              onClick={() => switchTab(t.key)}
            >
              {t.label} <span className="tab__count">{data[t.key].length}</span>
            </button>
          ))}
        </div>
        <div className="filter-bar">
          <label className="search-box">
            <Search size={17} className="muted" aria-hidden />
            <input placeholder="Tìm theo tên, mã hoặc người lập" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm kiếm" />
          </label>
          <select className="select" value={age} onChange={(e) => setAge(e.target.value)} aria-label="Lọc theo nhóm tuổi">
            <option value="">Tất cả nhóm tuổi</option>
            {AGE_GROUPS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Lọc theo trạng thái">
            <option value="">Tất cả trạng thái</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {EDU_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title={all.length ? 'Không có kết quả phù hợp' : `Chưa có ${TABS.find((t) => t.key === tab).label.toLowerCase()} nào được gửi`}
            desc={all.length ? 'Thử đổi từ khóa hoặc bộ lọc.' : `Năm học ${schoolYear} chưa có dữ liệu ở mục này.`}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{TABS.find((t) => t.key === tab).label}</th>
                  <th>Phạm vi</th>
                  <th>{tab === 'goals' ? 'Nội dung' : 'Thời gian'}</th>
                  <th>Người lập</th>
                  <th>{tab === 'goals' ? 'Ngày gửi' : 'Cập nhật'}</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="row-click"
                    tabIndex={0}
                    onClick={() => navigate(r.to)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(r.to)}
                  >
                    <td>
                      <div className="ga-cell-title">{r.title}</div>
                      <div className="ga-cell-sub">{r.code}</div>
                    </td>
                    <td>{r.scope}</td>
                    <td>{r.detail}</td>
                    <td>{r.by || '—'}</td>
                    <td>{r.at}</td>
                    <td>
                      <EduStatusBadge status={r.status} />
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
