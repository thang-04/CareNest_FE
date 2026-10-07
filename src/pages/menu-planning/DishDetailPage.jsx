import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDish, useMenuAccess, useMenuCatalog } from '@/hooks/menu-planning/useMenuPlanning';
import { deleteDish } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { AllergenChips, HistoryCard, RecordStatusBadge } from '@/components/menu-planning/MenuBadges';
import { DishPortionTable } from '@/components/menu-planning/DishPortionTable';
import { dishAllergens } from '@/utils/menu-planning/menuCalculations';
import { dishCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { DISH_TYPE_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

/** Screen #74 – one dish with its recipe and nutrition. */
export default function DishDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { canManage } = useMenuAccess();
  const { catalog, loading: catLoading } = useMenuCatalog();
  const { item: d, loading, error, reload } = useDish(id);
  const [confirm, setConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (loading || catLoading) return <LoadingState />;
  if (error || !d)
    return (
      <div className="page">
        <Breadcrumb items={dishCrumbs('Chi tiết món ăn')} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  const remove = async () => {
    try {
      await deleteDish(id, user);
      toast.success('Đã xóa bản ghi.');
      navigate('/menu/dishes');
    } catch (err) {
      setConfirm(false);
      setDeleteError(err.message);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={dishCrumbs(d.name)} />
      <div className="page__head">
        <div className="row" style={{ gap: 12 }}>
          <h1 className="page__title">{d.name}</h1>
          <RecordStatusBadge status={d.status} size="lg" />
        </div>
        {canManage && (
          <div className="row row--wrap td-actions">
            <button className="btn btn--outline-danger" onClick={() => setConfirm(true)}>
              <Trash2 size={16} /> Xóa
            </button>
            <Link className="btn btn--primary" to={`/menu/dishes/${id}/edit`}>
              <Pencil size={16} /> Sửa món ăn
            </Link>
          </div>
        )}
      </div>
      {deleteError && (
        <div className="alert alert--danger mb-16">
          <AlertTriangle size={18} />
          <div>{deleteError}</div>
        </div>
      )}
      <div className="td-split">
        <div className="card">
          <div className="card__header">
            <div className="card__title">Thông tin món</div>
          </div>
          <div className="card__body">
            <dl className="info-list">
              <dt>Mã:</dt>
              <dd className="fw-600">{d.code}</dd>
              <dt>Loại món:</dt>
              <dd>{DISH_TYPE_LABELS[d.type]}</dd>
              <dt>Mô tả:</dt>
              <dd>{d.description || '—'}</dd>
              <dt>Chứa:</dt>
              <dd>
                <AllergenChips allergens={dishAllergens(d, catalog.foodById)} empty="Không có chất gây dị ứng đã khai báo" />
              </dd>
              <dt>Dùng trong:</dt>
              <dd>
                {d.usedInMenus.length === 0 ? (
                  <span className="muted">Chưa có thực đơn mẫu nào</span>
                ) : (
                  <span className="td-chips">
                    {d.usedInMenus.map((m) => (
                      <Link key={m.id} to={`/menu/menus/${m.id}`} className="chip chip--blue">
                        {m.name}
                      </Link>
                    ))}
                  </span>
                )}
              </dd>
            </dl>
          </div>
        </div>
        <div className="card">
          <div className="card__header">
            <div className="card__title">Công thức (một khẩu phần chuẩn)</div>
          </div>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Thực phẩm</th>
                  <th className="right">Định lượng</th>
                  <th>Chứa</th>
                </tr>
              </thead>
              <tbody>
                {d.ingredients.map((r) => {
                  const f = catalog.foodById[r.foodId];
                  return (
                    <tr key={r.foodId}>
                      <td>{f ? <Link to={`/menu/foods/${f.id}`}>{f.name}</Link> : 'Thực phẩm đã xóa'}</td>
                      <td className="right nowrap">
                        {r.quantity.toLocaleString('vi-VN')} {f?.unit || 'g'}
                      </td>
                      <td>
                        <AllergenChips allergens={f?.allergens} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="card mt-16">
        <div className="card__header">
          <div className="card__title">Dinh dưỡng và chi phí theo nhóm tuổi</div>
        </div>
        <div className="card__body">
          <DishPortionTable dish={d} foodById={catalog.foodById} />
        </div>
      </div>
      <HistoryCard history={d.history} />
      <div className="page-actions">
        <Link className="btn" to="/menu/dishes">
          <ArrowLeft size={16} /> Quay lại danh sách
        </Link>
      </div>
      <ConfirmationModal
        open={confirm}
        danger
        title="Xóa món ăn"
        message={`Xóa món "${d.name}"? Món đã nằm trong thực đơn sẽ không xóa được.`}
        confirmLabel="Xóa món ăn"
        onConfirm={remove}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}
