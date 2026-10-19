import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bowl, ChevronDown, Coin, Gear, Plus, Search, Sparkles } from '@/components/ui/icons';
import { useMenuAccess, useMenuCatalog, useSampleMenus } from '@/hooks/menu-planning/useMenuPlanning';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { checkDayMenu } from '@/utils/menu-planning/menuChecks';
import { activeAgeGroups } from '@/utils/menu-planning/nutritionSetup';
import { sampleMenuCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { todayInput } from '@/utils/format';
import { RECORD_STATUS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const fmt = (v) => Math.round(v).toLocaleString('vi-VN');

/** Bước 3 luồng dinh dưỡng – thực đơn mẫu (một ngày theo từng bữa) chia theo nhóm tuổi; mỗi nhóm thu gọn, bấm để mở. */
export default function MenuListPage() {
  const { canManage } = useMenuAccess();
  const { catalog, loading: catLoading } = useMenuCatalog();
  const [keyword, setKeyword] = useState('');
  // Mặc định mở hết các nhóm tuổi; người dùng thu gọn nhóm nào thì nhớ nhóm đó
  const [closed, setClosed] = useState([]);
  const { items, loading, error, reload } = useSampleMenus({ keyword });
  const today = todayInput();
  const groups = activeAgeGroups(catalog.nutritionSetups);
  const toggle = (id) => setClosed((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const menus = items.filter((m) => m.status !== RECORD_STATUS.INACTIVE);

  const head = (
    <>
      <Breadcrumb items={sampleMenuCrumbs()} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Thực đơn mẫu</h1>
          <p className="page__desc">Thực đơn một ngày theo từng bữa cho một nhóm tuổi. Dùng lại khi xếp thực đơn tuần.</p>
        </div>
        <div className="page__actions">
          <Link className="btn" to="/menu/setup">
            <Gear size={16} /> Thiết lập bữa ăn
          </Link>
          {canManage && (
            <>
              <Link className="btn btn--outline-primary" to="/menu/menus/new?ai=1">
                <Sparkles size={16} /> AI soạn mẫu mới
              </Link>
              <Link className="btn btn--primary" to="/menu/menus/new">
                <Plus size={16} /> Thêm thực đơn mẫu
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );

  if (loading || catLoading)
    return (
      <div className="page">
        {head}
        <LoadingState />
      </div>
    );
  if (error)
    return (
      <div className="page">
        {head}
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  return (
    <div className="page">
      {head}
      <div className="filter-bar td-plain-filter">
        <label className="search-box td-grow">
          <Search size={17} className="muted" />
          <input placeholder="Tìm tên thực đơn…" value={keyword} onChange={(e) => setKeyword(e.target.value)} aria-label="Tìm thực đơn" />
        </label>
      </div>
      {groups.map((g) => {
        const list = menus
          .filter((m) => m.ageGroupId === g.id)
          .map((m) => ({ m, c: checkDayMenu({ meals: m.meals, ageGroupId: g.id, catalog, date: today }) }));
        const ok = list.filter((x) => x.c.status.tone === 'green').length;
        // Đang tìm kiếm thì mở sẵn nhóm có kết quả
        const isOpen = !closed.includes(g.id) || (keyword.trim() && list.length > 0);
        return (
          <section key={g.id} className={`td-tpl-group ${isOpen ? 'td-lib-item--open' : ''}`}>
            <button type="button" className="td-acc__toggle td-tpl-group__head" aria-expanded={!!isOpen} onClick={() => toggle(g.id)}>
              <ChevronDown size={18} className="td-acc__chev" aria-hidden="true" />
              <b>{g.shortName}</b>
              <span className="td-acc__summary">
                {list.length} mẫu{list.length ? ` · ${ok} đạt chuẩn · ${list.length - ok} cần xem` : ''}
              </span>
            </button>
            {isOpen &&
              (list.length ? (
                <div className="td-tpl-cards">
                  {list.map(({ m, c }) => (
                    <Link key={m.id} className="card td-tpl-card" to={canManage ? `/menu/menus/${m.id}/edit` : `/menu/menus/${m.id}`}>
                      <span className="td-tpl-card__head">
                        <b>{m.name}</b>
                        <span className={`chip chip--${c.status.tone}`}>{c.status.label}</span>
                      </span>
                      <span className="row td-chips">
                        <span className="chip chip--blue">
                          <Bowl size={13} /> {c.mealCount} bữa
                        </span>
                        <span className="chip chip--teal">
                          <Coin size={13} /> {formatMoney(c.cost)}
                        </span>
                        <span className="chip chip--gray">{fmt(c.totals.kcal)} kcal</span>
                      </span>
                      <ul className="td-tpl-card__dishes">
                        {m.meals
                          .flatMap((meal) => meal.items)
                          .slice(0, 4)
                          .map((it, i) => (
                            <li key={i}>{catalog.dishById[it.dishId]?.name || 'Món đã xóa'}</li>
                          ))}
                      </ul>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="card td-tpl-empty">
                  <EmptyState title="Chưa có thực đơn mẫu cho nhóm này" />
                  {canManage && (
                    <Link className="btn btn--sm btn--outline-primary" to={`/menu/menus/new?ai=1&ageGroupId=${g.id}`}>
                      <Sparkles size={15} /> AI soạn mẫu
                    </Link>
                  )}
                </div>
              ))}
          </section>
        );
      })}
    </div>
  );
}
