import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLES, ROLE_LABELS } from '@/models/User';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { Card, EduStatusBadge, EmptyState, PageHead, fmtDate, fmtDateTime } from '@/components/education-plan/eduUi';
import { className, periodLabel, typeLabel } from '@/components/education-plan/lessonShared';
import { AGE_GROUPS, EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { StatCardIcon } from '@/components/ui/StatCardIcon';

const ageName = (id) => AGE_GROUPS.find((a) => a.id === id)?.name;

export default function ApprovalListPage() {
  const { themes, lessons } = useEducationPlan();
  const navigate = useNavigate();
  const [tab, setTab] = useState('pending');
  const [kind, setKind] = useState('');

  const items = [
    ...themes.map((t) => ({
      kind: 'chu-de',
      id: t.id,
      code: t.code,
      title: `Kế hoạch chủ đề: ${t.name}`,
      scope: ageName(t.ageGroupId),
      period: `${fmtDate(t.startDate)} – ${fmtDate(t.endDate)}`,
      by: t.createdBy,
      status: t.status,
      history: t.history,
    })),
    ...lessons.map((l) => ({
      kind: 'giao-an',
      id: l.id,
      code: l.code,
      title: typeLabel(l.type),
      scope: `Lớp ${className(l.classId)}`,
      period: periodLabel(l),
      by: l.createdBy,
      status: l.status,
      history: l.history,
    })),
  ];
  const pending = items.filter((i) => i.status === EDU_STATUS.PENDING_VP);
  const done = items.filter((i) => i.history.some((h) => h.role === ROLE_LABELS[ROLES.VICE_PRINCIPAL]));
  const rows = (tab === 'pending' ? pending : done).filter((i) => !kind || i.kind === kind);
  const lastAt = (i) => i.history.at(-1)?.at;

  const stats = [
    { kind: '', label: 'Đang chờ bạn duyệt', value: pending.length, tone: 'purple' },
    { kind: 'chu-de', label: 'Kế hoạch chủ đề chờ duyệt', value: pending.filter((p) => p.kind === 'chu-de').length, tone: 'blue' },
    { kind: 'giao-an', label: 'Giáo án chờ duyệt', value: pending.filter((p) => p.kind === 'giao-an').length, tone: 'orange' },
  ];

  return (
    <div className="page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Phê duyệt kế hoạch' }]}
        title="Phê duyệt kế hoạch"
        desc="Kế hoạch chủ đề của tổ trưởng và giáo án đã qua tổ trưởng xem xét, chờ Phó hiệu trưởng quyết định."
      />
      <div className="stat-grid">
        {stats.map((s) => (
          <button
            key={s.kind || 'all'}
            className={`stat-card stat-card--${s.tone} ${tab === 'pending' && kind === s.kind ? 'stat-card--active' : ''}`}
            onClick={() => {
              setTab('pending');
              setKind(s.kind);
            }}
          >
            <div className="stat-card__value">{s.value}</div>
            <div className="stat-card__label">{s.label}</div>
            <StatCardIcon tone={s.tone} />
          </button>
        ))}
      </div>
      <Card bodyClass={null}>
        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'pending'}
            className={`tab ${tab === 'pending' ? 'tab--active' : ''}`}
            onClick={() => setTab('pending')}
          >
            Chờ duyệt <span className="tab__count">{pending.length}</span>
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
        <div className="filter-bar">
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Lọc theo loại">
            <option value="">Tất cả loại kế hoạch</option>
            <option value="chu-de">Kế hoạch chủ đề</option>
            <option value="giao-an">Giáo án</option>
          </select>
        </div>
        {rows.length === 0 ? (
          <EmptyState title={tab === 'pending' ? 'Không có kế hoạch chờ duyệt' : 'Chưa xử lý kế hoạch nào'} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Kế hoạch</th>
                  <th>Phạm vi</th>
                  <th>Thời gian</th>
                  <th>Người lập</th>
                  <th>Cập nhật</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr
                    key={i.kind + i.id}
                    className="row-click"
                    onClick={() =>
                      navigate(
                        tab === 'pending'
                          ? `/education/approvals/${i.kind}/${i.id}`
                          : i.kind === 'chu-de'
                            ? `/education/themes/${i.id}`
                            : `/education/lessons/${i.id}`,
                      )
                    }
                  >
                    <td>
                      <div className="ga-cell-title">{i.title}</div>
                      <div className="ga-cell-sub">{i.code}</div>
                    </td>
                    <td>{i.scope}</td>
                    <td>{i.period}</td>
                    <td>{i.by}</td>
                    <td>{fmtDateTime(lastAt(i))}</td>
                    <td>
                      <EduStatusBadge status={i.status} />
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
