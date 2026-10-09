import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Wallet } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMealPrices, useMenuAccess } from '@/hooks/menu-planning/useMenuPlanning';
import { deleteMealPrice } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { priceOn } from '@/utils/menu-planning/menuCalculations';
import { priceCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { formatDate, todayInput } from '@/utils/format';
import { AGE_GROUPS, ageGroupById } from '@/models/School';
import { formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';
import { StatCardIcon } from '@/components/ui/StatCardIcon';

const stateOf = (p, today) =>
  p.effectiveFrom > today
    ? ['blue', 'Sắp áp dụng']
    : p.effectiveTo && p.effectiveTo < today
      ? ['gray', 'Hết hiệu lực']
      : ['green', 'Đang áp dụng'];

/** Screen #75 – price of one meal by age group (UC 6.3). */
export default function MealPriceListPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { canManage } = useMenuAccess();
  const [ageGroupId, setAgeGroupId] = useState('');
  const { items, loading, error, reload } = useMealPrices({});
  const [toDelete, setToDelete] = useState(null);
  const today = todayInput();
  const rows = items
    .filter((p) => !ageGroupId || p.ageGroupId === ageGroupId)
    .sort((a, b) => (a.ageGroupId === b.ageGroupId ? (a.effectiveFrom < b.effectiveFrom ? 1 : -1) : a.ageGroupId < b.ageGroupId ? -1 : 1));

  const remove = async () => {
    try {
      await deleteMealPrice(toDelete.id, user);
      toast.success('Đã xóa bản ghi.');
    } catch (err) {
      toast.error(err.message, 'Không xóa được');
    } finally {
      setToDelete(null);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={priceCrumbs()} />
      <div className="page__head">
        <h1 className="page__title">Giá suất ăn</h1>
        {canManage && (
          <Link to="/menu/prices/new" className="btn btn--primary btn--lg">
            <Plus size={18} /> Thêm mức giá
          </Link>
        )}
      </div>
      <div className="stat-grid">
        {AGE_GROUPS.map((g) => {
          const current = priceOn(items, g.id, today);
          return (
            <button
              key={g.id}
              className={`stat-card stat-card--blue ${ageGroupId === g.id ? 'stat-card--active' : ''}`}
              onClick={() => setAgeGroupId(ageGroupId === g.id ? '' : g.id)}
              aria-pressed={ageGroupId === g.id}
            >
              <div className="stat-card__value">{current ? formatMoney(current.price) : '—'}</div>
              <div className="stat-card__label">{g.shortName} – giá hiện hành</div>
              <StatCardIcon tone="blue" />
            </button>
          );
        })}
      </div>
      <div className="card">
        <div className="filter-bar">
          <select className="select" value={ageGroupId} onChange={(e) => setAgeGroupId(e.target.value)} aria-label="Nhóm tuổi">
            <option value="">Tất cả nhóm tuổi</option>
            {AGE_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderTop: '1px solid var(--border)', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Nhóm tuổi</th>
                  <th className="right">Giá một suất / trẻ / ngày</th>
                  <th>Thời gian áp dụng</th>
                  <th>Tình trạng</th>
                  <th>Ghi chú</th>
                  {canManage && <th className="center">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={4} cols={canManage ? 6 : 5} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={Wallet}
                        title="Chưa có giá suất ăn"
                        description="Khai báo giá một suất ăn cho từng nhóm tuổi và thời gian áp dụng."
                        action={
                          canManage && (
                            <Link className="btn btn--primary" to="/menu/prices/new">
                              <Plus size={16} /> Thêm mức giá
                            </Link>
                          )
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  rows.map((p) => {
                    const [tone, label] = stateOf(p, today);
                    return (
                      <tr key={p.id}>
                        <td>{ageGroupById(p.ageGroupId)?.name}</td>
                        <td className="right fw-600 nowrap">{formatMoney(p.price)}</td>
                        <td className="nowrap">
                          {formatDate(p.effectiveFrom)} – {p.effectiveTo ? formatDate(p.effectiveTo) : 'nay'}
                        </td>
                        <td>
                          <span className={`chip chip--${tone}`}>{label}</span>
                        </td>
                        <td className="text-sm">{p.note || '—'}</td>
                        {canManage && (
                          <td className="center nowrap">
                            <Link className="icon-btn" to={`/menu/prices/${p.id}/edit`} title="Sửa" aria-label="Sửa mức giá">
                              <Pencil size={17} />
                            </Link>
                            {p.effectiveFrom > today && (
                              <button className="icon-btn" title="Xóa" aria-label="Xóa mức giá" onClick={() => setToDelete(p)}>
                                <Trash2 size={17} />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs muted mt-8">Giá suất ăn dùng để kiểm tra chi phí thực đơn ngày và ngân sách thực đơn tuần.</p>
      <ConfirmationModal
        open={!!toDelete}
        danger
        title="Xóa mức giá"
        message="Xóa mức giá chưa áp dụng này?"
        confirmLabel="Xóa mức giá"
        onConfirm={remove}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
