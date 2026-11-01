import {
  BookOpenCheck,
  Building2,
  CalendarCheck,
  ChefHat,
  CookingPot,
  KeyRound,
  ListChecks,
  Stethoscope,
  UserCog,
  UserPlus,
  Utensils,
} from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useWidget, usePendingApprovals, useDashboardToday } from '@/hooks/dashboard/useDashboard';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Widget, KpiCard, Shortcuts, ShortList, TaskCount } from '@/components/dashboard/DashboardWidgets';
import { ApprovalsWidget } from '@/components/dashboard/ApprovalsWidget';
import { AttentionWidget, ClassRankWidget } from '@/components/dashboard/TodayWidgets';
import { FacilityTasksWidget } from '@/components/dashboard/FacilityTasksWidget';
import { FACILITY_ENABLED } from '@/config/app';
import { getChildren, getParentAccounts } from '@/services/children/childrenService';
import { getMealCounts } from '@/services/attendance/attendanceService';
import { getMealPreparations, getMissingFoodReports } from '@/services/kitchen/kitchenService';
import { attendanceCompareText } from '@/services/dashboard/dashboardSummaryService';
import { CHILD_STATUS } from '@/models/School';
import { MEAL_COUNT_STATUS_LABELS } from '@/models/attendance/attendanceConstants';
import { MEAL_SESSION_LABELS, MISSING_STATUS, PREP_STATUS_LABELS } from '@/models/kitchen/kitchenConstants';
import { todayInput } from '@/utils/format';
import '@/styles/modules/dashboard.css';

const firstLoad = (q) => q.loading && q.data == null;

const SHORTCUTS = [
  { to: '/school/teachers', label: 'Phân công giáo viên', icon: UserCog },
  { to: '/education/plan-reviews', label: 'Kế hoạch giáo dục', icon: BookOpenCheck },
  { to: '/approvals', label: 'Chờ duyệt', icon: ListChecks },
  { to: '/facility/issues', label: 'Vận hành điểm trường', icon: Building2 },
  { to: '/kitchen/preparation', label: 'Dịch vụ bán trú', icon: ChefHat },
].filter((s) => FACILITY_ENABLED || !s.to.startsWith('/facility'));

/**
 * #11 Vice Principal Dashboard (wireframe A, plan 2026-10-20): số hôm nay có so sánh, việc cần xử lý,
 * "Cần chú ý hôm nay" + xếp hạng chuyên cần theo lớp, rồi chờ duyệt và số liệu bán trú.
 */
