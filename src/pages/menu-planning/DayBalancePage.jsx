import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock } from '@/components/ui/icons';
import { useToast } from '@/contexts/ToastContext';
import { Breadcrumb, EmptyState, ErrorState, LoadingState } from '@/components';
import { WeekPicker } from '@/components/form/WeekPicker';
import { Tabs } from '@/components/ui/Tabs';
import { MealPlanStatusBadge } from '@/components/menu-planning/MenuBadges';
import { DayBalanceEditor } from '@/components/menu-planning/balance/DayBalanceEditor';
import { useDayBalanceStatuses } from '@/hooks/menu-planning/useDayBalance';
import { useActiveDishes, useMealPlan } from '@/hooks/menu-planning/useMealPlan';
import { mealPlanApi } from '@/services/mealPlanApi';
import {
  MEAL_BLOCK_LABELS,
  MEAL_PLAN_STATUS,
  WEEKDAY_LABELS,
  addDays,
  schoolWeekStart,
} from '@/models/menu-planning/menuPlanningConstants';
import { dayMark } from '@/utils/menu-planning/dayBalance';
import { dayBlockItems, draftFromPlan, planBlocks, resolveWeekStart, setDayBlockItems } from '@/utils/menu-planning/mealPlanGrid';
import { menuCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { todayInput } from '@/utils/format';
import '@/styles/modules/menu-planning.css';

const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * Cân đối khẩu phần (`/menu/nutrition`): chọn tuần, khối, ngày (giữ trên URL) rồi cân đối ngày đó cho cả trường
 * (`/nutrition/day-balances`). Tuần còn nháp thì đổi món ngay ở đây và ghi vào kế hoạch tuần.
 */
export default function DayBalancePage() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const today = todayInput();
  const week = resolveWeekStart(params.get('week'), today);
  const planQ = useMealPlan(week);
  const plan = planQ.data;
  const { dishes } = useActiveDishes();
  const statusQ = useDayBalanceStatuses(week, addDays(week, 4));
  // Đổi món xong thì dựng lại bản cân đối của ngày
  const [menuVersion, setMenuVersion] = useState(0);
  // Bộ chặn rời màn của bản cân đối đang sửa: hỏi trước khi đổi tuần, khối, ngày
  const guardRef = useRef(null);

  const blocks = planBlocks(plan);
  const block = blocks.includes(params.get('block')) ? params.get('block') : blocks[0];
  const days = plan?.days || [];
  const date = days.some((d) => d.date === params.get('date')) ? params.get('date') : (days.find((d) => !d.off) || days[0])?.date;
  const day = days.find((d) => d.date === date);
  const dishEditable = !!plan?.canEdit && plan.status !== MEAL_PLAN_STATUS.PUBLISHED;

  const open = (next) => {
    const target = new URLSearchParams(Object.entries({ week, block, date, ...next }).filter(([, v]) => v));
    if (guardRef.current) guardRef.current.leave(`/menu/nutrition?${target}`, { replace: true });
    else setParams(target, { replace: true });
  };

  const changeDishes = async (session, items) => {
    const draft = draftFromPlan(plan);
    const others = dayBlockItems(
      draft.days.find((d) => d.date === date),
      block,
    ).filter((i) => i.session !== session);
    try {
      planQ.setData(
        await mealPlanApi.savePlan(week, setDayBlockItems(draft, date, block, [...others, ...items.map((item) => ({ ...item, session }))])),
      );
      setMenuVersion((v) => v + 1);
      statusQ.reload({ silent: true });
      toast.success('Đã đổi món và lưu nháp kế hoạch tuần.');
    } catch (err) {
      toast.error(err, 'Chưa đổi được món');
      if (err.status === 409) planQ.reload({ silent: true });
    }
  };

  const head = (
    <>
      <Breadcrumb items={menuCrumbs(null, null, 'Cân đối khẩu phần')} />
      <div className="td-week-toolbar">
        {blocks.length > 0 && (
          <Tabs
            variant="pill"
            ariaLabel="Khối"
            items={blocks.map((key) => ({ key, label: MEAL_BLOCK_LABELS[key] || key }))}
            value={block}
            onChange={(key) => setParams({ week, block: key, date }, { replace: true })}
          />
        )}
        <WeekPicker value={week} thisWeek={schoolWeekStart(today)} onChange={(next) => open({ week: next, date: '' })} />
      </div>
    </>
  );

  if (planQ.error)
    return (
      <div className="page">
        {head}
        <ErrorState error={planQ.error} onRetry={planQ.reload} />
      </div>
    );
  if (planQ.loading || !plan)
    return (
      <div className="page">
        {head}
        <LoadingState />
      </div>
    );

  const statusOf = (d) => statusQ.statuses.find((s) => s.date === d);
  return (
    <div className="page td-sections">
      {head}
      <div className="row td-week-status">
        <MealPlanStatusBadge status={plan.status} size="lg" />
        {!dishEditable && (
          <span className="chip chip--gray">
            <Lock size={14} /> {plan.status === MEAL_PLAN_STATUS.PUBLISHED ? 'Đã công bố, đổi món ở Kế hoạch tuần' : 'Chỉ xem món'}
          </span>
        )}
        <Link className="text-sm" to={`/menu/weekly?week=${week}`}>
          Xem cả tuần
        </Link>
      </div>
      {!block ? (
        <section className="card">
          <EmptyState title="Chưa có khối nào để cân đối" description="Kiểm tra cấu hình nhóm tuổi và bữa ăn của trường." />
        </section>
      ) : (
        <>
          <Tabs
            variant="pill"
            ariaLabel="Ngày trong tuần"
            items={days.map((d, i) => ({
              key: d.date,
              label: `${WEEKDAY_LABELS[i]} ${ddmm(d.date)}${d.off ? ' · nghỉ' : dayMark(statusOf(d.date))}`,
              title: statusOf(d.date)?.problems?.join('\n') || undefined,
            }))}
            value={date}
            onChange={(key) => open({ date: key })}
          />
          {day?.off ? (
            <section className="card">
              <EmptyState title="Ngày nghỉ" description={day.note || 'Ngày này không phục vụ bữa ăn.'} />
            </section>
          ) : (
            day && (
              <DayBalanceEditor
                key={`${date}|${menuVersion}`}
                date={date}
                block={block}
                day={day}
                dishes={dishes}
                guardRef={guardRef}
                onChangeDishes={dishEditable ? changeDishes : undefined}
                onSaved={() => statusQ.reload({ silent: true })}
              />
            )
          )}
        </>
      )}
    </div>
  );
}
