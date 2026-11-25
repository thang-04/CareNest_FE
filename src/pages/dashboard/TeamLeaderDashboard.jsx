import { BookOpenCheck, ClipboardCheck, Layers, ListChecks, Star } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useWidget, usePendingApprovals } from '@/hooks/dashboard/useDashboard';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Widget, Shortcuts, ShortList } from '@/components/dashboard/DashboardWidgets';
import { ApprovalsWidget } from '@/components/dashboard/ApprovalsWidget';
import { ClassTodayPanel } from '@/components/dashboard/ClassTodayPanel';
import { getAllClassDocSummaries, getClassDocContext } from '@/services/education-plan/educationPlanService';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { EduStatusBadge } from '@/components/education-plan/eduUi';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { ageGroupById } from '@/models/School';
import '@/styles/modules/dashboard.css';

/**
 * #13 Trang chủ Tổ trưởng — phương án A (plan 2026-11-13-home-day-rhythm): cùng khung lớp hôm nay + tiến độ 5 bước của lớp mình
 * (số cấp nhóm tuổi BE chưa mở cho tổ trưởng), cột phải là việc chờ tổ trưởng: kế hoạch giáo dục ngày chờ duyệt, kế hoạch chủ đề cần hoàn thiện.
 */
export default function TeamLeaderDashboard() {
  const { user } = useAuth();
  const approvals = usePendingApprovals();
  const { schoolYear } = useSchoolYear();
  // Hồ sơ chủ đề còn Nháp (kể cả bị trả lại, EDU-05) của lớp thuộc nhóm tuổi mình
  const themesQ = useWidget(
    async (u) => {
      const [docs, context] = await Promise.all([
        getAllClassDocSummaries(schoolYear, u, ['semester'], { statuses: [EDU_STATUS.DRAFT], currentOnly: true }),
        getClassDocContext(schoolYear, u),
      ]);
      const own = new Map((context.classes || []).filter((c) => String(c.ageGroupId) === String(user.ageGroupId)).map((c) => [String(c.id), c.name]));
      return docs.filter((d) => own.has(String(d.classId))).map((d) => ({ ...d, className: own.get(String(d.classId)) }));
    },
    [schoolYear, user.ageGroupId],
  );
  const toFix = themesQ.data || [];
  const group = ageGroupById(user.ageGroupId);
  const shortcuts = [
    {
      to: '/education/plan-reviews',
      label: <>Chờ duyệt {approvals.total > 0 && <span className="tab__count">{approvals.total}</span>}</>,
      icon: ListChecks,
    },
    { to: '/education/class', label: 'Kế hoạch chủ đề', icon: Layers },
    { to: '/attendance', label: 'Điểm danh & báo ăn', icon: ClipboardCheck },
    { to: '/assessment/daily', label: 'Đánh giá hằng ngày', icon: Star },
  ];
  return (
    <div className="page">
      <DashboardHeader subtitle={group ? `Tổ trưởng nhóm tuổi ${group.shortName}` : undefined} />
      <Shortcuts links={shortcuts} />
      <ClassTodayPanel
        aside={
          <>
            <ApprovalsWidget approvals={approvals} />
            <Widget
              title="Kế hoạch chủ đề cần hoàn thiện"
              icon={Layers}
              to="/education/class"
              loading={themesQ.loading && !themesQ.data}
              error={themesQ.error}
              onRetry={themesQ.reload}
              empty={!toFix.length}
              emptyTitle="Không có kế hoạch chủ đề cần hoàn thiện"
              emptyText="Kế hoạch nháp hoặc bị Phó hiệu trưởng từ chối sẽ hiện ở đây."
            >
              <ShortList
                rows={toFix.slice(0, 5).map((t) => ({
                  key: t.id,
                  to: '/education/theme-plans',
                  icon: BookOpenCheck,
                  code: t.className,
                  title: `Học kỳ ${t.semesterNo}: kế hoạch chủ đề`,
                  // Badge ở dòng phụ: cột 1/3 hẹp, badge cuối dòng làm vỡ tiêu đề
                  meta: <EduStatusBadge status={t.status} doc={t} />,
                }))}
              />
            </Widget>
          </>
        }
      />
    </div>
  );
}
