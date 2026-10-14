import { useNavigate } from 'react-router-dom';
import { Card, EduStatusBadge, EmptyState, PageHead, YearPlanStatusBadge, fmtDateTime } from '@/components/education-plan/eduUi';
import { LoadingState } from '@/components/ui/States';
import { useClasses } from '@/hooks/useSchool';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { ROLES } from '@/models/User';
import { AGE_GROUPS, EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { CLASS_DOC_LABELS, addDays, ddmm } from '@/models/education-plan/classPlan';
import { PENDING_OF } from '@/models/education-plan/eduConfig';

/**
 * Hộp duyệt: tổ trưởng thấy kế hoạch chủ đề, giáo án tuần của các lớp trong khối đang chờ tổ trưởng;
 * Phó HT thấy tài liệu chờ Phó HT và kế hoạch năm chờ ký ban hành. Danh sách chỉ để mở nhanh; quyền duyệt do service kiểm.
 */
export default function PlanReviewQueuePage() {
  const { user, goals, branchPlans, classThemePlans, weekPlans } = useEducationPlan();
  const navigate = useNavigate();
  const { classes, loading } = useClasses();
  if (loading) return <LoadingState />;

  const isVp = user.role === ROLES.VICE_PRINCIPAL;
  // Trạng thái chờ đúng vai trò người dùng (thứ tự duyệt theo cấu hình của trường)
  const waiting = PENDING_OF[user.role];
  const classOf = (id) => classes.find((c) => c.id === id);
  const mine = (doc) => {
    const cls = classOf(doc.classId);
    return !!cls && doc.status === waiting && (user.role !== ROLES.TEAM_LEADER || cls.ageGroupId === user.ageGroupId);
  };
  const themeName = (doc) => goals.find((g) => g.id === doc.yearPlanId)?.themes?.find((t) => t.id === doc.themeId)?.name || '—';
  const sentAt = (doc) => [...(doc.history || [])].reverse().find((h) => !h.tone);
  const items = [
    ...(isVp
      ? goals
          .filter((g) => g.status === EDU_STATUS.PENDING_VP)
          .map((g) => ({
            key: `y-${g.id}`,
            kind: 'year',
            doc: g,
            cls: '—',
            what: `Khối ${AGE_GROUPS.find((a) => a.id === g.ageGroupId)?.name || ''}, năm học ${g.schoolYear}`,
            to: `/education/goals/${g.id}`,
            // Người gửi: người bấm "Gửi Phó HT ban hành" (tổ trưởng), không phải người ký sau cùng
            by: [...(g.history || [])].reverse().find((h) => h.action?.startsWith('Gửi'))?.by,
            at: g.sentAt,
          }))
      : []),
    ...branchPlans.filter(mine).map((d) => ({ kind: 'branch', doc: d, what: 'Cả năm học', to: `/education/class/${d.classId}` })),
    ...classThemePlans
      .filter(mine)
      .map((d) => ({ kind: 'theme', doc: d, what: `Chủ đề ${themeName(d)}`, to: `/education/class/${d.classId}/themes/${d.themeId}` })),
    ...weekPlans.filter(mine).map((d) => ({
      kind: 'week',
      doc: d,
      what: `Tuần ${d.weekNo} (${ddmm(d.weekStart)} → ${ddmm(addDays(d.weekStart, 4))}) · ${themeName(d)}`,
      to: `/education/class/${d.classId}/weeks/${d.weekStart}`,
    })),
  ].map((it) => ({
    key: `${it.kind}-${it.doc.id}`,
    cls: classOf(it.doc.classId)?.name || '—',
    by: sentAt(it.doc)?.by,
    at: sentAt(it.doc)?.at,
    ...it,
  }));

  return (
    <div className="page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Duyệt kế hoạch, giáo án' }]}
        title="Duyệt kế hoạch, giáo án"
        desc={
          isVp
            ? 'Tài liệu của các lớp đang chờ Phó hiệu trưởng duyệt, và kế hoạch năm chờ ban hành.'
            : user.role === ROLES.PRINCIPAL
              ? 'Tài liệu của các lớp đang chờ Hiệu trưởng duyệt (theo cấu hình người ký).'
              : 'Kế hoạch chủ đề và giáo án tuần của các lớp trong khối chờ tổ trưởng duyệt. Tài liệu bạn duyệt chuyển tiếp tới người duyệt sau.'
        }
      />
      <Card bodyClass={null}>
        {items.length === 0 ? (
          <EmptyState title="Không có tài liệu chờ duyệt" desc="Khi giáo viên gửi kế hoạch hoặc giáo án, tài liệu sẽ hiện ở đây." />
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
                {items.map((it) => (
                  <tr
                    key={it.key}
                    className="row-click"
                    tabIndex={0}
                    onClick={() => navigate(it.to)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(it.to)}
                  >
                    <td className="fw-600">{CLASS_DOC_LABELS[it.kind]}</td>
                    <td>{it.cls}</td>
                    <td>{it.what}</td>
                    <td>{it.by || '—'}</td>
                    <td>{it.at ? fmtDateTime(it.at) : '—'}</td>
                    <td>
                      {it.kind === 'year' ? <YearPlanStatusBadge status={it.doc.status} /> : <EduStatusBadge status={it.doc.status} />}
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
