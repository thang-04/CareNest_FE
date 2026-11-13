import { BookOpenCheck, ClipboardCheck, Baby, Star } from '@/components/ui/icons';
import { ClassTodayPanel } from '@/components/dashboard/ClassTodayPanel';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Shortcuts } from '@/components/dashboard/DashboardWidgets';
import '@/styles/modules/dashboard.css';

const SHORTCUTS = [
  { to: '/attendance', label: 'Điểm danh & báo ăn', icon: ClipboardCheck },
  { to: '/assessment/daily', label: 'Đánh giá hằng ngày', icon: Star },
  { to: '/pickup', label: 'Đón trẻ', icon: Baby },
  { to: '/education/theme-plans', label: 'Kế hoạch tuần', icon: BookOpenCheck },
];

/** #12 Trang chủ Giáo viên — phương án A (plan 2026-11-13-home-day-rhythm): lối tắt → lớp hôm nay → tiến độ 5 bước → cần chú ý. */
export default function TeacherDashboard() {
  return (
    <div className="page">
      <DashboardHeader subtitle="Việc cần làm hôm nay của lớp bạn phụ trách." />
      <Shortcuts links={SHORTCUTS} />
      <ClassTodayPanel />
    </div>
  );
}
