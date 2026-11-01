import { useState } from 'react';
import {
  BookOpenCheck,
  Building2,
  CalendarCheck,
  CalendarDays,
  ListChecks,
  Stethoscope,
  UserRound,
  Utensils,
  UtensilsCrossed,
  Wrench,
} from '@/components/ui/icons';
import { useMasterData } from '@/hooks/useMasterData';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useWidget, usePendingApprovals, useDashboardToday } from '@/hooks/dashboard/useDashboard';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Widget, KpiCard, Shortcuts, ShortList, TaskCount } from '@/components/dashboard/DashboardWidgets';
import { ApprovalsWidget } from '@/components/dashboard/ApprovalsWidget';
import { AttentionWidget, ClassRankWidget } from '@/components/dashboard/TodayWidgets';
import { getMealCounts } from '@/services/attendance/attendanceService';
import { getIssues } from '@/services/facility/facilityService';
import { getPublishedMenu } from '@/services/kitchen/kitchenService';
import { getEducationPlans } from '@/services/education-plan/educationPlanService';
import { attendanceCompareText } from '@/services/dashboard/dashboardSummaryService';
import { ISSUE_STATUS } from '@/models/facility/facilityConstants';
import { MENU_TYPE } from '@/models/kitchen/kitchenConstants';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { todayInput } from '@/utils/format';
import { FACILITY_ENABLED } from '@/config/app';
import '@/styles/modules/dashboard.css';

const firstLoad = (q) => q.loading && q.data == null;
const RANK_LIMIT = 6;

const SHORTCUTS = [
  { to: '/school/years', label: 'Cấu hình trường', icon: CalendarDays },
  { to: '/children', label: 'Quản lý trẻ', icon: UserRound },
  { to: '/approvals', label: 'Chờ duyệt', icon: ListChecks },
  { to: '/facility/issues', label: 'Giám sát cơ sở vật chất', icon: Building2 },
  { to: '/menu/plans', label: 'Kế hoạch thực đơn', icon: UtensilsCrossed },
].filter((s) => FACILITY_ENABLED || !s.to.startsWith('/facility'));

/**
 * #10 Principal Dashboard (UC 3.1, wireframe A plan 2026-10-20): số toàn trường hôm nay có so sánh, lọc theo điểm trường,
 * "Cần chú ý hôm nay" + 6 lớp có mặt thấp nhất, rồi chờ duyệt và số liệu khác. Chỉ đọc.
 */
