import { useState } from 'react';
import { Button, DataTable, SelectField, StatusBadge } from '@/components';
import { Plus, Trash2 } from '@/components/ui/icons';
import { AddDishesModal } from '@/components/menu-planning/AddDishesModal';
import { MEAL_SESSION_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { ROUNDING_STEPS, verdictOf } from '@/utils/menu-planning/dayBalance';

const VERDICTS = [
  { key: 'quantityStatus', label: 'Lượng', note: 'Calo cả ngày trong khoảng định mức' },
  { key: 'qualityStatus', label: 'Chất', note: 'Tỷ lệ đạm, béo, đường trong khoảng cho phép' },
  { key: 'moneyStatus', label: 'Tiền', note: 'Chi phí 1 trẻ nằm trong biên ngân sách', kind: 'money' },
];

/**
 * Hai bảng phía trên chi tiết: "Món trong ngày" theo bữa (đổi món ghi vào kế hoạch tuần nháp) và "Kết quả cân đối" của
 * nhóm tuổi đang xem kèm nút làm tròn, dựng lại từ công thức. `onChangeDishes` / `onRound` / `onReset` không truyền ⇒ ẩn
 * thao tác tương ứng.
 */
export function BalanceSidebar({ meals, dishes, evaluation, busy, locked, tabs, onChangeDishes, onRound, onReset }) {
  const [adding, setAdding] = useState(null);
  const [step, setStep] = useState(ROUNDING_STEPS[0]);
  const current = meals.find((m) => m.session === adding);

  // Mỗi món một dòng, gom theo bữa; bữa chưa có món vẫn có một dòng báo trống để còn nút Chọn món ở tiêu đề nhóm
  const dishRows = meals.flatMap((m) =>
    m.items.length === 0
      ? [{ id: `${m.session}-empty`, session: m.session, empty: true }]
      : m.items.map((item) => ({ id: `${m.session}-${item.dishId}`, session: m.session, ...item })),
  );
  let order = 0;
  const numbered = dishRows.map((r) => ({ ...r, no: r.empty ? null : ++order }));
  const mealColumns = [
    { key: 'no', header: 'STT', className: 'center td-bal__stt', render: (r) => r.no ?? '' },
    {
      key: 'dishName',
      header: 'Tên món',
      render: (r) => (r.empty ? <span className="muted">Chưa có món</span> : <b>{r.dishName || 'Món đã xóa'}</b>),
    },
    ...(onChangeDishes
      ? [
          {
            key: 'actions',
            header: 'Thao tác',
            className: 'center',
            render: (r) =>
              r.empty ? (
                ''
              ) : (
                <Button
                  variant="icon"
                  aria-label={`Bỏ ${r.dishName}`}
                  disabledReason={locked || undefined}
                  onClick={() =>
                    onChangeDishes(
                      r.session,
                      meals.find((m) => m.session === r.session).items.filter((i) => i.dishId !== r.dishId),
                    )
                  }
                >
                  <Trash2 size={16} />
                </Button>
              ),
          },
        ]
      : []),
  ];

  const verdictColumns = [
    { key: 'label', header: 'Tiêu chí', className: 'td-bal__meal-name', render: (r) => <b>{r.label}</b> },
    { key: 'note', header: 'Điều kiện đạt', render: (r) => <span className="muted">{r.note}</span> },
    { key: 'status', header: 'Kết quả', className: 'center', render: (r) => <StatusBadge {...verdictOf(evaluation[r.key], r.kind)} /> },
  ];

  return (
    <aside className="td-bal__side">
      <section className="card">
        <div className="card__header">
          <h2 className="card__title">Món trong ngày</h2>
        </div>
        <DataTable
          columns={mealColumns}
          rows={numbered}
          groupBy={(r) => r.session}
          groupLabel={(session, items) => (
            <span className="td-bal__group">
              <span>
                {MEAL_SESSION_LABELS[session] || session} <span className="muted">· {items.filter((r) => !r.empty).length} món</span>
              </span>
              {onChangeDishes && (
                <Button
                  size="sm"
                  icon={Plus}
                  aria-label={`Chọn món ${MEAL_SESSION_LABELS[session]}`}
                  disabledReason={locked || undefined}
                  onClick={() => setAdding(session)}
                >
                  Chọn món
                </Button>
              )}
            </span>
          )}
          empty={{ title: 'Chưa có bữa nào' }}
        />
      </section>
      {tabs}
      {evaluation && (
        <section className="card">
          <div className="card__header td-bal__verdict-head">
            <h2 className="card__title">Kết quả cân đối</h2>
            {onRound && (
              <div className="td-bal__actions">
                <label className="td-bal__step text-sm">
                  Bước làm tròn kg / lít
                  <SelectField className="select" value={String(step)} onChange={(e) => setStep(Number(e.target.value))}>
                    {ROUNDING_STEPS.map((value) => (
                      <option key={value} value={String(value)}>
                        {value.toLocaleString('vi-VN')}
                      </option>
                    ))}
                  </SelectField>
                </label>
                <Button variant="primary" disabled={busy} onClick={() => onRound(step)}>
                  Làm tròn số
                </Button>
                {onReset && (
                  <Button disabled={busy} onClick={onReset}>
                    Về công thức món
                  </Button>
                )}
              </div>
            )}
          </div>
          <DataTable columns={verdictColumns} rows={VERDICTS} rowKey="key" empty={{ title: 'Chưa có kết quả' }} />
        </section>
      )}
      {current && (
        <AddDishesModal
          title="Chọn món"
          subtitle={MEAL_SESSION_LABELS[current.session]}
          dishes={dishes}
          selectedIds={current.items.map((i) => i.dishId)}
          hideKcal
          onSave={(picked) => {
            setAdding(null);
            onChangeDishes(
              current.session,
              picked.map((d) => ({ dishId: String(d.id), dishName: d.name || '', dishType: d.type || '' })),
            );
          }}
          onClose={() => setAdding(null)}
        />
      )}
    </aside>
  );
}
