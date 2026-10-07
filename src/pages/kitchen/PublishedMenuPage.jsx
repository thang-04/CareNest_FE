import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarDays } from 'lucide-react';
import { usePublishedMenu } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, EmptyState, ErrorState, LoadingState } from '@/components';
import { KbDateFilter, KbSessionFilter, fmtQty } from '@/components/kitchen/KitchenFilters';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDate, todayInput } from '@/utils/format';
import { AGE_GROUPS, ageGroupById } from '@/models/School';
import { MEAL_SESSION_LABELS, MENU_TYPE, MENU_TYPE_LABELS } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const dayName = (date) => WEEKDAYS[new Date(`${date}T00:00:00`).getDay()];
const groupName = (id) => (id ? ageGroupById(id)?.shortName || id : 'Tất cả nhóm tuổi');

function MenuCard({ menu, detailed }) {
  const allergy = menu.type === MENU_TYPE.ALLERGY;
  return (
    <div className={`kb-menu ${allergy ? 'kb-menu--allergy' : ''}`}>
      <div className="kb-menu__head">
        <div>
          <div className="fw-600">{groupName(menu.ageGroupId)}</div>
          <div className="text-xs muted">{MENU_TYPE_LABELS[menu.type]}</div>
        </div>
        {allergy && <AlertTriangle size={16} className="text-2" aria-hidden="true" />}
      </div>
      <ul className="kb-dishes text-sm">
        {menu.dishes.map((d) => (
          <li key={d.id}>
            <b>{d.name}</b>
            {d.allergens.length > 0 && (
              <span className="chip chip--red" style={{ marginLeft: 6 }}>
                Có {d.allergens.join(', ')}
              </span>
            )}
            {detailed && d.ingredients.length > 0 && (
              <div className="muted text-xs">
                {d.ingredients.map((i) => `${i.name} ${fmtQty(i.qtyPerPortion)} ${i.unit}`).join(' · ')} / suất
              </div>
            )}
          </li>
        ))}
      </ul>
      {menu.note && <div className="text-xs text-2 mt-8">Hướng dẫn: {menu.note}</div>}
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
  const { days, loading, error, reload } = usePublishedMenu(date, view);
  const setParam = (key, value) => setParams({ date, view, [key]: value }, { replace: true });

  const filterMenus = (menus) => menus.filter((m) => ageGroup === 'ALL' || !m.ageGroupId || m.ageGroupId === ageGroup);
  const hasAny = days.some((d) => d.sessions.some((s) => s.menus.length > 0));

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.publishedMenu)} />
      <h1 className="page__title">Thực đơn đã công bố</h1>
      <div className="kb-toolbar">
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
      ) : !hasAny ? (
        <div className="card">
          <EmptyState
            icon={CalendarDays}
            title="Chưa có thực đơn đã công bố"
            description="Không có thực đơn đã công bố cho thời gian đã chọn. Chọn ngày khác."
          />
        </div>
      ) : (
        <div className="kb-week">
          {days.map((d) => {
            const sessions = d.sessions.filter((s) => session === 'ALL' || s.session === session);
            const empty = sessions.every((s) => filterMenus(s.menus).length === 0);
            return (
              <div key={d.date} className="card">
                <div className="card__header">
                  <div className="card__title">
                    {dayName(d.date)}, {formatDate(d.date)}
                  </div>
                </div>
                <div className="card__body stack">
                  {empty ? (
                    <div className="muted">Không có thực đơn đã công bố.</div>
                  ) : (
                    sessions.map((s) => (
                      <div key={s.session}>
                        <div className="subsection-title mb-8">{MEAL_SESSION_LABELS[s.session]}</div>
                        <div className="kb-menu-grid">
                          {filterMenus(s.menus).map((m) => (
                            <MenuCard key={m.id} menu={m} detailed={view === 'day'} />
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
