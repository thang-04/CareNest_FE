import { useState } from 'react';
import { Pencil, Plus, Trash2 } from '@/components/ui/icons';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/contexts/ToastContext';
import { useActiveSuppliers, useFoodPrices } from '@/hooks/menu-planning/useMenuPlanning';
import { deleteFoodPrice } from '@/services/menu-planning/menuPlanningService';
import { FoodPriceModal } from '@/components/menu-planning/FoodPriceModal';
import { formatDate, formatMoney } from '@/utils/format';

/** Lịch sử giá theo ngày hiệu lực (mới trước). Mức đã có hiệu lực khóa; mức tương lai sửa/xóa được (BE trả `editable`). */
export function FoodPriceHistory({ food, canManage, onChanged }) {
  const toast = useToast();
  const { item: rows, loading, error, reload } = useFoodPrices(food.id);
  const { items: suppliers } = useActiveSuppliers();
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);

  const done = () => {
    setEditing(null);
    reload({ silent: true });
    onChanged?.();
  };
  const remove = async () => {
    try {
      await deleteFoodPrice(food.id, removing.id);
      toast.success('Đã xóa mức giá.');
      setRemoving(null);
      done();
    } catch (err) {
      toast.error(err, 'Không xóa được mức giá');
    }
  };

  const columns = [
    { key: 'effectiveFrom', header: 'Hiệu lực từ', render: (r) => formatDate(r.effectiveFrom) },
    { key: 'price', header: 'Giá', className: 'num', render: (r) => `${formatMoney(r.price)} / ${food.purchaseUnit}` },
    { key: 'supplierName', header: 'Nhà cung cấp', render: (r) => r.supplierName || <span className="muted">Chưa gán</span> },
    { key: 'reason', header: 'Lý do', render: (r) => r.reason || '—' },
    {
      key: 'state',
      header: '',
      render: (r) =>
        r.editable ? <StatusBadge tone="blue" label="Sắp áp dụng" size="sm" /> : <StatusBadge tone="gray" label="Đã áp dụng" size="sm" />,
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            className: 'cell--actions',
            render: (r) =>
              r.editable && (
                <span className="td-chips">
                  <Button variant="icon" icon={Pencil} aria-label="Sửa mức giá" onClick={() => setEditing(r)} />
                  <Button variant="icon" icon={Trash2} aria-label="Xóa mức giá" onClick={() => setRemoving(r)} />
                </span>
              ),
          },
        ]
      : []),
  ];

  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">Lịch sử giá và nhà cung cấp</h2>
        {canManage && (
          <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
            Điều chỉnh giá
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={rows || []}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={reload}
        empty={{ title: 'Chưa có mức giá' }}
      />
      {editing && (
        <FoodPriceModal
          food={food}
          row={editing === 'new' ? null : editing}
          suppliers={suppliers}
          onSaved={done}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmationModal
        open={!!removing}
        danger
        title="Xóa mức giá"
        message={removing ? `Xóa mức giá áp dụng từ ${formatDate(removing.effectiveFrom)}?` : ''}
        confirmLabel="Xóa"
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
    </section>
  );
}
