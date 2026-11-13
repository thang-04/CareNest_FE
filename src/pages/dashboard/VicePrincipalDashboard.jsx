import { BookOpenCheck, ChefHat, ClipboardList, KeyRound, ListChecks, UserCog, UserPlus } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useWidget, usePendingApprovals, useDashboardToday, useDayProgress } from '@/hooks/dashboard/useDashboard';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Widget, Shortcuts, ShortList, TaskCount } from '@/components/dashboard/DashboardWidgets';
import { ApprovalsWidget } from '@/components/dashboard/ApprovalsWidget';
import { AttentionWidget, ClassRankWidget, LunchWidget } from '@/components/dashboard/TodayWidgets';
import { TodayOverview } from '@/components/dashboard/TodayOverview';
import { DayProgress } from '@/components/dashboard/DayProgress';
import { Spinner } from '@/components/ui/States';
import { getChildren, getParentAccounts } from '@/services/children/childrenService';
import { getMissingFoodReports } from '@/services/kitchen/kitchenService';
import { CHILD_STATUS } from '@/models/School';
import { MISSING_STATUS } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/dashboard.css';

const endOf = (q, count) =>
  q.loading && q.data == null ? <Spinner small deferred /> : q.error ? <span className="muted">—</span> : <TaskCount value={count} />;

/**
 * #11 Trang chủ Phó hiệu trưởng — phương án A (plan 2026-11-13-home-day-rhythm): cùng khung Hiệu trưởng, phạm vi điểm trường
 * phụ trách (BE trả theo scope). Cột phải: chờ duyệt, việc của PHT (trẻ chờ xếp lớp, tài khoản phụ huynh, bếp báo thiếu), bữa trưa.
 */
export default function VicePrincipalDashboard() {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const md = useMasterData();
  const campusId = user.campusId;
  const approvals = usePendingApprovals();
  const todayQ = useDashboardToday();
  const dayQ = useDayProgress(todayQ);
  const childrenQ = useWidget((u) => getChildren({ schoolYear }, u), [schoolYear]);
  const parentsQ = useWidget((u) => getParentAccounts({ status: 'NOT_ACTIVATED' }, u));
  const missingQ = useWidget((u) => getMissingFoodReports({ campusId, status: MISSING_STATUS.SUBMITTED }, u), [campusId]);
  const pendingPlacement = (childrenQ.data || []).filter((c) => c.status === CHILD_STATUS.PENDING_PLACEMENT).length;
  const campus = md.campusById(campusId);
  const campusLabel = campus?.shortName || campus?.name;
  const shortcuts = [
    {
      to: '/approvals',
      label: <>Chờ duyệt {approvals.total > 0 && <span className="tab__count">{approvals.total}</span>}</>,
      icon: ListChecks,
    },
    { to: '/attendance/summary', label: 'Tổng hợp điểm danh', icon: ClipboardList },
    { to: '/children/placement', label: 'Xếp lớp', icon: UserPlus },
    { to: '/school/teachers', label: 'Phân công giáo viên', icon: UserCog },
    { to: '/education/plan-reviews', label: 'Kế hoạch giáo dục', icon: BookOpenCheck },
  ];
  return (
    <div className="page">
      <DashboardHeader subtitle={campus ? campus.name : undefined} />
      <Shortcuts links={shortcuts} />

      <div className="db-day">
        <TodayOverview q={todayQ} title={campusLabel ? `Hôm nay · ${campusLabel}` : 'Hôm nay'} />
        <DayProgress q={dayQ} />
      </div>

      <div className="db-board">
        <div className="db-board__main">
          <AttentionWidget q={todayQ} />
          <ClassRankWidget q={todayQ} />
        </div>
        <div className="db-board__aside">
          <ApprovalsWidget approvals={approvals} />
          <Widget title="Việc của bạn" icon={ListChecks}>
            <ShortList
              rows={[
                {
                  key: 'placement',
                  to: '/children/placement',
                  icon: UserPlus,
                  title: 'Trẻ chờ xếp lớp',
                  meta: childrenQ.error ? 'Không tải được – mở chức năng để xem' : 'Trẻ đã tiếp nhận chưa có lớp',
                  end: endOf(childrenQ, pendingPlacement),
                },
                {
                  key: 'parents',
                  to: '/children/activation',
                  icon: KeyRound,
                  title: 'Tài khoản phụ huynh chưa kích hoạt',
                  meta: parentsQ.error ? 'Không tải được – mở chức năng để xem' : 'Nhắc phụ huynh kích hoạt để nhận thông báo',
                  end: endOf(parentsQ, (parentsQ.data || []).length),
                },
                {
                  key: 'missing',
                  to: '/kitchen/missing-food',
                  icon: ChefHat,
                  title: 'Bếp báo thiếu thực phẩm',
                  meta: missingQ.error ? 'Không tải được – mở chức năng để xem' : 'Báo cáo bếp gửi chờ xử lý',
                  end: endOf(missingQ, (missingQ.data || []).length),
                },
              ]}
            />
          </Widget>
          <LunchWidget q={dayQ} />
        </div>
      </div>
    </div>
  );
}
