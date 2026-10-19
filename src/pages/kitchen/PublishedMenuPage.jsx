import { Fragment, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays } from '@/components/ui/icons';
import { useKitchenCampus, usePublishedMenu } from '@/hooks/kitchen/useKitchen';
import { useMasterData } from '@/hooks/useMasterData';
import { Breadcrumb, EmptyState, ErrorState, LoadingState } from '@/components';
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

/** Xem ngày của một nhóm tuổi: mỗi món một dòng; ô bữa và loại thực đơn gộp hàng, kèm định lượng một suất cho bếp. */
function DayTable({ day, menusOf, session, title }) {
  const sessions = day.sessions
    .filter((s) => session === 'ALL' || s.session === session)
    .map((s) => ({ ...s, menus: [...menusOf(s.menus)].sort(byType) }))
    .filter((s) => s.menus.length > 0);
  const span = (m) => Math.max(m.dishes.length, 1);
  const rowCount = (m) => span(m) + (m.allergyChanges?.length ? 1 : 0);
  if (sessions.length === 0) return null;

  return (
    <div className="card">
      <div className="card__header">
        <h2 className="card__title">{title}</h2>
      </div>
      <div className="table-wrap">
        <table className="table table--grid table--compact kb-menu-table kb-menu-table--day">
          <thead>
            <tr>
              <th className="kb-menu-table__session">Bữa</th>
              <th className="kb-menu-table__group">Thực đơn</th>
              <th className="kb-menu-table__dish">Món ăn</th>
              <th>Định lượng / suất</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) =>
              s.menus.map((m, mi) => {
                const dishes = m.dishes.length ? m.dishes : [null];
                return (
                  <Fragment key={`${s.session}_${m.id}`}>
                    {dishes.map((dish, di) => (
                      <tr
                        key={`${s.session}_${m.id}_${dish?.id || 'none'}`}
                        className={m.type === MENU_TYPE.ALLERGY ? 'kb-tr--allergy' : undefined}
                      >
                        {mi === 0 && di === 0 && (
                          <th scope="rowgroup" rowSpan={s.menus.reduce((n, x) => n + rowCount(x), 0)} className="kb-menu-table__session">
                            {MEAL_SESSION_LABELS[s.session]}
                          </th>
                        )}
                        {di === 0 && (
                          <td rowSpan={span(m)} className="kb-menu-table__group">
                            <TypeLabel type={m.type} note={m.note} />
                          </td>
                        )}
                        <td>
                          {dish ? (
                            <>
                              <span className="fw-600">{dish.name}</span>
                              <AllergenChip dish={dish} />
                            </>
                          ) : (
                            <span className="muted">Chưa có món</span>
                          )}
                        </td>
                        <td className="text-sm muted">
                          {dish?.ingredients.length
                            ? dish.ingredients.map((i) => `${i.name} ${fmtQty(i.qtyPerPortion)} ${i.unit}`).join(' · ')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                    {!!m.allergyChanges?.length && (
                      <tr className="kb-tr--allergy">
                        <td colSpan={3}>
                          <AllergyMenuChanges
                            changes={m.allergyChanges}
                            date={day.date}
                            context={`${title} · ${MEAL_SESSION_LABELS[s.session]}`}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
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
  const cell = (d, g, r) => menusOf(d.sessions.find((s) => s.session === g.session)?.menus || []).find((m) => m.type === r.type);

  return (
    <div className="card">
      <div className="card__header">
        <h2 className="card__title">{title}</h2>
      </div>
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
            {groups.map((g) =>
              g.rows.map((r, i) => (
                <tr key={`${g.session}_${r.type}`} className={r.type === MENU_TYPE.ALLERGY ? 'kb-tr--allergy' : undefined}>
                  {i === 0 && (
                    <th scope="rowgroup" rowSpan={g.rows.length} className="kb-menu-table__session">
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
                          <>
                            <ul className="kb-dishes text-sm">
                              {m.dishes.map((dish) => (
                                <li key={dish.id}>
                                  {dish.name}
                                  <AllergenChip dish={dish} />
                                </li>
                              ))}
                            </ul>
                            <AllergyMenuChanges
                              changes={m.allergyChanges}
                              date={d.date}
                              context={`${title} · ${MEAL_SESSION_LABELS[g.session]}`}
                            />
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Screen #93 – Published Menu (UC 6.20): day or week view of the published menus, including allergy menus. */
export default function PublishedMenuPage() {
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || todayInput();
  const view = params.get('view') === 'week' ? 'week' : 'day';
  const [session, setSession] = useState('ALL');
  const [ageGroup, setAgeGroup] = useState('ALL');
  const md = useMasterData();
  const { campusId, setCampusId, canPick } = useKitchenCampus(md.campuses[0]?.id);
  const { days, loading, error, reload } = usePublishedMenu(date, view, campusId);
  const setParam = (key, value) => setParams({ date, view, [key]: value }, { replace: true });

  const filterMenus = (menus) =>
    menus.filter((m) => m.type === MENU_TYPE.NORMAL && (ageGroup === 'ALL' || !m.ageGroupId || m.ageGroupId === ageGroup));
  const groupIds = [
    ...new Set(
      days.flatMap((d) =>
        d.sessions
          .filter((s) => session === 'ALL' || s.session === session)
          .flatMap((s) => filterMenus(s.menus).map((m) => m.ageGroupId || '')),
      ),
    ),
  ].sort((a, b) => groupOrder(a) - groupOrder(b));

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.publishedMenu)} />
      <h1 className="page__title">Thực đơn đã công bố</h1>
      <div className="kb-toolbar">
        <KbCampusFilter campusId={campusId} onChange={setCampusId} canPick={canPick} />
        <KbDateFilter value={date} onChange={(d) => setParam('date', d)} />
        <KbSessionFilter value={session} onChange={setSession} withAll />
        <label className="date-filter">
          Nhóm tuổi
          <select className="select" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
            <option value="ALL">Tất cả nhóm tuổi</option>
            {AGE_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.shortName}
              </option>
            ))}
          </select>
        </label>
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
        <div className="kb-stack" key={`${date}_${view}_${campusId}_${session}_${ageGroup}`}>
          {view === 'day' &&
            days.map((d) => (
              <div key={d.date} className="section-title">
                {dayName(d.date)}, {formatDate(d.date)}
              </div>
            ))}
          {/* Mỗi nhóm tuổi một bảng riêng để bếp đọc theo nhóm, không phải dò trong một bảng dài */}
          {groupIds.map((gid) => {
            const menusOf = (menus) => filterMenus(menus).filter((m) => (m.ageGroupId || '') === gid);
            return view === 'week' ? (
              <WeekTable key={gid} days={days} menusOf={menusOf} session={session} title={groupName(gid)} />
            ) : (
              days.map((d) => <DayTable key={`${gid}_${d.date}`} day={d} menusOf={menusOf} session={session} title={groupName(gid)} />)
            );
          })}
        </div>
      )}
    </div>
  );
}
