import { ChefHat, CookingPot, ListTodo, PackageCheck, UtensilsCrossed, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWidget } from '@/hooks/dashboard/useDashboard';
import { Spinner } from '@/components/ui/States';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Widget, KpiCard, ShortList, TaskCount } from '@/components/dashboard/DashboardWidgets';
import { FacilityTasksWidget } from '@/components/dashboard/FacilityTasksWidget';
import { PrepStatusBadge, MealCountStatusBadge } from '@/components/kitchen/KitchenBadges';
import {
  getConfirmedMealCount,
  getPublishedMenu,
  getRequiredQuantity,
  getMealPreparations,
  getMissingFoodReports,
  getStockIssue,
} from '@/services/kitchen/kitchenService';
import { getMealHandovers } from '@/services/attendance/attendanceService';
import { MEAL_SESSION_LABELS, MENU_TYPE, MISSING_STATUS, ISSUE_STATUS, PREP_STATUS } from '@/models/kitchen/kitchenConstants';
import { HANDOVER_STATUS } from '@/models/attendance/attendanceConstants';
import { ageGroupById } from '@/models/School';
import { canSupplementHandover } from '@/utils/attendance/attendancePermissions';
import { formatDate, todayInput } from '@/utils/format';
import '@/styles/modules/dashboard.css';

const endOf = (q, count) =>
  q.loading && q.data == null ? <Spinner small /> : q.error ? <span className="muted">—</span> : <TaskCount value={count} />;
const firstLoad = (q) => q.loading && q.data == null;

/**
 * #14 Kitchen Dashboard: today's published menu, confirmed meal count, food quantities and meal status
 * of the own campus kitchen (footnote ⁵, meal counts read-only).
 */
