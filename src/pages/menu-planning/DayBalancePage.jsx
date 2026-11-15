import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Breadcrumb, EmptyState, ErrorState, LoadingState } from '@/components';
import { WeekPicker } from '@/components/form/WeekPicker';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { MealPlanStatusBadge } from '@/components/menu-planning/MenuBadges';
import { DayBalanceView } from '@/components/menu-planning/DayBalanceView';
import { useActiveDishes, useBeAgeGroups, useMealPlan } from '@/hooks/menu-planning/useMealPlan';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { mealPlanApi } from '@/services/mealPlanApi';
import { PERMISSIONS } from '@/models/bePermissions';
import { hasBePermission } from '@/utils/bePermissions';
import { MEAL_BLOCK_LABELS, MEAL_PLAN_STATUS, WEEKDAY_LABELS, schoolWeekStart } from '@/models/menu-planning/menuPlanningConstants';
import {
  blockSessions,
  dayBlockItems,
  draftFromPlan,
  isDirty,
  planBlocks,
  resolveWeekStart,
  setDayBlockItems,
} from '@/utils/menu-planning/mealPlanGrid';
import { ageGroupOptions } from '@/utils/menu-planning/menuStatistics';
import { menuCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { todayInput } from '@/utils/format';
import '@/styles/modules/menu-planning.css';

const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * Cân đối khẩu phần (`/menu/nutrition`) trên dữ liệu BE: chọn tuần, khối, ngày (giữ trên URL) rồi cân đối món của ngày đó —
 * cùng nội dung với modal "Sửa ngày" của Kế hoạch tuần. Lưu nháp ghi lại cả tuần (`PUT /nutrition/meal-plans/{week}`);
 * tuần đã công bố hoặc không có `canEdit` thì chỉ xem (user chốt 09/11/2026: giữ menu Cân đối khẩu phần).
 */
export default function DayBalancePage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const today = todayInput();
  const week = resolveWeekStart(params.get('week'), today);
  const planQ = useMealPlan(week);
  const plan = planQ.data;
  const { dishes } = useActiveDishes();
  const { ageGroups } = useBeAgeGroups();
  const saved = useMemo(() => (plan ? draftFromPlan(plan) : null), [plan]);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(saved), [saved]);

  const blocks = planBlocks(plan);
  const block = blocks.includes(params.get('block')) ? params.get('block') : blocks[0];
  const days = draft?.days || [];
  const date = days.some((d) => d.date === params.get('date')) ? params.get('date') : (days.find((d) => !d.off) || days[0])?.date;
  const day = days.find((d) => d.date === date);
  const editable = !!plan?.canEdit && plan.status !== MEAL_PLAN_STATUS.PUBLISHED;
  const dirty = !!draft && !!saved && isDirty(draft, saved);
  const groups = useMemo(
    () => ageGroupOptions((plan?.blocks || []).find((b) => b.block === block)?.ageGroupIds || [], ageGroups),
    [plan, block, ageGroups],
  );
  const pick = (next) => setParams({ week, block, date, ...next }, { replace: true });

  const save = async () => {
    setBusy(true);
    try {
      planQ.setData(await mealPlanApi.savePlan(week, draft));
      toast.success('Đã lưu nháp kế hoạch tuần.');
      return true;
    } catch (err) {
      toast.error(err, 'Chưa lưu được kế hoạch tuần');
      // Tuần vừa được công bố ở nơi khác: nạp lại để màn chuyển sang chỉ xem
      if (err.status === 409) planQ.reload({ silent: true });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const guard = useLeaveGuard({ when: dirty, onSave: save });

  const head = (
    <>
      <Breadcrumb items={menuCrumbs(null, null, 'Cân đối khẩu phần')} />
      <div className="td-week-toolbar">
        {blocks.length > 0 && (
          <div className="tabs tabs--pill" role="tablist" aria-label="Khối">
            {blocks.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={key === block}
                className={`tab ${key === block ? 'tab--active' : ''}`}
                onClick={() => pick({ block: key })}
              >
                {MEAL_BLOCK_LABELS[key] || key}
              </button>
            ))}
          </div>
        )}
        <WeekPicker
          value={week}
          thisWeek={schoolWeekStart(today)}
          onChange={(next) => guard.leave(`/menu/nutrition?week=${next}${block ? `&block=${block}` : ''}`, { replace: true })}
        />
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
  if (planQ.loading || !plan || !draft)
    return (
      <div className="page">
        {head}
        <LoadingState />
      </div>
    );

  return (
    <div className="page td-sections">
      {head}
      <div className="td-week-bar">
        <div className="row td-week-status">
          <MealPlanStatusBadge status={plan.status} size="lg" />
          {!editable && (
            <span className="chip chip--gray">
              <Lock size={14} /> {plan.status === MEAL_PLAN_STATUS.PUBLISHED ? 'Đã khóa, không sửa' : 'Chỉ xem'}
            </span>
          )}
          <Link className="text-sm" to={`/menu/weekly?week=${week}`}>
            Xem cả tuần
          </Link>
        </div>
        {editable && (
          <div className="row td-week-toolbar__actions">
            <button type="button" className="btn btn--primary" disabled={busy || !dirty} onClick={save}>
              <Save size={16} /> Lưu nháp
            </button>
          </div>
        )}
      </div>
      {dirty && (
        <div className="alert alert--warning">
          <div>Có thay đổi chưa lưu. Bấm Lưu nháp để ghi vào kế hoạch tuần.</div>
        </div>
      )}
      {!block ? (
        <section className="card">
          <EmptyState title="Chưa có khối nào để cân đối" description="Kiểm tra cấu hình nhóm tuổi và bữa ăn của trường." />
        </section>
      ) : (
        <>
          <div className="tabs tabs--pill" role="tablist" aria-label="Ngày trong tuần">
            {days.map((d, i) => (
              <button
                key={d.date}
                type="button"
                role="tab"
                aria-selected={d.date === date}
                className={`tab ${d.date === date ? 'tab--active' : ''}`}
                onClick={() => pick({ date: d.date })}
              >
                {WEEKDAY_LABELS[i]} {ddmm(d.date)}
                {d.off ? ' · nghỉ' : ''}
              </button>
            ))}
          </div>
          {day?.off ? (
            <section className="card">
              <EmptyState title="Ngày nghỉ" description={day.note || 'Ngày này không phục vụ bữa ăn.'} />
            </section>
          ) : (
            day && (
              <DayBalanceView
                key={`${block}|${date}`}
                items={dayBlockItems(day, block)}
                sessions={blockSessions(plan, block)}
                groups={groups}
                ageGroups={ageGroups}
                dishes={dishes}
                date={date}
                dayTitle={`${WEEKDAY_LABELS[days.indexOf(day)]} ${ddmm(date)} · ${MEAL_BLOCK_LABELS[block] || block}`}
                canEditRecipe={hasBePermission(user, PERMISSIONS.NUTRITION_MANAGE)}
                onChange={editable ? (items) => setDraft((d) => setDayBlockItems(d, date, block, items)) : undefined}
              />
            )
          )}
        </>
      )}
      <LeaveConfirmModal {...guard.modal} />
    </div>
  );
}
