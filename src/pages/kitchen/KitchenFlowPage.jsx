import { Fragment } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FlaskConical,
  GitCompare,
  ListTodo,
  Scale,
  Timer,
  Users,
  UtensilsCrossed,
  Warehouse,
  Clock,
} from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Widget, ShortList, TaskCount } from '@/components/dashboard/DashboardWidgets';
import { FreshReceiptStatusBadge, IssueStatusBadge, MealCountStatusBadge } from '@/components/kitchen/KitchenBadges';
import { KbCampusFilter, KbDateFilter } from '@/components/kitchen/KitchenFilters';
import { AllergyMenuChanges } from '@/components/kitchen/AllergyMenuChanges';
import { useKitchenCampus, useKitchenDay, usePublishedMenu } from '@/hooks/kitchen/useKitchen';
import { ISSUE_STATUS, KITCHEN_DAY_TIMES, MEAL_SESSION_LABELS, MENU_TYPE, isIssuePosted } from '@/models/kitchen/kitchenConstants';
import { AGE_GROUPS, ageGroupById } from '@/models/School';
import { KITCHEN_ROUTE_ROLES, isKitchenStaff, isVicePrincipal } from '@/utils/kitchen/kitchenPermissions';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDate, todayInput } from '@/utils/format';
import '@/styles/modules/dashboard.css';
import '@/styles/modules/kitchen.css';
import { useClock } from '@/hooks/useClock';
const firstLoad = (q) => q.loading && q.data == null;
const groupOrder = (id) => (id ? AGE_GROUPS.findIndex((a) => a.id === id) : -1);

// Hàng theo nhóm tuổi, chỉ ghi phần thay món ngay trong bữa liên quan.
const buildMenuGrid = (sessionsMenu) => {
  const sessions = sessionsMenu.filter((s) => s.menus.length).map((s) => s.session);
  const rows = new Map();
  for (const s of sessionsMenu) {
    for (const m of s.menus) {
      if (m.type !== MENU_TYPE.NORMAL) continue;
      const key = `${m.ageGroupId || ''}_${m.type}`;
      if (!rows.has(key))
        rows.set(key, {
          key,
          ageGroupId: m.ageGroupId,
          type: m.type,
          bySession: {},
        });
      rows.get(key).bySession[s.session] = m;
    }
  }
  const sorted = [...rows.values()].sort(
    (a, b) => groupOrder(a.ageGroupId) - groupOrder(b.ageGroupId) || (a.type === MENU_TYPE.ALLERGY) - (b.type === MENU_TYPE.ALLERGY),
  );
  return {
    sessions,
    rows: sorted,
  };
};
const mealCountStatusOf = ({ sessions, confirmed }) => {
  if (!sessions.length) return 'NONE';
  if (confirmed === sessions.length) return 'CONFIRMED';
  return sessions.some((s) => s.status === 'PENDING_CONFIRMATION' || s.status === 'CONFIRMED') ? 'PENDING_CONFIRMATION' : 'NONE';
};
const hhmm = (iso) =>
  iso
    ? new Date(iso).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '';
const SAMPLE_SHORT = {
  MORNING: 'Sáng',
  LUNCH: 'Trưa',
  AFTERNOON: 'Chiều',
};

