import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw } from '@/components/ui/icons';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { Card, EduStatusBadge, EmptyState, PageHead, YearPlanStatusBadge, fmtDate, fmtDateTime } from '@/components/education-plan/eduUi';
import { LoadingState } from '@/components/ui/States';
import { useClasses } from '@/hooks/useSchool';
import { AGE_GROUPS, EDU_STATUS, EDU_STATUS_LABELS, allGoalItems } from '@/models/education-plan/educationPlanConstants';
import { themeNumber, themeWeeksOf, yearWeeks } from '@/models/education-plan/classPlan';
import { StatCardIcon } from '@/components/ui/StatCardIcon';
import { clickableRowProps } from '@/utils/clickableRow';

const ageName = (id) => AGE_GROUPS.find((a) => a.id === id)?.name || '—';

const TABS = [
  { key: 'goals', label: 'Mục tiêu năm học' },
  { key: 'branches', label: 'Chủ đề nhánh' },
  { key: 'themes', label: 'Hồ sơ chủ đề' },
];

// Bản nháp, bản đang sửa thuộc về người soạn; Hiệu trưởng chỉ xem những gì đã gửi hoặc đã duyệt (BE:EDU-06)
const isShared = (status) => status !== EDU_STATUS.DRAFT && status !== EDU_STATUS.EDITING;
const isPending = (status) => [EDU_STATUS.PENDING_TL, EDU_STATUS.PENDING_VP, EDU_STATUS.PENDING_HT].includes(status);
// Lần gửi gần nhất (dòng lịch sử không có tone) và lần cập nhật cuối
const sentEntry = (doc) => [...(doc.history || [])].reverse().find((h) => !h.tone);

/**
 * Hiệu trưởng: xem kế hoạch giáo dục toàn trường (kế hoạch năm theo nhóm tuổi, chủ đề nhánh và hồ sơ chủ đề của các lớp),
 * chỉ xem; duyệt theo chuỗi người ký ở trang Duyệt kế hoạch, giáo án.
 */
