import { useState } from 'react';
import { CalendarDays, ClipboardList, ListChecks, UserRound, UtensilsCrossed } from '@/components/ui/icons';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { usePendingApprovals, useDashboardToday, useDayProgress } from '@/hooks/dashboard/useDashboard';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Shortcuts } from '@/components/dashboard/DashboardWidgets';
import { ApprovalsWidget } from '@/components/dashboard/ApprovalsWidget';
import { AttentionWidget, ClassRankWidget, LunchWidget } from '@/components/dashboard/TodayWidgets';
import { TodayOverview } from '@/components/dashboard/TodayOverview';
import { DayProgress } from '@/components/dashboard/DayProgress';
import '@/styles/modules/dashboard.css';

const RANK_LIMIT = 6;

/**
 * #10 Trang chủ Hiệu trưởng (UC 3.1) — phương án A "Nhịp một ngày" (chốt 12/11/2026, plan 2026-11-13-home-day-rhythm):
 * lối tắt → hôm nay toàn trường (lọc điểm trường) → tiến độ 5 bước → cần chú ý + xếp hạng lớp · chờ duyệt + bữa trưa. Chỉ đọc.
 */
export default function PrincipalDashboard() {
  const md = useMasterData();
  const { schoolYear } = useSchoolYear();
  const [campusId, setCampusId] = useState('');
  const approvals = usePendingApprovals();
  const todayQ = useDashboardToday(campusId);
  const dayQ = useDayProgress(todayQ, campusId);
  const campus = md.campusById(campusId);
  const campusName = (id) => md.campusById(id)?.shortName || md.campusById(id)?.name || id;
  const shortcuts = [
    {
      to: '/approvals',
      label: <>Chờ duyệt {approvals.total > 0 && <span className="tab__count">{approvals.total}</span>}</>,
      icon: ListChecks,
    },
    { to: '/attendance/summary', label: 'Tổng hợp điểm danh', icon: ClipboardList },
    { to: '/children', label: 'Danh sách trẻ', icon: UserRound },
    { to: '/menu/plans', label: 'Thực đơn tuần', icon: UtensilsCrossed },
    { to: '/school/years', label: 'Cấu hình trường', icon: CalendarDays },
  ];
  return (
    <div className="page">
      <DashboardHeader subtitle={`Toàn trường · Năm học ${String(schoolYear || '').replace('-', ' – ')}`} />
      <Shortcuts links={shortcuts} />

      <div className="db-day">
        <TodayOverview
          q={todayQ}
          title={campus ? `Hôm nay · ${campus.shortName || campus.name}` : 'Hôm nay toàn trường'}
          campuses={md.campuses}
          campusId={campusId}
          onCampusChange={setCampusId}
        />
        <DayProgress q={dayQ} />
      </div>

      <div className="db-board">
        <div className="db-board__main">
          <AttentionWidget q={todayQ} />
          <ClassRankWidget q={todayQ} limit={RANK_LIMIT} campusName={campusId ? null : campusName} />
        </div>
        <div className="db-board__aside">
          <ApprovalsWidget approvals={approvals} campusId={campusId} />
          <LunchWidget q={dayQ} />
        </div>
      </div>
    </div>
  );
}