export default function PrincipalDashboard() {
  const md = useMasterData();
  const { schoolYear } = useSchoolYear();
  const [campusId, setCampusId] = useState('');
  const date = todayInput();
  const approvals = usePendingApprovals();
  const todayQ = useDashboardToday(campusId);

  const countsQ = useWidget((u) => getMealCounts({ date }, u), [date]);
  const issuesQ = useWidget((u) => getIssues({ campusId }, u), [campusId], { enabled: FACILITY_ENABLED });
  const menuQ = useWidget((u) => getPublishedMenu({ date, view: 'day' }, u), [date]);
  const eduQ = useWidget(() => getEducationPlans());

  const att = todayQ.data?.attendance;
  const health = todayQ.data?.health;
  const lunches = (countsQ.data?.counts || []).filter((c) => c.session === 'LUNCH' && (!campusId || c.campusId === campusId));
  const lunchMeals = lunches.reduce((n, c) => n + c.totals.normal + c.totals.substitute, 0);
  const lunchConfirmed = lunches.filter((c) => c.status === 'CONFIRMED').length;
  const openIssues = (issuesQ.data || []).filter((i) => i.status === ISSUE_STATUS.SUBMITTED).length;
  const approvalTotal = approvals.groups.reduce(
    (n, g) => n + g.items.filter((i) => !campusId || !i.campusId || i.campusId === campusId).length,
    0,
  );
  const lessons = eduQ.data?.lessons || [];
  const themes = eduQ.data?.themes || [];
  const lunchMenu = (menuQ.data?.[0]?.sessions || []).find((s) => s.session === 'LUNCH' && s.menus.length);
  const lunchNormal = (lunchMenu?.menus || []).filter((m) => m.type !== MENU_TYPE.ALLERGY);
  const lunchDishes = [...new Set(lunchNormal.flatMap((m) => m.dishes.map((d) => d.name)))];
  const allergyMenus = (lunchMenu?.menus.length || 0) - lunchNormal.length;
  const campusName = (id) => md.campusById(id)?.shortName || md.campusById(id)?.name || id;
  const shortcuts = SHORTCUTS.map((s) =>
    s.to === '/approvals' && approvalTotal > 0
      ? {
          ...s,
          label: (
            <>
              {s.label} <span className="tab__count">{approvalTotal}</span>
            </>
          ),
        }
      : s,
  );

  return (
    <div className="page">
      <DashboardHeader subtitle={`Toàn trường · Năm học ${String(schoolYear || '').replace('-', ' – ')}`}>
        <div className="field">
          <label className="field__label" htmlFor="db-campus">
            Điểm trường
          </label>
          <select id="db-campus" className="select" value={campusId} onChange={(e) => setCampusId(e.target.value)}>
            <option value="">Tất cả điểm trường</option>
            {md.campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </DashboardHeader>
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
                  : 'Hôm nay chưa có số liệu điểm danh'
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
              tone="blue"
              label="Suất ăn trưa đã báo"
              value={lunches.length ? lunchMeals : '—'}
              unit={lunches.length ? 'suất' : undefined}
              hint={
                lunches.length ? `${lunchConfirmed}/${lunches.length} điểm trường đã xác nhận sĩ số` : 'Hôm nay không có bữa trưa bán trú'
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
              unit="yêu cầu"
              action={!approvals.failed.length}
              icon={ListChecks}
              to="/approvals"
              tone="purple"
              label="Chờ bạn phê duyệt"
              value={approvalTotal}
              hint={approvals.failed.length ? `${approvals.failed.length} nhóm không tải được` : undefined}
              loading={approvals.loading && !approvals.groups.length}
              error={approvals.error}
            />
            {FACILITY_ENABLED && (
              <KpiCard
                unit="sự cố"
                icon={Wrench}
                to="/facility/issues"
                tone="red"
                action
                label="Sự cố CSVC chờ xử lý"
                value={openIssues}
                loading={firstLoad(issuesQ)}
                error={issuesQ.error}
              />
            )}
          </div>
        </section>
      </div>

      <div className="db-board">
        <div className="db-board__main">
          <AttentionWidget q={todayQ} />
          <ClassRankWidget q={todayQ} limit={RANK_LIMIT} campusName={campusId ? null : campusName} />
        </div>
        <div className="db-board__aside">
          <ApprovalsWidget approvals={approvals} campusId={campusId} />
          <Widget title="Số liệu khác" icon={BookOpenCheck}>
            <ShortList
              rows={[
                {
                  key: 'menu',
                  to: '/menu/plans',
                  icon: UtensilsCrossed,
                  title: 'Thực đơn trưa hôm nay',
                  meta: firstLoad(menuQ)
                    ? 'Đang tải…'
                    : menuQ.error
                      ? 'Không tải được thực đơn'
                      : lunchDishes.length
                        ? lunchDishes.join(', ')
                        : 'Chưa có thực đơn công bố cho hôm nay',
                  end: allergyMenus > 0 ? <span className="chip chip--orange">{allergyMenus} thay thế</span> : null,
                },
                {
                  key: 'themes',
                  to: '/education/plan-reviews',
                  icon: BookOpenCheck,
                  title: 'Kế hoạch chủ đề đã duyệt',
                  meta: `${themes.filter((t) => t.status === EDU_STATUS.PENDING_VP).length} kế hoạch đang chờ Phó hiệu trưởng duyệt`,
                  end: <TaskCount value={themes.filter((t) => t.status === EDU_STATUS.APPROVED).length} />,
                },
                {
                  key: 'lessons',
                  to: '/education/plan-reviews',
                  icon: BookOpenCheck,
                  title: 'Giáo án đã duyệt',
                  meta: `${lessons.filter((l) => [EDU_STATUS.PENDING_TL, EDU_STATUS.PENDING_VP].includes(l.status)).length} giáo án đang chờ duyệt`,
                  end: <TaskCount value={lessons.filter((l) => l.status === EDU_STATUS.APPROVED).length} />,
                },
              ]}
            />
          </Widget>
        </div>
      </div>
    </div>
  );
}
