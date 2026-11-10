import { planLevel, planRoute } from '@/models/education-plan/planLevel.mjs';
import { useNavigate } from 'react-router-dom';
import { Card, EduStatusBadge, EmptyState, PageHead, YearPlanStatusBadge, fmtDateTime } from '@/components/education-plan/eduUi';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { ROLES } from '@/models/User';
import { useAsync } from '@/hooks/useAsync';
import { usePolling } from '@/hooks/usePolling';
import { DeadlineBadge } from '@/components/education-plan/DeadlineWidgets';
import { getReviewQueue } from '@/services/education-plan/educationPlanService';
import { submitEntryOf } from '@/models/education-plan/reviewHistory.mjs';
import { CLASS_DOC_LABELS, themeNumber, themeWeeksOf } from '@/models/education-plan/classPlan';
import { PENDING_OF } from '@/models/education-plan/eduConfig';
import { clickableRowProps } from '@/utils/clickableRow';
import { Eye } from '@/components/ui/icons';

/**
 * Hộp duyệt: hồ sơ chủ đề (kế hoạch chủ đề + giáo án các nhánh) của các lớp trong khối đang chờ duyệt.
 */
export default function PlanReviewQueuePage() {
  const { user, goals, classThemePlans, themeDossiers = [], semesterPackages = [], classes, refreshClassDocs } = useEducationPlan();
  const navigate = useNavigate();
  // Kế hoạch năm/tổ chờ duyệt: BE trả riêng (danh sách thường chỉ có bản đã ban hành), tự làm mới không cần tải lại trang
  const queue = useAsync(() => getReviewQueue(user), [user.id], { refreshOnDataChange: true });
  usePolling(() => {
    queue.reload({ silent: true });
    refreshClassDocs?.().catch(() => {});
  });
  const reviewGoals = queue.data || [];

  // Trạng thái chờ đúng vai trò người dùng (thứ tự duyệt theo cấu hình của trường)
  const waiting = PENDING_OF[user.role];
  const classOf = (id) => classes.find((c) => c.id === id);
  const mine = (doc) => {
    const cls = classOf(doc.classId);
    if (!cls) return false;
    if (doc.permissions)
      return !!(doc.permissions.canApprove ?? doc.permissions.canIssue) || !!(doc.permissions.canReject ?? doc.permissions.canReturn);
    if (doc.status === 'REVIEW' && (doc.review?.waitingRole ?? doc.waitingRole) === user.role) {
      return user.role !== ROLES.TEAM_LEADER || cls.ageGroupId === user.ageGroupId;
    }
    return doc.status === waiting && (user.role !== ROLES.TEAM_LEADER || cls.ageGroupId === user.ageGroupId);
  };
  const themeName = (doc) => goals.find((g) => g.id === doc.yearPlanId)?.themes?.find((t) => t.id === doc.themeId)?.name || '—';
  const sentAt = (doc) => [...(doc.history || [])].reverse().find((h) => !h.tone);
  const items = [
    ...reviewGoals
      .map((g) => ({
        key: `y-${g.id}`,
        kind: 'year',
        doc: g,
        cls: '—',
        what: g.title,
        label: g.planTypeLabel || (planLevel(g) === 'SCHOOL_YEAR' ? 'Kế hoạch năm học' : 'Kế hoạch tổ'),
        to: `${planRoute(g)}/${g.id}`,
        by: g.sentBy?.name || submitEntryOf(g)?.by,
        at: g.sentAt ?? g.sentBy?.at,
      })),
    // Spec 003: gói học kỳ (lịch nhánh + chủ đề theo kỳ) và hồ sơ chủ đề là đơn vị duyệt
    ...semesterPackages.filter(mine).map((d) => ({
      kind: 'semester',
      label: 'Học kỳ',
      doc: d,
      what: `Học kỳ ${d.semesterNo}: chủ đề nhánh, kế hoạch chủ đề, kế hoạch tuần · ${(d.themeIds || []).length} chủ đề`,
      to: `/education/theme-plans/${d.classId}?hk=${d.semesterNo}`,
    })),
    ...themeDossiers.filter(mine).map((d) => {
      const plan = goals.find((g) => g.id === d.yearPlanId);
      return {
        kind: 'theme',
        label: 'Hồ sơ chủ đề',
        doc: d,
        what: `Chủ đề ${themeNumber(plan, d.themeId)}: ${themeName(d)} · giáo án ngày`,
        to: `/education/day-plans/${d.classId}?theme=${d.themeId}`,
      };
    }),
    // Bản mock cũ chưa có hồ sơ chủ đề tách riêng
    ...(themeDossiers.length ? [] : classThemePlans).filter(mine).map((d) => {
      const plan = goals.find((g) => g.id === d.yearPlanId);
      return {
        kind: 'theme',
        doc: d,
        what: `Kế hoạch giáo dục chủ đề ${themeNumber(plan, d.themeId)}: ${themeName(d)} · ${themeWeeksOf(plan, d.themeId).length} nhánh`,
        to: `/education/class/${d.classId}/themes/${d.themeId}`,
      };
    }),
  ].map((it) => ({
    key: `${it.kind}-${it.doc.id}`,
    cls: classOf(it.doc.classId)?.name || '—',
    by: sentAt(it.doc)?.by,
    at: sentAt(it.doc)?.at,
    note: submitEntryOf(it.doc)?.note,
    ...it,
  }));

  return (
    <div className="page ga-page">
      <PageHead crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Duyệt kế hoạch, giáo án' }]} title="Duyệt kế hoạch, giáo án" />
      <Card bodyClass={null}>
        {items.length === 0 ? (
          <EmptyState title="Không có tài liệu chờ duyệt" desc="Khi giáo viên gửi kế hoạch hoặc giáo án, tài liệu sẽ hiện ở đây." />
        ) : (
          <div className="card__body">
            <div className="table-wrap">
              <table className="table ga-plan-table ga-goal-table">
                {/* Bảng cố định độ rộng: cột hẹp cho loại/người gửi/thời điểm, chừa phần lớn cho Nội dung (ghi chú gửi) */}
                <colgroup>
                  <col className="ga-review-queue__short" />
                  <col className="ga-review-queue__class" />
                  <col />
                  <col className="ga-review-queue__short" />
                  <col className="ga-review-queue__short" />
                  <col className="ga-review-queue__status" />
                  <col className="ga-review-queue__actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Loại</th>
                    <th>Lớp</th>
                    <th>Nội dung</th>
                    <th>Người gửi</th>
                    <th>Gửi lúc</th>
                    <th className="center">Trạng thái</th>
                    <th className="cell--actions">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.key} className="row-click" {...clickableRowProps(() => navigate(it.to))}>
                      <td>
                        <div className="ga-goal-table__pad fw-600">{it.label || CLASS_DOC_LABELS[it.kind]}</div>
                      </td>
                      <td>
                        <div className="ga-goal-table__pad">{it.cls}</div>
                      </td>
                      <td>
                        <div className="ga-goal-table__pad">
                          {it.what}
                          {it.note && <div className="muted text-sm">Ghi chú: {it.note}</div>}
                        </div>
                      </td>
                      <td>
                        <div className="ga-goal-table__pad">{it.by || '—'}</div>
                      </td>
                      <td>
                        <div className="ga-goal-table__pad">{it.at ? fmtDateTime(it.at) : '—'}</div>
                      </td>
                      <td>
                        <div className="ga-goal-table__pad">
                          {it.kind === 'year' ? (
                            <YearPlanStatusBadge status={it.doc.status} doc={it.doc} />
                          ) : (
                            <span className="row row--wrap gap-2">
                              <EduStatusBadge status={it.doc.status} doc={it.doc} />
                              <DeadlineBadge doc={it.doc} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="cell--actions">
                        {/* Cả dòng bấm được; nút cho thấy rõ chỗ mở và dùng được bằng bàn phím */}
                        <button
                          type="button"
                          className="btn btn--sm btn--outline-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(it.to);
                          }}
                        >
                          <Eye size={16} aria-hidden /> Mở duyệt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
