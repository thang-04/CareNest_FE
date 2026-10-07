import { ClassTodayPanel } from '@/components/dashboard/ClassTodayPanel';
import { FacilityTasksWidget } from '@/components/dashboard/FacilityTasksWidget';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import '@/styles/modules/dashboard.css';

/** #12 Teacher Dashboard: today's class tasks (attendance & meals, lesson plans, health, assessment, pickup, facilities). */
export default function TeacherDashboard() {
  return (
    <div className="page">
      <DashboardHeader subtitle="Việc cần làm hôm nay của lớp bạn phụ trách." />
      <ClassTodayPanel />
      <div className="db-grid mt-16">
        <FacilityTasksWidget />
      </div>
    </div>
  );
}
