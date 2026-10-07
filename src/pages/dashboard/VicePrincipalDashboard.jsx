import { UserCog, BookOpenCheck, ListChecks, Building2, ChefHat, CookingPot, UserRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useWidget, usePendingApprovals } from '@/hooks/dashboard/useDashboard';
import { Spinner } from '@/components/ui/States';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Widget, KpiCard, Shortcuts, ShortList, TaskCount } from '@/components/dashboard/DashboardWidgets';
import { ApprovalsWidget } from '@/components/dashboard/ApprovalsWidget';
import { FacilityTasksWidget } from '@/components/dashboard/FacilityTasksWidget';
import { PrepStatusBadge } from '@/components/kitchen/KitchenBadges';
import { getChildren, getParentAccounts } from '@/services/children/childrenService';
import { getMealCounts } from '@/services/attendance/attendanceService';
import { getMealPreparations, getMissingFoodReports } from '@/services/kitchen/kitchenService';
import { CHILD_STATUS } from '@/models/School';
import { MEAL_SESSION_LABELS, MISSING_STATUS } from '@/models/kitchen/kitchenConstants';
import { MEAL_COUNT_STATUS_LABELS } from '@/models/attendance/attendanceConstants';
import { formatDate, todayInput } from '@/utils/format';
import '@/styles/modules/dashboard.css';

const firstLoad = (q) => q.loading && q.data == null;
const endOf = (q, count) => (firstLoad(q) ? <Spinner small /> : q.error ? <span className="muted">—</span> : <TaskCount value={count} />);

/** Today's attendance of the campus, read from the first meal session count (present / absent / not yet recorded). */
const attendanceOf = (counts = []) => {
  const first = counts.find((c) => c.session === 'LUNCH') || counts[0];
  if (!first) return null;
  const t = first.totals;
  return { present: t.present, total: t.present + t.absent + t.missing, missing: t.missing };
};

const SHORTCUTS = [
  { to: '/school/teachers', label: 'Phân công giáo viên', icon: UserCog },
  { to: '/education/approvals', label: 'Kế hoạch giáo dục', icon: BookOpenCheck },
  { to: '/approvals', label: 'Chờ duyệt', icon: ListChecks },
  { to: '/facility/issues', label: 'Vận hành điểm trường', icon: Building2 },
  { to: '/kitchen/preparation', label: 'Dịch vụ bán trú', icon: ChefHat },
];

/**
 * #11 Vice Principal Dashboard: indicators of the managed campus (footnote ¹), items waiting for approval
 * and the menus Teacher Permission, Education Plans, Approvals, Campus Operations and Meal Services.
 */
