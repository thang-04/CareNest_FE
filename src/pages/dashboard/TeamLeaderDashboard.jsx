import { BookOpenCheck, ClipboardCheck, Layers, ListChecks, Star } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useWidget, usePendingApprovals } from '@/hooks/dashboard/useDashboard';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Widget, Shortcuts, ShortList } from '@/components/dashboard/DashboardWidgets';
import { ApprovalsWidget } from '@/components/dashboard/ApprovalsWidget';
import { ClassTodayPanel } from '@/components/dashboard/ClassTodayPanel';
import { getEducationPlans } from '@/services/education-plan/educationPlanService';
import { EduStatusBadge } from '@/components/education-plan/eduUi';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { ageGroupById } from '@/models/School';
import { formatDate } from '@/utils/format';
import '@/styles/modules/dashboard.css';
const TO_FIX = [EDU_STATUS.DRAFT, EDU_STATUS.REJECTED];

/**
 * #13 Trang chủ Tổ trưởng — phương án A (plan 2026-11-13-home-day-rhythm): cùng khung lớp hôm nay + tiến độ 5 bước của lớp mình
 * (số cấp nhóm tuổi BE chưa mở cho tổ trưởng), cột phải là việc chờ tổ trưởng: giáo án chờ duyệt, kế hoạch chủ đề cần hoàn thiện.
 */
export default function TeamLeaderDashboard() {
  const { user } = useAuth();
  const approvals = usePendingApprovals();
  const themesQ = useWidget(
    () => getEducationPlans().then((d) => d.themes.filter((t) => t.ageGroupId === user.ageGroupId)),
    [user.ageGroupId],
  );
  const toFix = (themesQ.data || []).filter((t) => TO_FIX.includes(t.status));
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
                  code: t.code,
                  title: t.name,
                  // Badge ở dòng phụ: cột 1/3 hẹp, badge cuối dòng làm vỡ tiêu đề
                  meta: (
                    <>
                      <EduStatusBadge status={t.status} /> {formatDate(t.startDate)} – {formatDate(t.endDate)}
                    </>
                  ),
                }))}
              />
            </Widget>
          </>
        }
      />
    </div>
  );
}
