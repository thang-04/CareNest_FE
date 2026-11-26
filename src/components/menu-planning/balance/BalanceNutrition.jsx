import { useState } from 'react';
import { DataTable, StatusBadge } from '@/components';
import { Tabs } from '@/components/ui/Tabs';
import { NormStatusChip } from '@/components/menu-planning/MenuBadges';
import { StatisticsNutrition } from '@/components/menu-planning/MenuStatistics';
import { MEAL_SESSION_LABELS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import { formatAmount, verdictOf } from '@/utils/menu-planning/dayBalance';

const TABS = [
  { key: 'origin', label: 'Động vật – thực vật' },
  { key: 'meal', label: 'Theo bữa' },
];

const SESSION_COLUMNS = [
  { key: 'session', header: 'Bữa ăn', render: (r) => MEAL_SESSION_LABELS[r.session] || r.session },
  { key: 'kcal', header: 'Calo (kcal)', className: 'num', render: (r) => formatAmount(r.kcal, 1) },
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
    className: 'center',
    render: (r) => (r.status === 'NA' ? '—' : <StatusBadge {...verdictOf(r.status)} />),
  },
];

/**
 * Thẻ "Thông tin dinh dưỡng 1 trẻ / ngày" của bản cân đối, cùng bố cục thẻ ở chi tiết thực đơn mẫu: tab cách xem, bảng,
 * chú giải màu và dòng cân đối tiền ăn. Mọi số do BE tính (evaluation của nhóm tuổi).
 */
export function BalanceNutrition({ evaluation }) {
  const [tab, setTab] = useState('origin');
  if (!evaluation) return null;
  const money = (v) => (v == null ? '—' : formatMoney(Number(v)));
  const budget = evaluation.foodBudget ?? evaluation.mealPrice ?? null;
  const cost = Number(evaluation.cost || 0);
  const over = budget != null && cost > Number(budget);
  const budgetColumns = [
    { key: 'mealPrice', header: 'Giá suất ăn', className: 'money', render: () => money(evaluation.mealPrice) },
    { key: 'serviceFee', header: 'Phí dịch vụ', className: 'money', render: () => money(evaluation.serviceFee ?? 0) },
    {
      key: 'budget',
      header: 'Ngân sách thực phẩm',
      className: 'money',
      render: () => (
        <>
          <b>{money(budget)}</b> <span className="muted">±{formatAmount(evaluation.budgetTolerancePct)}%</span>
        </>
      ),
    },
    { key: 'cost', header: 'Chi phí khẩu phần', className: 'money', render: () => money(evaluation.cost) },
    {
      key: 'rest',
      header: over ? 'Vượt ngân sách' : 'Còn lại',
      className: `money ${over ? 'td-daynut--high' : ''}`,
      render: () => <b>{money(Math.abs(Number(budget) - cost))}</b>,
    },
  ];
  // StatisticsNutrition đọc dạng của thống kê thực đơn; bản cân đối luôn có định lượng
  const stats = {
    evaluation,
    ingredients: [true],
    costPerChild: evaluation.cost,
    foodBudget: evaluation.foodBudget,
    mealPrice: evaluation.mealPrice,
  };

  return (
    <section className="card td-daynut" aria-label="Thông tin dinh dưỡng 1 trẻ một ngày">
      <div className="card__header td-daynut__head">
        <h2 className="card__title">Thông tin dinh dưỡng 1 trẻ / ngày</h2>
        {evaluation.status && <NormStatusChip status={evaluation.status} />}
        <Tabs variant="pill" ariaLabel="Cách xem" items={TABS} value={tab} onChange={setTab} />
      </div>
      <div className="card__body td-bal__nut">
        {tab === 'origin' ? (
          <StatisticsNutrition stats={stats} />
        ) : (
          <DataTable columns={SESSION_COLUMNS} rows={evaluation.sessions || []} rowKey="session" empty={{ title: 'Chưa có số liệu' }} />
        )}
        <p className="td-daynut__legend text-sm">
          <span>
            <i className="td-eval__dot td-eval__dot--ok" /> Đạt chuẩn
          </span>
          <span>
            <i className="td-eval__dot td-eval__dot--low" /> Thấp so với chuẩn
          </span>
          <span>
            <i className="td-eval__dot td-eval__dot--high" /> Cao so với chuẩn
          </span>
        </p>
        {evaluation.mealPrice != null && (
          <DataTable columns={budgetColumns} rows={[{ id: 'budget' }]} empty={{ title: 'Chưa có số liệu' }} />
        )}
      </div>
    </section>
  );
}