export default function VicePrincipalDashboard() {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const md = useMasterData();
  const date = todayInput();
  const campusId = user.campusId;
  const approvals = usePendingApprovals();
  const todayQ = useDashboardToday();

  const childrenQ = useWidget((u) => getChildren({ schoolYear }, u), [schoolYear]);
  const parentsQ = useWidget((u) => getParentAccounts({ status: 'NOT_ACTIVATED' }, u));
  const countsQ = useWidget((u) => getMealCounts({ date }, u), [date]);
  const prepQ = useWidget((u) => getMealPreparations({ campusId, date }, u), [campusId, date]);
  const missingQ = useWidget((u) => getMissingFoodReports({ campusId, status: MISSING_STATUS.SUBMITTED }, u), [campusId]);

  const pendingPlacement = (childrenQ.data || []).filter((c) => c.status === CHILD_STATUS.PENDING_PLACEMENT).length;
  const att = todayQ.data?.attendance;
  const health = todayQ.data?.health;
  const counts = countsQ.data?.counts || [];
  const lunch = counts.find((c) => c.session === 'LUNCH');
  // Cờ BE: số suất đổi sau khi xác nhận (mở lại điểm danh / điều chỉnh) ⇒ PHT cần xác nhận lại (NUT-03)
  const reconfirm = counts.some((c) => c.needsReconfirmation);
  const preps = (prepQ.data || []).filter((p) => p.hasMenu);
  const campus = md.campusById(campusId);
  const shortcuts = SHORTCUTS.map((s) =>
    s.to === '/approvals' && approvals.total > 0
      ? {
          ...s,
          label: (
            <>
              {s.label} <span className="tab__count">{approvals.total}</span>
            </>
          ),
        }
      : s,
  );

  return (
    <div className="page">
      <DashboardHeader subtitle={campus ? campus.name : undefined} />
      <Shortcuts links={shortcuts} />

      <div className="db-kpis db-kpis--rows">
        <section className="db-kpis__group db-kpis__group--wide" aria-labelledby="kpi-today">
          <div className="db-kpis__head">
            <h2 id="kpi-today" className="db-kpis__title">
              Hôm nay
            </h2>
            <span className="db-kpis__help">So với cùng thứ tuần trước</span>
          </div>
          <div className="db-kpis__list">
            <KpiCard
              icon={CalendarCheck}
              to="/attendance/summary"
              tone="green"
              label="Có mặt hôm nay"
              value={att?.total ? `${att.present}/${att.total}` : '—'}
              unit={att?.total ? 'trẻ' : undefined}
              progress={att?.total ? att.present / att.total : undefined}
              hint={
                att?.total
                  ? att.missing
                    ? `${att.missing} trẻ chưa được điểm danh`
                    : 'Đã điểm danh đủ'
                  : 'Hôm nay không có số liệu điểm danh'
              }
              compare={attendanceCompareText(att)}
              loading={firstLoad(todayQ)}
              error={todayQ.error}
            />
            <KpiCard
              icon={Stethoscope}
              to="/attendance/health"
              tone="teal"
              label="Đã khám sức khỏe trong ngày"
              value={health?.present ? `${health.checked}/${health.present}` : '—'}
              unit={health?.present ? 'trẻ' : undefined}
              progress={health?.present ? health.checked / health.present : undefined}
              progressLabel="đã khám"
              hint={
                health?.present
                  ? health.noted
                    ? `${health.noted} trẻ có dấu hiệu cần lưu ý`
                    : 'Chưa có trẻ cần lưu ý'
                  : 'Chưa có trẻ có mặt để khám'
              }
              loading={firstLoad(todayQ)}
              error={todayQ.error}
            />
            <KpiCard
              icon={Utensils}
              to={`/attendance/meal-count?date=${date}`}
              tone={reconfirm ? 'orange' : 'blue'}
              label="Suất ăn trưa đã báo"
              value={lunch ? lunch.totals.normal + lunch.totals.substitute : '—'}
              unit={lunch ? 'suất' : undefined}
              hint={
                reconfirm
                  ? 'Sổ báo ăn đã thay đổi sau khi xác nhận – cần xác nhận lại'
                  : lunch
                    ? `Sĩ số suất ăn: ${MEAL_COUNT_STATUS_LABELS[lunch.status] || lunch.status}`
                    : 'Hôm nay không có bữa trưa bán trú'
              }
              loading={firstLoad(countsQ)}
              error={countsQ.error}
            />
          </div>
        </section>
        <section className="db-kpis__group" aria-labelledby="kpi-todo">
          <div className="db-kpis__head">
            <h2 id="kpi-todo" className="db-kpis__title">
              Cần bạn xử lý
            </h2>
          </div>
          <div className="db-kpis__list">
            <KpiCard
              icon={ListChecks}
              to="/approvals"
              tone="purple"
              action={!approvals.failed.length}
              label="Chờ bạn duyệt"
              value={approvals.total}
              unit="yêu cầu"
              hint={approvals.failed.length ? `${approvals.failed.length} nhóm không tải được` : undefined}
              loading={approvals.loading && !approvals.groups.length}
              error={approvals.error}
            />
            <KpiCard
              icon={UserPlus}
              to="/children/placement"
              tone="orange"
              action
              label="Trẻ chờ xếp lớp"
              value={pendingPlacement}
              unit="trẻ"
              loading={firstLoad(childrenQ)}
              error={childrenQ.error}
            />
            <KpiCard
              icon={KeyRound}
              to="/children/activation"
              tone="orange"
              action
              label="Tài khoản phụ huynh chưa kích hoạt"
              value={(parentsQ.data || []).length}
              unit="tài khoản"
              loading={firstLoad(parentsQ)}
              error={parentsQ.error}
            />
            <KpiCard
              icon={ChefHat}
              to="/kitchen/missing-food"
              tone="red"
              action
              label="Bếp báo thiếu thực phẩm"
              value={(missingQ.data || []).length}
              unit="báo cáo"
              loading={firstLoad(missingQ)}
              error={missingQ.error}
            />
          </div>
        </section>
      </div>

      <div className="db-board">
        <div className="db-board__main">
          <AttentionWidget q={todayQ} />
          <ClassRankWidget q={todayQ} />
        </div>
        <div className="db-board__aside">
          <ApprovalsWidget approvals={approvals} />
          <Widget
            title="Số liệu khác"
            icon={CookingPot}
            to="/kitchen/preparation"
            linkLabel="Tình trạng chế biến"
            loading={firstLoad(countsQ) || firstLoad(prepQ)}
            error={countsQ.error && prepQ.error ? countsQ.error : null}
            onRetry={() => {
              countsQ.reload();
              prepQ.reload();
            }}
            empty={!counts.length}
            emptyTitle="Hôm nay không có bữa ăn bán trú"
          >
            <ShortList
              rows={counts.map((c) => {
                const prep = preps.find((p) => p.session === c.session);
                return {
                  key: c.session,
                  to: `/attendance/meal-count?date=${date}`,
                  icon: Utensils,
                  title: MEAL_SESSION_LABELS[c.session] || c.session,
                  // Trạng thái viết thành chữ ở dòng phụ: cột 1/3 hẹp, badge cuối dòng làm vỡ tiêu đề
                  meta: [
                    `Sĩ số: ${MEAL_COUNT_STATUS_LABELS[c.status] || c.status}`,
                    prep ? `Chế biến: ${PREP_STATUS_LABELS[prep.record?.status || 'NOT_STARTED']}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · '),
                  end: <TaskCount value={c.totals.normal + c.totals.substitute} />,
                };
              })}
            />
          </Widget>
          {FACILITY_ENABLED && <FacilityTasksWidget />}
        </div>
      </div>
    </div>
  );
}
