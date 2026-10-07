import { BookOpenCheck, Layers } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWidget, usePendingApprovals } from '@/hooks/dashboard/useDashboard';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Widget, KpiCard, ShortList } from '@/components/dashboard/DashboardWidgets';
import { ApprovalsWidget } from '@/components/dashboard/ApprovalsWidget';
import { ClassTodayPanel } from '@/components/dashboard/ClassTodayPanel';
import { FacilityTasksWidget } from '@/components/dashboard/FacilityTasksWidget';
import { getEducationPlans } from '@/services/education-plan/educationPlanService';
import { EDU_STATUS, EDU_STATUS_LABELS } from '@/models/education-plan/educationPlanConstants';
import { ageGroupById } from '@/models/School';
import { formatDate } from '@/utils/format';
import '@/styles/modules/dashboard.css';

const TO_FIX = [EDU_STATUS.DRAFT, EDU_STATUS.REJECTED];

/**
 * #13 Age-Group Team Leader Dashboard: planning and lesson-plan review of the own age group (footnote ³),
 * plus the teacher screens of their own class (footnote ²).
 */
export default function TeamLeaderDashboard() {
  const { user } = useAuth();
  const approvals = usePendingApprovals();
  const themesQ = useWidget(
    () => getEducationPlans().then((d) => d.themes.filter((t) => t.ageGroupId === user.ageGroupId)),
    [user.ageGroupId],
  );
  const themes = themesQ.data || [];
  const count = (statuses) => themes.filter((t) => statuses.includes(t.status)).length;
  const kpi = { loading: themesQ.loading && !themesQ.data, error: themesQ.error };
  const toFix = themes.filter((t) => TO_FIX.includes(t.status));
  const group = ageGroupById(user.ageGroupId);

  return (
    <div className="page">
      <DashboardHeader subtitle={group ? `Nhóm tuổi ${group.shortName}` : undefined} />

      <div className="stat-grid">
        <KpiCard
          to="/education/reviews"
          tone="purple"
          label="Giáo án chờ bạn duyệt"
          value={approvals.total}
          loading={approvals.loading && !approvals.groups.length}
          error={approvals.error}
        />
        <KpiCard
          to="/education/themes"
          tone="red"
          label="Kế hoạch chủ đề cần hoàn thiện"
          value={count(TO_FIX)}
          hint="Nháp hoặc bị từ chối"
          {...kpi}
        />
        <KpiCard
          to="/education/themes"
          tone="orange"
          label="Kế hoạch chủ đề chờ PHT duyệt"
          value={count([EDU_STATUS.PENDING_VP])}
          {...kpi}
        />
        <KpiCard to="/education/themes" tone="green" label="Kế hoạch chủ đề đã duyệt" value={count([EDU_STATUS.APPROVED])} {...kpi} />
      </div>

      <div className="db-grid">
        <ApprovalsWidget approvals={approvals} />
        <Widget
          title="Kế hoạch chủ đề của nhóm tuổi"
          icon={Layers}
          to="/education/themes"
          loading={kpi.loading}
          error={themesQ.error}
          onRetry={themesQ.reload}
          empty={!toFix.length}
          emptyTitle="Không có kế hoạch chủ đề cần hoàn thiện"
          emptyText="Kế hoạch nháp hoặc bị Phó hiệu trưởng từ chối sẽ hiện ở đây."
        >
          <ShortList
            rows={toFix.slice(0, 5).map((t) => ({
              key: t.id,
              to: `/education/themes/${t.id}`,
              icon: BookOpenCheck,
              code: t.code,
              title: t.name,
              meta: `${EDU_STATUS_LABELS[t.status]} · ${formatDate(t.startDate)} – ${formatDate(t.endDate)}`,
            }))}
          />
        </Widget>
      </div>

      <h2 className="section-title mt-24">Lớp của bạn</h2>
      <ClassTodayPanel />
      <div className="db-grid mt-16">
        <FacilityTasksWidget />
      </div>
    </div>
  );
}
