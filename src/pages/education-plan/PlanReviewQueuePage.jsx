import { planLevel, planRoute } from '@/models/education-plan/planLevel.mjs';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, EduStatusBadge, EmptyState, PageHead, YearPlanStatusBadge, fmtDateTime } from '@/components/education-plan/eduUi';
import { useEducationPlan, useGoalDetails } from '@/hooks/education-plan/useEducationPlan';
import { ROLES } from '@/models/User';
import { AGE_GROUPS } from '@/models/education-plan/educationPlanConstants';
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
  const filterId = useId();
  const [ageGroupId, setAgeGroupId] = useState('');
  const [classId, setClassId] = useState('');
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
  // Tên, số thứ tự chủ đề lấy từ chi tiết kế hoạch tổ của hồ sơ
  useGoalDetails([...themeDossiers, ...classThemePlans].map((d) => d.yearPlanId));
  const themeName = (doc) => goals.find((g) => g.id === doc.yearPlanId)?.themes?.find((t) => t.id === doc.themeId)?.name || '—';
  const sentAt = (doc) => [...(doc.history || [])].reverse().find((h) => !h.tone);
  const items = [
    ...reviewGoals.map((g) => ({
      key: `y-${g.id}`,
      kind: 'year',
      doc: g,
      cls: '—',
      ageGroupId: g.ageGroupId != null ? String(g.ageGroupId) : '',
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
        what: `Chủ đề ${themeNumber(plan, d.themeId)}: ${themeName(d)} · kế hoạch giáo dục ngày`,
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
    ageGroupId: classOf(it.doc.classId)?.ageGroupId || '',
    by: sentAt(it.doc)?.by,
    at: sentAt(it.doc)?.at,
    note: submitEntryOf(it.doc)?.note,
    ...it,
  }));

  // Lọc nhóm tuổi trước rồi lớp (spec 005 FR-022); kế hoạch năm/tổ không theo lớp
  const groups = AGE_GROUPS.filter((g) => items.some((it) => String(it.ageGroupId) === String(g.id)));
  const groupClasses = classes.filter((c) => !ageGroupId || String(c.ageGroupId) === ageGroupId);
  const shown = items.filter((it) => (!ageGroupId || String(it.ageGroupId) === ageGroupId) && (!classId || it.doc.classId === classId));

  return (
    <div className="page ga-page">
      <div className="ga-sticky-head">
        <PageHead crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Duyệt kế hoạch giáo dục' }]} title="Duyệt kế hoạch giáo dục" />
        {items.length > 0 && (
          <div className="card mb-16">
            <div className="filter-bar">
              <div className="field">
                <label className="field__label" htmlFor={`${filterId}-age`}>
                  Nhóm tuổi
                </label>
                <select
                  id={`${filterId}-age`}
                  className="select"
                  value={ageGroupId}
                  onChange={(e) => {
                    setAgeGroupId(e.target.value);
                    setClassId('');
                  }}
                >
                  <option value="">Tất cả</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor={`${filterId}-class`}>
                  Lớp
                </label>
                <select
                  id={`${filterId}-class`}
                  className="select"
                  value={classId}
                  disabled={!ageGroupId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  <option value="">Tất cả</option>
                  {groupClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
      <Card bodyClass={null}>
        {shown.length === 0 ? (
          <EmptyState title="Không có tài liệu chờ duyệt" desc="Khi giáo viên gửi kế hoạch giáo dục, tài liệu sẽ hiện ở đây." />
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
                    <th className="center">Hạn</th>
                    <th className="cell--actions">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((it) => (
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
                            <EduStatusBadge status={it.doc.status} doc={it.doc} />
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="ga-goal-table__pad">
                          <DeadlineBadge doc={it.kind === 'year' ? it.doc.timeLock : it.doc} />
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
