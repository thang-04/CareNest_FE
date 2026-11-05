import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Plus, Trash2, UtensilsCrossed } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/States';
import { dishTypeClass } from '@/utils/menu-planning/dishTypeClass';
import { DISH_TYPE_LABELS, MEAL_SESSION_LABELS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';

const num = (v) => (v == null ? '—' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 }));

/**
 * Một bữa của mẫu ngày: món theo loại, mở món xem thành phần cho 1 trẻ (số do BE tính — `dishIngredients` của menu-statistics).
 * Thành phần chỉ xem; gam/trẻ thuộc công thức món theo nhóm tuổi (NUT-18) nên sửa ở trang món.
 */
export function TemplateMealSection({ session, items, ingredients, editable, onAdd, onRemove }) {
  // Món mở sẵn thành phần; người dùng thu gọn món nào thì nhớ món đó
  const [closed, setClosed] = useState(() => new Set());
  const toggle = (id) => setClosed((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  const lines = (dishId) => (ingredients || []).filter((l) => l.session === session && String(l.dishId) === String(dishId));
  const label = MEAL_SESSION_LABELS[session] || session;

  return (
    <section className="card td-meal" aria-label={label}>
      <div className="card__header">
        <h2 className="card__title">{label}</h2>
        {editable && items.length > 0 && (
          <button type="button" className="btn btn--sm" onClick={onAdd}>
            <Plus size={16} /> Thêm món ăn
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title={`${label} chưa có món`}
          description="Chọn một hoặc nhiều món cho bữa này."
          action={
            editable && (
              <button type="button" className="btn btn--primary" onClick={onAdd}>
                <Plus size={16} /> Thêm món ăn
              </button>
            )
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="table table--grid td-meal__table">
            <thead>
              <tr>
                <th className="td-meal__no">#</th>
                <th>Thực phẩm</th>
                <th className="num">Lượng ăn (g)</th>
                <th className="num">Thải bỏ (%)</th>
                <th className="num">Lượng mua (g)</th>
                <th className="money">Đơn giá</th>
                <th className="money">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const list = lines(item.dishId);
                const isOpen = !closed.has(item.dishId);
                return (
                  <Fragment key={item.dishId}>
                    <tr className={`td-meal__dish ${dishTypeClass(item.dishType)}`}>
                      <td colSpan={7}>
                        <div className="td-meal__dish-in">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-expanded={isOpen}
                            aria-label={`${isOpen ? 'Ẩn' : 'Xem'} thành phần ${item.dishName}`}
                            onClick={() => toggle(item.dishId)}
                          >
                            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                          <b>{item.dishName || 'Món đã xóa'}</b>
                          {item.dishType && <span className="chip">{DISH_TYPE_LABELS[item.dishType] || item.dishType}</span>}
                          <span className="td-grow" />
                          {list.length > 0 && <span className="text-sm muted">{list.length} thành phần</span>}
                          <Link className="btn btn--ghost btn--sm" to={`/menu/dishes/${item.dishId}/edit`}>
                            Sửa công thức
                          </Link>
                          {editable && (
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={`Bỏ ${item.dishName}`}
                              onClick={() => onRemove(item.dishId)}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isOpen &&
                      (list.length ? (
                        list.map((l, i) => (
                          <tr key={`${l.foodId}-${i}`} className="td-meal__line">
                            <td className="td-meal__no muted">{i + 1}</td>
                            <td>{l.foodName}</td>
                            <td className="num">{num(l.gramsPerChild)}</td>
                            <td className="num">{num(l.wastePct)}</td>
                            <td className="num">{num(l.purchasePerChild)}</td>
                            <td className="money nowrap">
                              {l.unitPrice == null
                                ? '—'
                                : `${formatMoney(Number(l.unitPrice))}${l.purchaseUnit ? ` / ${l.purchaseUnit}` : ''}`}
                            </td>
                            <td className="money nowrap">{l.costPerChild == null ? '—' : formatMoney(Number(l.costPerChild))}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="td-meal__line">
                          <td colSpan={7} className="text-sm muted">
                            Chưa có thành phần cho nhóm tuổi đang xem.
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