/** Các mốc trong ngày (khảo sát 18/10/2026); giờ là giờ dự kiến, chỉ để nhìn (KITCHEN_DAY_TIMES). */
const buildSteps = (day, user, date) => {
  const canOpen = (key) => (KITCHEN_ROUTE_ROLES[key] || []).includes(user.role);
  const { mealCount, fresh, issue, samples, forecast } = day;
  const countStatus = mealCountStatusOf(mealCount);
  const savedMeals = samples.meals.filter((m) => m.status !== 'TODO').length;
  return [
    {
      key: 'fresh',
      time: KITCHEN_DAY_TIMES.FRESH_RECEIPT,
      icon: ClipboardCheck,
      title: 'Kiểm nhận hàng tươi',
      state: !fresh.lines ? 'skip' : fresh.status === 'CONFIRMED' ? 'done' : fresh.status === 'SUBMITTED' ? 'now' : 'todo',
      badge: fresh.lines ? <FreshReceiptStatusBadge status={fresh.status} /> : null,
      meta: fresh.lines
        ? `${fresh.lines} thực phẩm tươi${fresh.odd ? ` · ${fresh.odd} dòng thiếu hoặc trả lại` : ''}`
        : 'Không có hàng tươi giao ngày này',
      to: fresh.lines && canOpen('freshReceipts') ? `/kitchen/fresh-receipts?date=${date}` : null,
      linkLabel: 'Mở kiểm nhận',
    },
    {
      key: 'count',
      time: KITCHEN_DAY_TIMES.MEAL_COUNT,
      icon: Users,
      title: 'Chốt suất theo bữa',
      state: countStatus === 'CONFIRMED' ? 'done' : mealCount.sessions.length ? 'now' : 'skip',
      badge: <MealCountStatusBadge status={countStatus} />,
      meta: mealCount.sessions.length
        ? `${mealCount.confirmed}/${mealCount.sessions.length} bữa đã chốt${mealCount.total ? ` · ${mealCount.total} suất` : ''}`
        : 'Không có bữa ăn',
      to: canOpen('mealCount') ? `/kitchen/meal-count?date=${date}` : null,
      linkLabel: 'Xem theo lớp',
    },
    {
      key: 'issue',
      time: KITCHEN_DAY_TIMES.MEAL_COUNT,
      icon: Warehouse,
      title: 'Xuất kho đồ khô',
      state: isIssuePosted(issue.state)
        ? 'done'
        : issue.state === 'NO_MENU'
          ? 'skip'
          : issue.state === ISSUE_STATUS.AWAITING_LOT_ALLOCATION
            ? 'now'
            : 'todo',
      badge: <IssueStatusBadge status={issue.state} />,
      meta: isIssuePosted(issue.state)
        ? issue.code
        : issue.state === ISSUE_STATUS.AWAITING_STOCK
          ? `${issue.code} · thiếu ${issue.shortage} thực phẩm, chờ nhập bổ sung`
          : issue.state === ISSUE_STATUS.AWAITING_LOT_ALLOCATION
            ? `${issue.code} · đủ hàng, bếp chọn lô để ghi xuất`
            : 'Tính nguyên liệu khi các bữa đã được chốt',
      to: canOpen('dryStock') ? KITCHEN_PAGES.dryStock.to : null,
      linkLabel: 'Xem kho khô',
    },
    {
      key: 'samples',
      time: KITCHEN_DAY_TIMES.FOOD_SAMPLE,
      icon: FlaskConical,
      title: 'Lưu mẫu thức ăn',
      state: !samples.meals.length ? 'skip' : savedMeals === samples.meals.length ? 'done' : savedMeals ? 'now' : 'todo',
      meta: samples.meals.length
        ? samples.meals.map((m) => `${SAMPLE_SHORT[m.session] || m.session} ${m.takenAt ? hhmm(m.takenAt) : 'chưa lưu'}`).join(' · ')
        : 'Không có bữa ăn',
      to: canOpen('foodSamples') ? `/kitchen/food-samples?date=${date}` : null,
      linkLabel: 'Mở sổ lưu mẫu',
    },
    {
      key: 'forecast',
      time: KITCHEN_DAY_TIMES.FORECAST,
      icon: CalendarClock,
      title: 'Dự trù ngày mai',
      state: !forecast.nextDate ? 'skip' : forecast.pendingChanges ? 'now' : 'todo',
      meta: forecast.nextDate
        ? `${formatDate(forecast.nextDate)}: ${forecast.nextTotal} suất${forecast.nextSentTotal != null && forecast.nextSentTotal !== forecast.nextTotal ? ` (phiếu tuần ${forecast.nextSentTotal})` : ''}${forecast.pendingChanges ? ` · ${forecast.pendingChanges} dòng chưa báo NCC` : ''}`
        : 'Chưa có dự trù',
      to: canOpen('forecast') ? `/kitchen/forecast?week=${forecast.nextDate || date}${forecast.pendingChanges ? '&tab=ncc' : ''}` : null,
      linkLabel: forecast.pendingChanges ? 'Báo NCC thay đổi' : 'Mở dự trù tuần',
    },
  ];
};
const todoRows = (day, user) => {
  const count = (n) => <TaskCount value={n} />;
  if (isVicePrincipal(user)) {
    return [
      {
        key: 'ncc',
        to: '/kitchen/forecast?tab=ncc',
        icon: GitCompare,
        title: 'Báo NCC thay đổi',
        meta: 'Chênh lệch sau chốt, số ngày mai đã đổi',
        end: count(day.forecast.pendingChanges),
      },
      {
        key: 'fresh',
        to: `/kitchen/fresh-receipts?date=${day.date}`,
        icon: ClipboardCheck,
        title: 'Kiểm nhận chờ bạn xác nhận',
        meta: 'Bếp đã gửi kết quả kiểm nhận',
        end: count(day.fresh.status === 'SUBMITTED' ? 1 : 0),
      },
      {
        key: 'short',
        to: KITCHEN_PAGES.dryStock.to,
        icon: Scale,
        title: 'Đồ khô xuất thiếu tồn',
        meta: 'Phiếu xuất ngày này có dòng thiếu',
        end: count(day.issue.shortage || 0),
      },
      {
        key: 'stock',
        to: KITCHEN_PAGES.dryStock.to,
        icon: Warehouse,
        title: 'Mặt hàng đã hết trong kho',
        meta: 'Cần nhập thêm',
        end: count(day.stock?.outOfStock || 0),
      },
    ];
  }
  return [
    {
      key: 'fresh',
      to: `/kitchen/fresh-receipts?date=${day.date}`,
      icon: ClipboardCheck,
      title: 'Kiểm nhận hàng tươi chưa gửi PHT',
      meta: 'Đối chiếu phiếu giao hàng rồi gửi',
      end: count(day.fresh.lines && ['NEW', 'DRAFT'].includes(day.fresh.status) ? 1 : 0),
    },
    {
      key: 'samples',
      to: `/kitchen/food-samples?date=${day.date}`,
      icon: FlaskConical,
      title: 'Bữa chưa lưu mẫu',
      meta: 'Ghi ở Sổ lưu mẫu',
      end: count(day.samples.meals.filter((m) => m.status === 'TODO').length),
    },
    {
      key: 'destroy',
      to: `/kitchen/food-samples?date=${day.date}`,
      icon: Timer,
      title: 'Mẫu chờ ghi hủy',
      meta: 'Mẫu đã lưu đủ 24 giờ',
      end: count(day.samples.pendingDestroy),
    },
  ];
};

