import { DataTable } from '@/components';
import { formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import { formatAmount } from '@/utils/menu-planning/dayBalance';

/** Tổng hợp mua hàng toàn trường và phần của từng điểm trường (BE chia, cộng lại đúng tổng). */
export function BalanceSummaryTable({ view }) {
  const foods = new Map(view.foods.map((f) => [String(f.foodId), f]));
  const rows = view.summary.map((row) => ({ ...foods.get(String(row.foodId)), ...row }));
  const amount = (quantity, total) => (quantity == null ? `${formatAmount(Number(total) / 1000, 3)} kg` : formatAmount(quantity, 3));
  const columns = [
    { key: 'name', header: 'Thực phẩm', render: (r) => <b>{r.name}</b> },
    { key: 'purchaseUnit', header: 'ĐVT' },
    { key: 'total', header: 'Toàn trường', className: 'num', render: (r) => <b>{amount(r.purchaseQuantity, r.purchaseTotal)}</b> },
    ...view.campuses.map((campus) => ({
      key: `campus-${campus.campusId}`,
      header: campus.name,
      className: 'num',
      render: (r) => {
        const share = r.campuses.find((c) => String(c.campusId) === String(campus.campusId));
        return share ? amount(share.purchaseQuantity, share.purchaseTotal) : '—';
      },
    })),
    { key: 'cost', header: 'Tiền', className: 'money', render: (r) => formatMoney(Number(r.cost || 0)) },
  ];
  const total = view.summary.reduce((sum, r) => sum + Number(r.cost || 0), 0);
  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">Tổng hợp mua hàng cả trường</h2>
        <span className="text-sm">
          Tổng tiền: <b>{formatMoney(total)}</b>
        </span>
      </div>
      <DataTable columns={columns} rows={rows} rowKey="foodId" empty={{ title: 'Chưa có thực phẩm' }} />
    </section>
  );
}
