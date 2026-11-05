import { Fragment, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays } from '@/components/ui/icons';
import { useKitchenCampus, usePublishedMenu } from '@/hooks/kitchen/useKitchen';
import { useMasterData } from '@/hooks/useMasterData';
import { Breadcrumb, EmptyState, ErrorState, LoadingState } from '@/components';
import { Tabs } from '@/components/ui/Tabs';
import { useTabParam } from '@/hooks/useTabParam';
import { KbCampusFilter, KbDateFilter, KbSessionFilter, fmtQty } from '@/components/kitchen/KitchenFilters';
import { AllergyMenuChanges } from '@/components/kitchen/AllergyMenuChanges';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDate, todayInput } from '@/utils/format';
import { AGE_GROUPS, ageGroupById } from '@/models/School';
import { MEAL_SESSION_LABELS, MENU_TYPE, MENU_TYPE_LABELS } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const dayName = (date) => WEEKDAYS[new Date(`${date}T00:00:00`).getDay()];
const groupName = (id) => (id ? ageGroupById(id)?.shortName || id : 'Tất cả nhóm tuổi');

const groupOrder = (id) => (id ? AGE_GROUPS.findIndex((a) => a.id === id) : -1);
// Thực đơn thường đứng trước thực đơn thay thế (dị ứng)
const byType = (a, b) => (a.type === MENU_TYPE.ALLERGY) - (b.type === MENU_TYPE.ALLERGY);

function TypeLabel({ type, note }) {
  return (
    <>
      <div className="kb-menu-table__type fw-600">
        {type === MENU_TYPE.ALLERGY && <AlertTriangle size={14} aria-hidden="true" />}
        {MENU_TYPE_LABELS[type]}
      </div>
      {note && <div className="text-xs text-2 mt-8">Hướng dẫn: {note}</div>}
    </>
  );
}

const AllergenChip = ({ dish }) =>
  dish.allergens.length > 0 && <span className="chip chip--red kb-menu-table__chip">Có {dish.allergens.join(', ')}</span>;

/**
 * Xem ngày của một nhóm tuổi: mỗi thực phẩm một dòng, cột riêng cho tên, lượng một suất và đơn vị (dễ dò hơn chuỗi gộp);
 * ô bữa và món gộp hàng. Màn chỉ hiện thực đơn thường nên không cần cột loại thực đơn; hướng dẫn nằm dưới tên bữa.
 */