/**
 * Quy trình bếp hôm nay (`/kitchen`): dòng thời gian các mốc của một cơ sở (kiểm nhận, chốt suất, xuất kho, lưu mẫu, dự trù) và việc cần xử lý.
 * Bếp mở trang chủ cũng vào trang này (`asHome`). Không có trạng thái nấu/giao: đến giờ ăn coi như bếp đã nấu xong.
 */
/**
 * Việc nên làm lúc này theo giờ dự kiến (chỉ để nhắc, không khóa thao tác): bước chưa xong đầu tiên đã tới giờ;
 * chưa tới giờ bước nào thì bước chưa xong kế tiếp. Trả thêm vị trí chèn vạch "Bây giờ".
 */
const focusOf = (steps, now) => {
  const open = steps.filter((s) => s.state !== 'done' && s.state !== 'skip');
  const due = open.find((s) => s.time <= now);
  const focus = due || open.find((s) => s.time > now) || null;
  const nowIndex = steps.findIndex((s) => s.time > now);
  return { focus, due: !!due, nowIndex: nowIndex < 0 ? steps.length : nowIndex };
};

export default function KitchenFlowPage({ asHome = false }) {
  const { user } = useAuth();
  const md = useMasterData();
  const [params, setParams] = useSearchParams();
  const today = todayInput();
  const date = params.get('date') || today;
  const { campusId, setCampusId, canPick } = useKitchenCampus(md.campuses[0]?.id);
  const dayQ = useKitchenDay(campusId, date);
  const menuQ = usePublishedMenu(date, 'day', campusId);
  const day = dayQ.data;
  const menuGrid = buildMenuGrid(menuQ.days?.[0]?.sessions || []);
  const showTodo = isVicePrincipal(user) || isKitchenStaff(user);
  const now = useClock();
  const isToday = date === today;
  const steps = day ? buildSteps(day, user, date) : [];
  const { focus, due, nowIndex } = isToday ? focusOf(steps, now) : { focus: null, due: false, nowIndex: -1 };
  return (
    <div className="page">
      {asHome ? (
        <DashboardHeader subtitle={`Bếp ăn hôm nay, ${formatDate(date)}`} />
      ) : (
        <>
          <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.kitchenDay)} />
          <div className="page__head">
            <div>
              <h1 className="page__title">Quy trình bếp hôm nay</h1>
            </div>
          </div>
        </>
      )}
      <div className="kb-toolbar">
        <KbDateFilter
          value={date}
          onChange={(d) =>
            setParams(
              {
                date: d,
              },
              {
                replace: true,
              },
            )
          }
        />
        <KbCampusFilter campusId={campusId} onChange={setCampusId} canPick={canPick} />
        {KITCHEN_ROUTE_ROLES.dryStock.includes(user.role) && (
          <Link className="btn" to="/kitchen/dry-stock">
            Xem kho khô
          </Link>
        )}
      </div>

      <div className="kb-flow-board mb-16">
        <div className="kb-flow-board__main">
          <Widget
            title="Dòng thời gian"
            icon={ClipboardList}
            loading={!campusId || firstLoad(dayQ)}
            error={dayQ.error}
            onRetry={dayQ.reload}
          >
            {day && (
              <>
                {isToday && (
                  // Dải "bây giờ": giờ hiện tại và việc nên làm, để mở màn là biết đang ở bước nào
                  <div className={`kb-now ${due ? 'kb-now--due' : ''}`} role="status">
                    <span className="kb-now__clock">
                      <Clock size={16} aria-hidden="true" /> Bây giờ {now}
                    </span>
                    {focus ? (
                      <span className="kb-now__task">
                        {due ? 'Cần làm' : 'Việc tiếp theo'}: <b>{focus.title}</b> ({focus.time})
                        {focus.to && (
                          <Link className="kb-day__link" to={focus.to}>
                            {focus.linkLabel} <ArrowRight size={14} aria-hidden="true" />
                          </Link>
                        )}
                      </span>
                    ) : (
                      <span className="kb-now__task">Đã xong các việc trong ngày.</span>
                    )}
                  </div>
                )}
                <ol className="kb-day">
                  {steps.map((step, i) => {
                    const Icon = step.icon;
                    const isFocus = focus?.key === step.key;
                    return (
                      <Fragment key={step.key}>
                        {i === nowIndex && (
                          <li className="kb-day__now" aria-label={`Bây giờ ${now}`}>
                            <span className="kb-day__time">{now}</span>
                            <span className="kb-day__now-line">Bây giờ</span>
                          </li>
                        )}
                        <li className={`kb-day__step kb-day__step--${step.state} ${isFocus ? 'kb-day__step--focus' : ''}`}>
                          <span className="kb-day__time">{step.time}</span>
                          <span className="kb-day__dot" aria-hidden="true" />
                          <div className="kb-day__body">
                            <div className="kb-day__head">
                              <Icon size={18} aria-hidden="true" />
                              <b>{step.title}</b>
                              {step.badge}
                              {isFocus && <span className="chip chip--blue">{due ? 'Cần làm lúc này' : 'Việc tiếp theo'}</span>}
                            </div>
                            {step.meta && <span className="kb-day__meta">{step.meta}</span>}
                            {step.to && (
                              <Link className="kb-day__link" to={step.to}>
                                {step.linkLabel} <ArrowRight size={14} aria-hidden="true" />
                              </Link>
                            )}
                          </div>
                        </li>
                      </Fragment>
                    );
                  })}
                  {nowIndex === steps.length && (
                    <li className="kb-day__now" aria-label={`Bây giờ ${now}`}>
                      <span className="kb-day__time">{now}</span>
                      <span className="kb-day__now-line">Bây giờ</span>
                    </li>
                  )}
                </ol>
              </>
            )}
          </Widget>
          {showTodo && (
            <Widget title="Cần xử lý" icon={ListTodo} loading={!campusId || firstLoad(dayQ)} error={dayQ.error} onRetry={dayQ.reload}>
              {day && <ShortList rows={todoRows(day, user)} />}
            </Widget>
          )}
        </div>
        <div className="kb-flow-board__aside">
          <Widget
            title="Thực đơn trong ngày"
            icon={UtensilsCrossed}
            to={`/kitchen/published-menu?date=${date}`}
            linkLabel="Xem thực đơn đã công bố"
            loading={firstLoad(menuQ)}
            error={menuQ.error}
            onRetry={menuQ.reload}
            empty={!menuGrid.rows.length}
            emptyTitle="Chưa có thực đơn công bố cho ngày này"
          >
            {/* Bảng ngang nhóm tuổi × bữa thay cho danh sách chip dọc: cả ngày gói trong một màn hình */}
            <div className="table-wrap" key={`${campusId}_${date}`}>
              <table className="table table--grid table--compact kb-day-menu">
                <thead>
                  <tr>
                    <th className="kb-day-menu__group">Nhóm tuổi</th>
                    {menuGrid.sessions.map((s) => (
                      <th key={s}>{MEAL_SESSION_LABELS[s] || s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {menuGrid.rows.map((r) => {
                    const group = ageGroupById(r.ageGroupId)?.shortName || 'Toàn trường';
                    // Thay đổi dị ứng của nhóm tuổi: hàng riêng ngay dưới, ô món chỉ còn tên món
                    const hasChanges = menuGrid.sessions.some((s) => r.bySession[s]?.allergyChanges?.length);
                    return (
                      <Fragment key={r.key}>
                        <tr className={r.type === MENU_TYPE.ALLERGY ? 'kb-tr--allergy' : undefined}>
                          <td>
                            <div className="fw-600">{group}</div>
                            {r.type === MENU_TYPE.ALLERGY && <div className="text-xs muted">Thực đơn thay thế (dị ứng)</div>}
                          </td>
                          {menuGrid.sessions.map((s) => {
                            const m = r.bySession[s];
                            return (
                              <td key={s}>
                                {m ? (
                                  <ul className="kb-dishes text-sm">
                                    {m.dishes.map((d) => (
                                      <li key={d.id} className={d.allergens.length ? 'kb-day-menu__allergen' : undefined}>
                                        {d.name}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                        {hasChanges && (
                          <tr className="kb-tr--allergy">
                            <td>
                              <div className="kb-menu-table__type kb-menu-table__type--change text-sm fw-600">
                                <AlertTriangle size={14} aria-hidden="true" />
                                Thay đổi cho trẻ dị ứng
                              </div>
                            </td>
                            {menuGrid.sessions.map((s) => (
                              <td key={s}>
                                <AllergyMenuChanges
                                  compact
                                  changes={r.bySession[s]?.allergyChanges}
                                  date={date}
                                  context={`${group} · ${MEAL_SESSION_LABELS[s]}`}
                                />
                              </td>
                            ))}
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Widget>
        </div>
      </div>
    </div>
  );
}
