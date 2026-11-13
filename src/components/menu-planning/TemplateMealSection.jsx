import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Plus, Trash2, UtensilsCrossed } from '@/components/ui/icons';
import { dishTypeClass } from '@/utils/dishTypeClass';
import { DISH_TYPE_LABELS, MEAL_SESSION_LABELS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';

const num = (v) => (v == null ? '—' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 }));

/**
 * Một bữa của mẫu ngày: món theo loại, mở món xem thành phần cho 1 trẻ (số do BE tính — `dishIngredients` của menu-statistics).
 * Thành phần chỉ xem; gam/trẻ thuộc công thức món theo nhóm tuổi (NUT-18) nên sửa ở trang món.
 */
export function TemplateMealSection({ session, items, ingredients, loading, editable, canEditRecipe, onAdd, onRemove }) {
  // Món mở sẵn thành phần; người dùng thu gọn món nào thì nhớ món đó
  const [closed, setClosed] = useState(() => new Set());
  const toggle = (id) => setClosed((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  // ingredients: mảng; null = máy chủ không trả thành phần món; undefined = đang tải
  const lines = (dishId) => (ingredients || []).filter((l) => l.session === session && String(l.dishId) === String(dishId));
  const label = MEAL_SESSION_LABELS[session] || session;
  const noLines = ingredients === null && !loading;

  return (
    <section className={`card td-meal ${loading ? 'td-meal--busy' : ''}`} aria-label={label} aria-busy={!!loading}>
      <div className="card__header">
        <h2 className="card__title">{label}</h2>
        {editable && items.length > 0 && (
          <button type="button" className="btn btn--sm" onClick={onAdd}>
            <Plus size={16} /> Thêm món ăn
          </button>
        )}
      </div>
      {items.length === 0 ? (
        // Bữa trống: một dòng gọn thay cho khối tranh lớn, để nhiều bữa trống không đẩy phần chính xuống dưới
        <div className="td-meal__empty">
          <UtensilsCrossed size={18} aria-hidden="true" />
          <span>
            <b>Chưa có món</b> · Chọn một hoặc nhiều món cho bữa này.
          </span>
          {editable && (
            <button type="button" className="btn btn--primary btn--sm" onClick={onAdd}>
              <Plus size={16} /> Thêm món ăn
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table table--grid td-meal__table">
            {!noLines && (
              <thead>
                <tr>
                  <th className="td-meal__no">STT</th>
                  <th>Thực phẩm</th>
                  <th className="num">Lượng ăn (g)</th>
                  <th className="num">Thải bỏ (%)</th>
                  <th className="num">Lượng mua (g)</th>
                  <th className="money">Đơn giá</th>
                  <th className="money">Thành tiền</th>
                </tr>
              </thead>
            )}
            <tbody>
              {items.map((item) => {
                const list = lines(item.dishId);
                const isOpen = !closed.has(item.dishId);
                return (
                  <Fragment key={item.dishId}>
                    <tr className={`td-meal__dish ${dishTypeClass(item.dishType)}`}>
                      <td colSpan={7}>
                        <div className="td-meal__dish-in">
                          {!noLines && (
                            <button
                              type="button"
                              className="icon-btn"
                              aria-expanded={isOpen}
                              aria-label={`${isOpen ? 'Ẩn' : 'Xem'} thành phần ${item.dishName}`}
                              onClick={() => toggle(item.dishId)}
                            >
                              {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          )}
                          <b>{item.dishName || 'Món đã xóa'}</b>
                          {item.dishType && <span className="chip">{DISH_TYPE_LABELS[item.dishType] || item.dishType}</span>}
                          <span className="td-grow" />
                          {list.length > 0 && <span className="text-sm muted">{list.length} thành phần</span>}
                          {canEditRecipe && (
                            <Link className="btn btn--ghost btn--sm" to={`/menu/dishes/${item.dishId}/edit`}>
                              Sửa công thức
                            </Link>
                          )}
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
                      !noLines &&
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
                            {loading || ingredients === undefined ? 'Đang tải thành phần…' : 'Chưa có thành phần cho nhóm tuổi đang xem.'}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {noLines && (
            // Máy chủ cũ không trả `dishIngredients`: báo một lần cho cả bữa thay vì lặp dưới từng món
            <p className="td-meal__note text-sm muted">
              Chưa xem được thành phần từng món (máy chủ chưa hỗ trợ). Dinh dưỡng của ngày vẫn tính đủ.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