export default function VicePrincipalDashboard() {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const md = useMasterData();
  const date = todayInput();
  const campusId = user.campusId;
  const approvals = usePendingApprovals();

  const childrenQ = useWidget((u) => getChildren({ schoolYear }, u), [schoolYear]);
  const parentsQ = useWidget((u) => getParentAccounts({ status: 'NOT_ACTIVATED' }, u));
  const countsQ = useWidget((u) => getMealCounts({ date }, u), [date]);
  const prepQ = useWidget((u) => getMealPreparations({ campusId, date }, u), [campusId, date]);
  const missingQ = useWidget((u) => getMissingFoodReports({ campusId, status: MISSING_STATUS.SUBMITTED }, u), [campusId]);

  const children = childrenQ.data || [];
  const active = children.filter((c) => c.status === CHILD_STATUS.ACTIVE).length;
  const pendingPlacement = children.filter((c) => c.status === CHILD_STATUS.PENDING_PLACEMENT).length;
  const counts = countsQ.data?.counts || [];
  const att = attendanceOf(counts);
  const preps = (prepQ.data || []).filter((p) => p.hasMenu);
  const campus = md.campusById(campusId);

  return (
    <div className="page">
      <DashboardHeader subtitle={campus ? campus.name : undefined} />
      <Shortcuts links={SHORTCUTS} />

      <div className="stat-grid">
        <KpiCard to="/children" tone="blue" label="Trẻ đang học" value={active} loading={firstLoad(childrenQ)} error={childrenQ.error} />
        <KpiCard
          to="/children/placement"
          tone={pendingPlacement ? 'orange' : 'green'}
          label="Trẻ chờ xếp lớp"
          value={pendingPlacement}
          loading={firstLoad(childrenQ)}
          error={childrenQ.error}
        />
        <KpiCard
          to="/attendance/summary"
          tone="green"
          label="Có mặt hôm nay"
          value={att ? `${att.present}/${att.total}` : '—'}
          hint={att ? (att.missing ? `${att.missing} trẻ chưa được điểm danh` : 'Đã điểm danh đủ') : 'Hôm nay không có số liệu điểm danh'}
          loading={firstLoad(countsQ)}
          error={countsQ.error}
        />
        <KpiCard
          to="/approvals"
          tone="purple"
          label="Chờ bạn duyệt"
          value={approvals.total}
          hint={approvals.failed.length ? `${approvals.failed.length} nhóm không tải được` : undefined}
          loading={approvals.loading && !approvals.groups.length}
          error={approvals.error}
        />
        <KpiCard
          to="/kitchen/missing-food"
          tone="red"
          label="Bếp báo thiếu thực phẩm"
          value={(missingQ.data || []).length}
          loading={firstLoad(missingQ)}
          error={missingQ.error}
        />
        <KpiCard
          to="/children/activation"
          tone="orange"
          label="Tài khoản phụ huynh chưa kích hoạt"
          value={(parentsQ.data || []).length}
          loading={firstLoad(parentsQ)}
          error={parentsQ.error}
        />
      </div>

      <div className="db-grid">
        <ApprovalsWidget approvals={approvals} />
        <Widget
          title={`Bán trú hôm nay, ${formatDate(date)}`}
          icon={CookingPot}
          to="/kitchen/preparation"
          linkLabel="Xem tình trạng chế biến"
          loading={firstLoad(countsQ) || firstLoad(prepQ)}
          error={countsQ.error && prepQ.error ? countsQ.error : null}
          onRetry={() => {
            countsQ.reload();
            prepQ.reload();
          }}
          empty={!counts.length && !preps.length}
          emptyTitle="Hôm nay không có bữa ăn bán trú"
        >
          <ShortList
            rows={counts.map((c) => {
              const prep = preps.find((p) => p.session === c.session);
              const meals = c.totals.normal + c.totals.substitute;
              return {
                key: c.session,
                to: `/attendance/meal-count?date=${date}`,
                icon: ChefHat,
                title: MEAL_SESSION_LABELS[c.session] || c.session,
                meta: `${meals} suất (${c.totals.substitute} thay thế) · ${MEAL_COUNT_STATUS_LABELS[c.status] || c.status}`,
                end: prep ? <PrepStatusBadge status={prep.record?.status || 'NOT_STARTED'} /> : null,
              };
            })}
          />
          {att && att.total > 0 && (
            <div className="mt-16">
              <div className="text-sm text-2 mb-8">Tỷ lệ trẻ có mặt</div>
              <ProgressBar value={att.present} total={att.total} tone="green" />
            </div>
          )}
        </Widget>
      </div>

      <div className="db-grid">
        <FacilityTasksWidget />
        <Widget title="Hồ sơ trẻ cần xử lý" icon={UserRound} to="/children" linkLabel="Danh sách trẻ">
          <ShortList
            rows={[
              {
                key: 'placement',
                to: '/children/placement',
                title: 'Xếp lớp cho trẻ mới tiếp nhận',
                meta: childrenQ.error ? 'Không tải được danh sách trẻ' : 'Trẻ đã tiếp nhận nhưng chưa có lớp',
                end: endOf(childrenQ, pendingPlacement),
              },
              {
                key: 'activation',
                to: '/children/activation',
                title: 'Kích hoạt tài khoản phụ huynh',
                meta: parentsQ.error ? 'Không tải được tài khoản phụ huynh' : 'Phụ huynh chưa nhận được tài khoản đăng nhập',
                end: endOf(parentsQ, (parentsQ.data || []).length),
              },
            ]}
          />
        </Widget>
      </div>
    </div>
  );
}