export default function KitchenDashboard() {
  const { user } = useAuth();
  const date = todayInput();
  const campusId = user.campusId;

  const countQ = useWidget((u) => getConfirmedMealCount({ campusId, date }, u), [campusId, date]);
  const menuQ = useWidget((u) => getPublishedMenu({ date, view: 'day' }, u), [date]);
  const qtyQ = useWidget((u) => getRequiredQuantity({ campusId, date, session: 'ALL' }, u), [campusId, date]);
  const prepQ = useWidget((u) => getMealPreparations({ campusId, date }, u), [campusId, date]);
  const missingQ = useWidget((u) => getMissingFoodReports({ campusId, status: MISSING_STATUS.SUBMITTED }, u), [campusId]);
  const stockQ = useWidget((u) => getStockIssue({ campusId, date }, u), [campusId, date]);
  const handoverQ = useWidget((u) => getMealHandovers({ date }, u), [date]);

  const counts = countQ.data || [];
  const confirmed = counts.filter((s) => s.status === 'CONFIRMED' && s.totals);
  const meals = confirmed.reduce((n, s) => n + s.totals.normal + s.totals.substitute, 0);
  const substitute = confirmed.reduce((n, s) => n + s.totals.substitute, 0);
  const withMenu = counts.filter((s) => s.hasMenu).length;

  const preps = prepQ.data || [];
  const ready = preps.filter((p) => p.record?.status === PREP_STATUS.READY_FOR_HANDOVER).length;
  const prepTodo = preps.filter(
    (p) => p.hasMenu && p.mealCountStatus === 'CONFIRMED' && p.record?.status !== PREP_STATUS.READY_FOR_HANDOVER,
  ).length;
  const foods = qtyQ.data?.foods || [];
  const shortages = (handoverQ.data?.handovers || []).filter(
    (h) => h.status === HANDOVER_STATUS.SHORTAGE_REPORTED && canSupplementHandover(h, user),
  ).length;
  const toReceive = stockQ.data?.state === ISSUE_STATUS.APPROVED ? 1 : 0;
  const sessionsMenu = menuQ.data?.[0]?.sessions || [];
  const hasAnyMenu = sessionsMenu.some((s) => s.menus.length);

  return (
    <div className="page">
      <DashboardHeader subtitle={`Bếp ăn hôm nay, ${formatDate(date)}`} />

      <div className="stat-grid">
        <KpiCard
          to="/kitchen/meal-count"
          tone="blue"
          label="Suất ăn đã xác nhận"
          value={meals}
          hint={`${confirmed.length}/${withMenu} bữa đã có số suất`}
          loading={firstLoad(countQ)}
          error={countQ.error}
        />
        <KpiCard
          to="/kitchen/meal-count"
          tone="red"
          label="Suất ăn thay thế (dị ứng)"
          value={substitute}
          loading={firstLoad(countQ)}
          error={countQ.error}
        />
        <KpiCard
          to="/kitchen/required-quantity"
          tone="purple"
          label="Loại thực phẩm cần chuẩn bị"
          value={foods.length}
          loading={firstLoad(qtyQ)}
          error={qtyQ.error}
        />
        <KpiCard
          to="/kitchen/preparation/update"
          tone={prepTodo ? 'orange' : 'green'}
          label="Bữa sẵn sàng bàn giao"
          value={`${ready}/${preps.filter((p) => p.hasMenu).length}`}
          loading={firstLoad(prepQ)}
          error={prepQ.error}
        />
        <KpiCard
          to="/kitchen/missing-food"
          tone="orange"
          label="Báo thiếu chờ PHT bổ sung"
          value={(missingQ.data || []).length}
          loading={firstLoad(missingQ)}
          error={missingQ.error}
        />
        <KpiCard
          to="/attendance/meal-handover"
          tone={shortages ? 'red' : 'green'}
          label="Lớp báo thiếu suất"
          value={shortages}
          loading={firstLoad(handoverQ)}
          error={handoverQ.error}
        />
      </div>

      <div className="db-grid">
        <Widget
          title="Thực đơn hôm nay"
          icon={UtensilsCrossed}
          to="/kitchen/published-menu"
          linkLabel="Xem thực đơn đã công bố"
          loading={firstLoad(menuQ)}
          error={menuQ.error}
          onRetry={menuQ.reload}
          empty={!hasAnyMenu}
          emptyTitle="Chưa có thực đơn công bố cho hôm nay"
          emptyText="Thực đơn tuần do Phó hiệu trưởng công bố. Khi có thực đơn, món ăn của từng bữa sẽ hiện ở đây."
        >
          {sessionsMenu
            .filter((s) => s.menus.length)
            .map((s) => (
              <div key={s.session} className="db-session">
                <div className="subsection-title">{MEAL_SESSION_LABELS[s.session] || s.session}</div>
                {s.menus.map((m) => (
                  <div key={m.id} className="mt-8">
                    <div className="text-sm text-2">
                      {ageGroupById(m.ageGroupId)?.shortName || 'Toàn trường'}
                      {m.type === MENU_TYPE.ALLERGY ? ' · Thực đơn thay thế (dị ứng)' : ''}
                    </div>
                    <div className="db-dishes mt-8">
                      {m.dishes.map((d) => (
                        <span key={d.id} className={`chip ${d.allergens.length ? 'chip--orange' : 'chip--gray'}`}>
                          {d.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </Widget>

        <Widget
          title="Tình trạng bữa ăn"
          icon={CookingPot}
          to="/kitchen/preparation/update"
          linkLabel="Cập nhật chế biến"
          loading={firstLoad(prepQ)}
          error={prepQ.error}
          onRetry={prepQ.reload}
          empty={!preps.some((p) => p.hasMenu)}
          emptyTitle="Hôm nay không có bữa ăn cần chế biến"
        >
          {preps
            .filter((p) => p.hasMenu)
            .map((p) => (
              <div key={p.session} className="db-session">
                <div className="db-session__head">
                  <span className="subsection-title">{MEAL_SESSION_LABELS[p.session] || p.session}</span>
                  <PrepStatusBadge status={p.record?.status || 'NOT_STARTED'} />
                </div>
                <div className="row text-sm text-2">
                  Số suất: <MealCountStatusBadge status={p.mealCountStatus || 'NONE'} />
                  {p.totals && p.mealCountStatus === 'CONFIRMED' && (
                    <span>
                      {p.totals.normal} suất thường · {p.totals.substitute} suất thay thế
                    </span>
                  )}
                </div>
              </div>
            ))}
        </Widget>
      </div>

      <div className="db-grid">
        <Widget title="Việc cần làm" icon={ListTodo}>
          <ShortList
            rows={[
              {
                key: 'receive',
                to: '/kitchen/ingredient-receipts',
                icon: PackageCheck,
                title: 'Xác nhận nhận thực phẩm từ kho',
                meta: stockQ.error ? 'Không tải được phiếu xuất kho' : 'Phiếu xuất kho hôm nay đã được duyệt, chờ bếp xác nhận',
                end: endOf(stockQ, toReceive),
              },
              {
                key: 'prep',
                to: '/kitchen/preparation/update',
                icon: ChefHat,
                title: 'Cập nhật tình trạng chế biến',
                meta: prepQ.error ? 'Không tải được tình trạng chế biến' : 'Bữa đã có số suất, chưa sẵn sàng bàn giao',
                end: endOf(prepQ, prepTodo),
              },
              {
                key: 'shortage',
                to: '/attendance/meal-handover',
                icon: AlertTriangle,
                title: 'Bổ sung suất ăn cho lớp báo thiếu',
                meta: handoverQ.error ? 'Không tải được bàn giao suất ăn' : 'Lớp đã báo thiếu suất khi nhận',
                end: endOf(handoverQ, shortages),
              },
              {
                key: 'missing',
                to: '/kitchen/missing-food',
                icon: AlertTriangle,
                title: 'Báo thiếu thực phẩm',
                meta: missingQ.error ? 'Không tải được báo cáo thiếu' : 'Báo cáo của bếp đang chờ Phó hiệu trưởng bổ sung',
                end: endOf(missingQ, (missingQ.data || []).length),
              },
            ]}
          />
        </Widget>
        <FacilityTasksWidget />
      </div>
    </div>
  );
}