export default function SchoolPlansPage() {
  const { goals, branchPlans, classThemePlans, schoolYear } = useEducationPlan();
  const { classes, loading } = useClasses();
  const navigate = useNavigate();
  const [tab, setTab] = useState('goals');
  const [age, setAge] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');

  const data = useMemo(() => {
    const yearGoals = goals.filter((g) => g.schoolYear === schoolYear);
    const planOf = (doc) => yearGoals.find((g) => g.id === doc.yearPlanId);
    const classOf = (id) => classes.find((c) => c.id === id);
    const classDoc = (doc) => {
      const cls = classOf(doc.classId);
      const last = doc.history?.at(-1);
      return {
        id: doc.id,
        code: '',
        scope: cls?.name || '—',
        ageGroupId: cls?.ageGroupId,
        by: sentEntry(doc)?.by,
        at: last ? fmtDateTime(last.at) : '—',
        status: doc.status,
      };
    };
    return {
      goals: yearGoals
        .filter((g) => isShared(g.status))
        .map((g) => ({
          id: g.id,
          to: `/education/goals/${g.id}`,
          title: g.title,
          code: g.code,
          scope: ageName(g.ageGroupId),
          ageGroupId: g.ageGroupId,
          detail: `${allGoalItems(g).length} mục tiêu · ${(g.themes || []).length} chủ đề`,
          by: g.owner?.name || g.createdBy,
          at: fmtDate(g.sentAt),
          status: g.status,
          year: true,
        })),
      branches: branchPlans
        .filter((d) => planOf(d) && isShared(d.status))
        .map((d) => {
          const weeks = yearWeeks(planOf(d)).filter((w) => w.type === 'week');
          return {
            ...classDoc(d),
            to: `/education/branches/${d.classId}`,
            title: 'Dự kiến chủ đề nhánh cả năm',
            detail: `${weeks.filter((w) => d.names?.[w.start]?.trim()).length}/${weeks.length} tuần có tên`,
          };
        }),
      themes: classThemePlans
        .filter((d) => planOf(d) && isShared(d.status))
        .map((d) => {
          const plan = planOf(d);
          const theme = (plan.themes || []).find((t) => t.id === d.themeId);
          return {
            ...classDoc(d),
            to: `/education/class/${d.classId}/themes/${d.themeId}/review`,
            title: `Chủ đề ${themeNumber(plan, d.themeId)}: ${theme?.name || '—'}`,
            detail: `${fmtDate(theme?.start)} – ${fmtDate(theme?.end)} · ${themeWeeksOf(plan, d.themeId).length} nhánh`,
          };
        }),
    };
  }, [goals, branchPlans, classThemePlans, classes, schoolYear]);

  const all = data[tab];
  const rows = all.filter(
    (r) =>
      (!age || r.ageGroupId === age) &&
      (!status || r.status === status) &&
      (!q || `${r.title} ${r.code} ${r.by || ''}`.toLowerCase().includes(q.toLowerCase())),
  );
  const statuses = [...new Set(all.map((r) => r.status))];
  const count = (list, s) => list.filter((r) => r.status === s).length;
  const pendingCount = (list) => list.filter((r) => isPending(r.status)).length;

  const stats = [
    { label: 'Kế hoạch năm đã ban hành', value: count(data.goals, EDU_STATUS.APPROVED), tone: 'blue', tab: 'goals' },
    { label: 'Chủ đề nhánh đã duyệt', value: count(data.branches, EDU_STATUS.APPROVED), tone: 'green', tab: 'branches' },
    { label: 'Hồ sơ chủ đề đã duyệt', value: count(data.themes, EDU_STATUS.APPROVED), tone: 'purple', tab: 'themes' },
    {
      label: 'Đang chờ duyệt',
      value: pendingCount(data.goals) + pendingCount(data.branches) + pendingCount(data.themes),
      tone: 'orange',
      tab: 'themes',
    },
  ];

  const switchTab = (key) => {
    setTab(key);
    setStatus('');
  };
  const filtered = !!(age || status || q);
  const resetFilters = () => {
    setAge('');
    setStatus('');
    setQ('');
  };

  if (loading) return <LoadingState />;

  return (
    <div className="page ga-page">
      <PageHead crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch toàn trường' }]} title="Kế hoạch giáo dục toàn trường" />
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
            <StatCardIcon tone={s.tone} />
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
          <SearchSubmit value={q} placeholder="Tìm theo tên, mã hoặc người lập" label="Tìm kế hoạch" onSearch={setQ} />
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
          <button className="btn" type="button" onClick={resetFilters} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title={all.length ? 'Không có kết quả phù hợp' : `Chưa có ${TABS.find((t) => t.key === tab).label.toLowerCase()} nào được gửi`}
            desc={all.length ? 'Thử đổi từ khóa hoặc bộ lọc.' : `Năm học ${schoolYear} chưa có dữ liệu ở mục này.`}
          />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>{TABS.find((t) => t.key === tab).label}</th>
                  <th>Phạm vi</th>
                  <th>{tab === 'goals' ? 'Nội dung' : 'Tiến độ'}</th>
                  <th>Người lập</th>
                  <th>{tab === 'goals' ? 'Ngày gửi' : 'Cập nhật'}</th>
                  <th className="center">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="row-click" {...clickableRowProps(() => navigate(r.to))}>
                    <td>
                      <div className="ga-cell-title">{r.title}</div>
                      <div className="ga-cell-sub">{r.code}</div>
                    </td>
                    <td>{r.scope}</td>
                    <td>{r.detail}</td>
                    <td>{r.by || '—'}</td>
                    <td>{r.at}</td>
                    <td className="center">{r.year ? <YearPlanStatusBadge status={r.status} /> : <EduStatusBadge status={r.status} />}</td>
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
