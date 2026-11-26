import { DataTable, StatusBadge } from '@/components';
import { MEAL_SESSION_LABELS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import { formatAmount, nutritionTableOf, verdictOf } from '@/utils/menu-planning/dayBalance';

const NUTRITION_COLUMNS = [
  { key: 'label', header: 'Một trẻ một ngày', render: (r) => <b>{r.label}</b> },
  { key: 'animalProtein', header: 'Đạm ĐV (g)', className: 'num' },
  { key: 'plantProtein', header: 'Đạm TV (g)', className: 'num' },
  { key: 'animalLipid', header: 'Béo ĐV (g)', className: 'num' },
  { key: 'plantLipid', header: 'Béo TV (g)', className: 'num' },
  { key: 'glucid', header: 'Đường (g)', className: 'num' },
  { key: 'kcal', header: 'Calo (kcal)', className: 'num' },
];

const SESSION_COLUMNS = [
  { key: 'session', header: 'Bữa ăn', render: (r) => MEAL_SESSION_LABELS[r.session] || r.session },
  { key: 'kcal', header: 'Calo', className: 'num', render: (r) => formatAmount(r.kcal, 1) },
  { key: 'percent', header: 'Tỷ lệ đạt (%)', className: 'num', render: (r) => formatAmount(r.percent, 1) },
  {
    key: 'norm',
    header: 'Định mức (%)',
    className: 'num',
    render: (r) => (r.min == null ? '—' : `${formatAmount(r.min)} – ${formatAmount(r.max)}`),
  },
  {
    key: 'status',
    header: 'Kết quả',
    render: (r) => (r.status === 'NA' ? '—' : <StatusBadge {...verdictOf(r.status)} />),
  },
];

/** Tiền ăn của nhóm tuổi: giá suất, phí dịch vụ, ngân sách ± biên và chi phí thực tế mỗi trẻ (BE tính). */
export function BalanceMoney({ evaluation }) {
  if (!evaluation) return null;
  const money = (v) => (v == null ? '—' : formatMoney(Number(v)));
  const difference = evaluation.foodBudget == null ? null : Number(evaluation.cost) - Number(evaluation.foodBudget);
  const items = [
    ['Tiền ăn', money(evaluation.mealPrice)],
    ['Phí dịch vụ', money(evaluation.serviceFee)],
    ['Ngân sách thực phẩm', `${money(evaluation.foodBudget)} ±${formatAmount(evaluation.budgetTolerancePct)}%`],
    ['Thực tế / trẻ', money(evaluation.cost)],
    ['Chênh lệch', difference == null ? '—' : `${difference > 0 ? '+' : ''}${formatMoney(difference)}`],
  ];
  return (
    <dl className="td-bal__money">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-sm muted">{label}</dt>
          <dd>
            <b>{value}</b>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Thống kê thành phần dinh dưỡng và tỷ lệ calo từng bữa của một nhóm tuổi. */
export function BalanceNutrition({ evaluation }) {
  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">Thống kê thành phần dinh dưỡng</h2>
      </div>
      <DataTable columns={NUTRITION_COLUMNS} rows={nutritionTableOf(evaluation)} rowKey="key" empty={{ title: 'Chưa có số liệu' }} />
      <DataTable columns={SESSION_COLUMNS} rows={evaluation?.sessions || []} rowKey="session" empty={{ title: 'Chưa có số liệu' }} />
    </section>
  );
}
