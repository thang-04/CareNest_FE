import { useState } from 'react';
import { Checkbox, DataTable } from '@/components';
import { NumberCell } from '@/components/menu-planning/balance/NumberCell';
import { MEAL_SESSION_LABELS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import { baseUnitLabels } from '@/utils/menu-planning/foodUnits';
import { formatAmount, foodRowsOf } from '@/utils/menu-planning/dayBalance';

const money = (value) => (value == null ? '—' : formatMoney(Number(value)));

/**
 * Bảng thực phẩm của một nhóm tuổi (bố cục PMS): gam một trẻ và lượng mua theo đơn vị mua sửa được, các cột còn lại BE tính.
 * `onEdit(edit)` không truyền ⇒ chỉ xem.
 */
export function BalanceFoodTable({ view, group, busy, onEdit }) {
  const [detail, setDetail] = useState(false);
  const rows = foodRowsOf(view, group.ageGroupId);
  const children = view.groups.find((g) => String(g.ageGroupId) === String(group.ageGroupId))?.children ?? 0;
  const edit = (foodId, change) => onEdit({ ageGroupId: group.ageGroupId, foodId, ...change });

  const columns = [
    { key: 'code', header: 'Mã', className: 'center', render: (r) => <span className="muted">{r.code}</span> },
    {
      key: 'name',
      header: 'Tên thực phẩm',
      className: 'td-bal__name',
      render: (r) => (
        <div className="td-bal__food">
          <b>{r.name}</b>
          {detail && (
            <ul className="td-bal__meals text-sm muted">
              {r.meals.map((m, i) => (
                <li key={`${m.session}-${i}`}>
                  {MEAL_SESSION_LABELS[m.session] || m.session} · {m.dishName}: {formatAmount(m.grams)} {baseUnitLabels(r.unit).small}
                </li>
              ))}
            </ul>
          )}
        </div>
      ),
    },
    {
      key: 'gramsPerChild',
      header: 'Ăn 1 trẻ (g/ml)',
      className: 'num',
      render: (r) =>
        onEdit ? (
          <NumberCell
            value={r.gramsPerChild}
            max={5000}
            disabled={busy}
            label={`Gam một trẻ ${r.name}`}
            onCommit={(gramsPerChild) => edit(r.foodId, { gramsPerChild })}
          />
        ) : (
          formatAmount(r.gramsPerChild)
        ),
    },
    {
      key: 'totalGrams',
      header: `Ăn ${children} trẻ (kg/lít)`,
      className: 'num',
      render: (r) => `${formatAmount(Number(r.totalGrams) / 1000, 3)} ${baseUnitLabels(r.unit).big}`,
    },
    { key: 'wastePct', header: 'Thải bỏ (%)', className: 'num', render: (r) => formatAmount(r.wastePct) },
    {
      key: 'purchaseTotal',
      header: `Mua ${children} trẻ (kg/lít)`,
      className: 'num',
      render: (r) => `${formatAmount(Number(r.purchaseTotal) / 1000, 3)} ${baseUnitLabels(r.unit).big}`,
    },
    {
      key: 'purchaseQuantity',
      header: 'Mua theo ĐVT',
      className: 'num',
      render: (r) =>
        onEdit && children > 0 && r.purchaseQuantity != null ? (
          <NumberCell
            value={r.purchaseQuantity}
            max={1000000}
            disabled={busy}
            label={`Lượng mua ${r.name}`}
            onCommit={(purchaseQuantity) => edit(r.foodId, { purchaseQuantity })}
          />
        ) : (
          formatAmount(r.purchaseQuantity, 3)
        ),
    },
    { key: 'purchaseUnit', header: 'ĐVT', className: 'center' },
    {
      key: 'purchaseUnitSize',
      header: 'Quy đổi (g/ml)',
      className: 'num',
      render: (r) => `${formatAmount(r.purchaseUnitSize)} ${baseUnitLabels(r.unit).small}`,
    },
    { key: 'unitPrice', header: 'Đơn giá', className: 'money', render: (r) => money(r.unitPrice) },
    { key: 'cost', header: 'Thành tiền', className: 'money', render: (r) => money(r.cost) },
  ];

  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">
          Thực phẩm · {group.name} · {children} trẻ
        </h2>
        <label className="checkbox text-sm">
          <Checkbox checked={detail} onChange={(e) => setDetail(e.target.checked)} /> Hiện chi tiết theo bữa
        </label>
      </div>
      <DataTable
        className="td-bal__table table--compact"
        columns={columns}
        rows={rows}
        rowKey="foodId"
        groupBy={(r) => (r.storage === 'DRY' ? 'DRY' : 'FRESH')}
        groupLabel={(key, items) => (
          <>
            {key === 'DRY' ? 'Kho khô' : 'Đi chợ'} <span className="muted">· {items.length} thực phẩm</span>
          </>
        )}
        empty={{ title: 'Chưa có thực phẩm', description: 'Món của ngày chưa khai định lượng cho nhóm tuổi này.' }}
      />
    </section>
  );
}
