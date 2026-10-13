import { useNavigate } from 'react-router-dom';
import { Card, EduStatusBadge, EmptyState, PageHead, fmtDateTime } from '@/components/education-plan/eduUi';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useAsync } from '@/hooks/useAsync';
import { useClasses } from '@/hooks/useSchool';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { getPlanReviewQueue } from '@/services/education-plan/educationPlanService';
import { ROLES } from '@/models/User';
import { AGE_GROUPS } from '@/models/School';
import { PLAN_KIND, PLAN_KIND_LABELS, addDays, ddmm } from '@/models/education-plan/yearPlanModel';

const linkOf = (it) =>
  ({
    [PLAN_KIND.YEAR]: `/education/year-plans/${it.id}`,
    [PLAN_KIND.BRANCH]: `/education/class/${it.classId}`,
    [PLAN_KIND.THEME]: `/education/class/${it.classId}/themes/${it.doc.themeId}`,
    [PLAN_KIND.WEEK]: `/education/class/${it.classId}/weeks/${it.doc.weekStart}`,
  })[it.kind];

/** Hàng chờ duyệt: tổ trưởng duyệt trước, Phó hiệu trưởng duyệt sau (danh sách do service trả theo vai trò). */
export default function PlanReviewQueuePage() {
  const { authUser, yearPlans, role } = useEducationPlan();
  const navigate = useNavigate();
  const { classes } = useClasses({ all: true });
  const { data, loading, error, reload } = useAsync(() => getPlanReviewQueue(authUser), [authUser.id], { refreshOnDataChange: true });

  const className = (id) => classes.find((c) => c.id === id)?.name || '—';
  const themeName = (doc) => yearPlans.find((p) => p.id === doc.yearPlanId)?.themes.find((t) => t.id === doc.themeId)?.name || '—';
  const describe = (it) => {
    const d = it.doc;
    if (it.kind === PLAN_KIND.YEAR) return `Khối ${AGE_GROUPS.find((g) => g.id === d.ageGroupId)?.shortName}, năm học ${d.schoolYear}`;
    if (it.kind === PLAN_KIND.THEME) return `Chủ đề ${themeName(d)}`;
    if (it.kind === PLAN_KIND.WEEK)
      return `Tuần ${d.weekNo}: ${d.branchName || themeName(d)} (${ddmm(d.weekStart)} → ${ddmm(addDays(d.weekStart, 4))})`;
    return 'Cả năm học';
  };
  const sentAt = (it) => [...(it.doc.history || [])].reverse().find((h) => !h.tone);

  return (
    <div className="page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Duyệt kế hoạch, giáo án' }]}
        title="Duyệt kế hoạch, giáo án"
        desc={
          role === ROLES.TEAM_LEADER
            ? 'Tài liệu của các lớp trong khối chờ tổ trưởng xem trước. Tài liệu bạn duyệt chuyển tiếp tới Phó hiệu trưởng.'
            : 'Tài liệu đã qua tổ trưởng (hoặc không cần tổ trưởng) chờ Phó hiệu trưởng duyệt, và kế hoạch năm chờ ban hành.'
        }
      />
      <Card bodyClass={null}>
        {loading && !data ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : !data?.length ? (
          <EmptyState title="Không có tài liệu chờ duyệt" desc="Khi giáo viên gửi giáo án hoặc kế hoạch, tài liệu sẽ hiện ở đây." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Loại</th>
                  <th>Lớp</th>
                  <th>Nội dung</th>
                  <th>Người gửi</th>
                  <th>Gửi lúc</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {data.map((it) => {
                  const s = sentAt(it);
                  return (
                    <tr key={`${it.kind}-${it.id}`} className="row-click" onClick={() => navigate(linkOf(it))}>
                      <td className="ga-cell-title">{PLAN_KIND_LABELS[it.kind]}</td>
                      <td>{it.classId ? className(it.classId) : '—'}</td>
                      <td>{describe(it)}</td>
                      <td>{s?.by || '—'}</td>
                      <td>{s ? fmtDateTime(s.at) : '—'}</td>
                      <td>
                        <EduStatusBadge status={it.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