function DayTable({ day, menusOf, session, title }) {
  const sessions = day.sessions
    .filter((s) => session === 'ALL' || s.session === session)
    .map((s) => ({ ...s, menus: [...menusOf(s.menus)].sort(byType) }))
    .filter((s) => s.menus.length > 0);
  if (sessions.length === 0) return null;
  // Mỗi món chiếm số dòng = số thực phẩm (ít nhất 1); bữa có thay đổi dị ứng cộng thêm 1 dòng
  const dishesOf = (m) => (m.dishes.length ? m.dishes : [null]);
  const ingsOf = (dish) => (dish?.ingredients?.length ? dish.ingredients : [null]);
  const sessionRows = (s) =>
    s.menus.reduce((n, m) => n + dishesOf(m).reduce((k, d) => k + ingsOf(d).length, 0) + (m.allergyChanges?.length ? 1 : 0), 0);

  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact kb-menu-table kb-menu-table--day">
        <thead>
          <tr>
            <th className="kb-menu-table__session">Bữa</th>
            <th className="kb-menu-table__dish">Món ăn</th>
            <th>Thực phẩm</th>
            <th className="num">Lượng / suất</th>
            <th>Đơn vị</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const note = s.menus.map((m) => m.note).find(Boolean);
            const rows = s.menus.flatMap((m) => [
              ...dishesOf(m).flatMap((dish) => ingsOf(dish).map((ing, ii) => ({ kind: 'ing', m, dish, ing, ii }))),
              ...(m.allergyChanges?.length ? [{ kind: 'allergy', m }] : []),
            ]);
            return rows.map((r, ri) => {
              const sessionCell = ri === 0 && (
                <th scope="rowgroup" rowSpan={sessionRows(s)} className="kb-menu-table__session">
                  {MEAL_SESSION_LABELS[s.session]}
                  {note && <div className="text-xs text-2 kb-menu-table__note">Hướng dẫn: {note}</div>}
                </th>
              );
              if (r.kind === 'allergy')
                return (
                  <tr key={`${s.session}_${r.m.id}_allergy`} className="kb-tr--allergy">
                    {sessionCell}
                    <td colSpan={4}>
                      <AllergyMenuChanges
                        changes={r.m.allergyChanges}
                        date={day.date}
                        context={`${title} · ${MEAL_SESSION_LABELS[s.session]}`}
                      />
                    </td>
                  </tr>
                );
              const { dish, ing, ii } = r;
              return (
                <tr key={`${s.session}_${r.m.id}_${dish?.id || 'none'}_${ii}`}>
                  {sessionCell}
                  {ii === 0 && (
                    <td rowSpan={ingsOf(dish).length} className="kb-menu-table__dish">
                      {dish ? (
                        <>
                          <span className="fw-600">{dish.name}</span>
                          <AllergenChip dish={dish} />
                        </>
                      ) : (
                        <span className="muted">Chưa có món</span>
                      )}
                    </td>
                  )}
                  <td>{ing ? ing.name : <span className="muted">—</span>}</td>
                  {ing && ing.qtyPerPortion == null ? (
                    <td colSpan={2} className="text-sm text-warning">
                      Chưa nhập cho nhóm tuổi này
                    </td>
                  ) : (
                    <>
                      <td className="num nowrap">{ing ? fmtQty(ing.qtyPerPortion) : ''}</td>
                      <td className="muted">{ing?.unit || ''}</td>
                    </>
                  )}
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Xem tuần của một nhóm tuổi: hàng = bữa × loại thực đơn, cột = ngày, để so món giữa các ngày như màn Thực đơn tuần. */
function WeekTable({ days, menusOf, session, title }) {
  const groups = [];
  for (const d of days) {
    for (const s of d.sessions) {
      if (session !== 'ALL' && s.session !== session) continue;
      const menus = menusOf(s.menus);
      if (!menus.length) continue;
      let g = groups.find((x) => x.session === s.session);
      if (!g) groups.push((g = { session: s.session, rows: [] }));
      for (const m of menus) if (!g.rows.some((r) => r.type === m.type)) g.rows.push({ type: m.type });
    }
  }
  if (groups.length === 0) return null;
  for (const g of groups) g.rows.sort(byType);
  const menusIn = (d, g) => menusOf(d.sessions.find((s) => s.session === g.session)?.menus || []);
  const cell = (d, g, r) => menusIn(d, g).find((m) => m.type === r.type);
  // Thay đổi dị ứng của cả bữa trong ngày: hiện ở hàng riêng dưới bữa, không chen vào ô món
  const changesOf = (d, g) => menusIn(d, g).flatMap((m) => m.allergyChanges || []);
  for (const g of groups) g.hasChanges = days.some((d) => changesOf(d, g).length > 0);

  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact kb-menu-table kb-menu-table--week">
        <thead>
          <tr>
            <th className="kb-menu-table__session">Bữa</th>
            <th className="kb-menu-table__group">Thực đơn</th>
            {days.map((d) => (
              <th key={d.date}>
                {dayName(d.date)}
                <small>{formatDate(d.date)}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.session}>
              {g.rows.map((r, i) => (
                <tr key={r.type} className={r.type === MENU_TYPE.ALLERGY ? 'kb-tr--allergy' : undefined}>
                  {i === 0 && (
                    <th scope="rowgroup" rowSpan={g.rows.length + (g.hasChanges ? 1 : 0)} className="kb-menu-table__session">
                      {MEAL_SESSION_LABELS[g.session]}
                    </th>
                  )}
                  <td>
                    <TypeLabel type={r.type} />
                  </td>
                  {days.map((d) => {
                    const m = cell(d, g, r);
                    return (
                      <td key={d.date}>
                        {m ? (
                          <ul className="kb-dishes text-sm">
                            {m.dishes.map((dish) => (
                              <li key={dish.id}>
                                {dish.name}
                                <AllergenChip dish={dish} />
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
              ))}
              {g.hasChanges && (
                <tr className="kb-tr--allergy">
                  <td>
                    <div className="kb-menu-table__type kb-menu-table__type--change fw-600">
                      <AlertTriangle size={14} aria-hidden="true" />
                      Thay đổi cho trẻ dị ứng
                    </div>
                  </td>
                  {days.map((d) => (
                    <td key={d.date}>
                      <AllergyMenuChanges
                        compact
                        changes={changesOf(d, g)}
                        date={d.date}
                        context={`${title} · ${MEAL_SESSION_LABELS[g.session]}`}
                      />
                    </td>
                  ))}
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Screen #93 – Published Menu (UC 6.20): day or week view of the published menus, including allergy menus. */
export default function PublishedMenuPage() {
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || todayInput();
  const view = params.get('view') === 'week' ? 'week' : 'day';
  const [session, setSession] = useState('ALL');
  const md = useMasterData();
  const { campusId, setCampusId, canPick } = useKitchenCampus(md.campuses[0]?.id);
  const { days, loading, error, reload } = usePublishedMenu(date, view, campusId);
  // Giữ tham số khác (vd. nhóm tuổi đang mở) khi đổi ngày / kiểu xem
  const setParam = (key, value) => setParams((prev) => ({ ...Object.fromEntries(prev), [key]: value }), { replace: true });

  const filterMenus = (menus) => menus.filter((m) => m.type === MENU_TYPE.NORMAL);
  const groupIds = [
    ...new Set(
      days.flatMap((d) =>
        d.sessions
          .filter((s) => session === 'ALL' || s.session === session)
          .flatMap((s) => filterMenus(s.menus).map((m) => m.ageGroupId || '')),
      ),
    ),
  ].sort((a, b) => groupOrder(a) - groupOrder(b));
  const [groupParam, setGroup] = useTabParam(groupIds.length ? groupIds : [''], 'group');
  const activeGroup = groupIds.includes(groupParam) ? groupParam : groupIds[0];
  const menusOfActive = (menus) => filterMenus(menus).filter((m) => (m.ageGroupId || '') === activeGroup);

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.publishedMenu)} />
      <h1 className="page__title">Thực đơn đã công bố</h1>
      <div className="kb-toolbar">
        <KbCampusFilter campusId={campusId} onChange={setCampusId} canPick={canPick} />
        <KbDateFilter value={date} onChange={(d) => setParam('date', d)} />
        <KbSessionFilter value={session} onChange={setSession} withAll />
        <div className="kb-toolbar__end tabs" role="tablist" aria-label="Kiểu xem">
          {[
            ['day', 'Theo ngày'],
            ['week', 'Theo tuần'],
          ].map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              className={`tab ${view === key ? 'tab--active' : ''}`}
              onClick={() => setParam('view', key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : groupIds.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CalendarDays}
            title="Chưa có thực đơn đã công bố"
            description="Không có thực đơn đã công bố cho thời gian đã chọn. Chọn ngày khác."
          />
        </div>
      ) : (
        // Mỗi nhóm tuổi một tab (DESIGN §6.3 Chia tab màn dài) thay cho các bảng xếp chồng cả trang
        <div className="kb-stack">
          <Tabs
            ariaLabel="Nhóm tuổi"
            value={activeGroup}
            onChange={setGroup}
            items={groupIds.map((gid) => ({ key: gid, label: groupName(gid) }))}
          />
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">
                {groupName(activeGroup)}
                {view === 'day' && days[0] && (
                  <span className="text-sm muted">
                    {' '}
                    · {dayName(days[0].date)}, {formatDate(days[0].date)}
                  </span>
                )}
              </h2>
            </div>
            {view === 'week' ? (
              <WeekTable days={days} menusOf={menusOfActive} session={session} title={groupName(activeGroup)} />
            ) : (
              days.map((d) => <DayTable key={d.date} day={d} menusOf={menusOfActive} session={session} title={groupName(activeGroup)} />)
            )}
          </section>
        </div>
      )}
    </div>
  );
}
