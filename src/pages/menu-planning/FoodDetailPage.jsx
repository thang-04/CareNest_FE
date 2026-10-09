import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, AlertTriangle } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useFood, useMenuAccess } from '@/hooks/menu-planning/useMenuPlanning';
import { deleteFood } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { AllergenChips, HistoryCard, RecordStatusBadge } from '@/components/menu-planning/MenuBadges';
import { hasNutrition } from '@/utils/menu-planning/menuCalculations';
import { foodCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { FOOD_GROUP_LABELS, FOOD_UNIT_LABELS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const n = (v, unit) => (typeof v === 'number' ? `${v.toLocaleString('vi-VN')} ${unit}` : 'Chưa có số liệu');

/** Screen #71 – one food item. */
export default function FoodDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { canManage } = useMenuAccess();
  const { item: f, loading, error, reload } = useFood(id);
  const [confirm, setConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (loading) return <LoadingState />;
  if (error || !f)
    return (
      <div className="page">
        <Breadcrumb items={foodCrumbs('Chi tiết thực phẩm')} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  const remove = async () => {
    try {
      await deleteFood(id, user);
      toast.success('Đã xóa bản ghi.');
      navigate('/menu/foods');
    } catch (err) {
      setConfirm(false);
      setDeleteError(err.message);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={foodCrumbs(f.name)} />
      <div className="page__head">
        <div className="row" style={{ gap: 12 }}>
          <h1 className="page__title">{f.name}</h1>
          <RecordStatusBadge status={f.status} size="lg" />
        </div>
        {canManage && (
          <div className="row row--wrap td-actions">
            <button className="btn btn--outline-danger" onClick={() => setConfirm(true)}>
              <Trash2 size={16} /> Xóa
            </button>
            <Link className="btn btn--primary" to={`/menu/foods/${id}/edit`}>
              <Pencil size={16} /> Sửa thực phẩm
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
      {!hasNutrition(f) && (
        <div className="alert alert--warning mb-16">
          <AlertTriangle size={18} />
          <div>Thực phẩm chưa đủ số liệu dinh dưỡng; các món và thực đơn dùng thực phẩm này sẽ được báo là tính toán chưa đầy đủ.</div>
        </div>
      )}
      <div className="td-split">
        <div className="card">
          <div className="card__header">
            <div className="card__title">Thông tin chung</div>
          </div>
          <div className="card__body">
            <dl className="info-list">
              <dt>Mã:</dt>
              <dd className="fw-600">{f.code}</dd>
              <dt>Nhóm:</dt>
              <dd>{FOOD_GROUP_LABELS[f.group]}</dd>
              <dt>Đơn vị định lượng:</dt>
              <dd>{FOOD_UNIT_LABELS[f.unit]}</dd>
              <dt>Đơn vị mua:</dt>
              <dd>
                {f.purchaseUnit} ({f.purchaseUnitSize.toLocaleString('vi-VN')} {f.unit})
              </dd>
              <dt>Đơn giá:</dt>
              <dd>{f.unitPrice == null ? '—' : `${formatMoney(f.unitPrice)} / ${f.purchaseUnit}`}</dd>
              <dt>Chất gây dị ứng:</dt>
              <dd>
                <AllergenChips allergens={f.allergens} empty="Không có" />
              </dd>
              <dt>Ghi chú:</dt>
              <dd>{f.note || '—'}</dd>
            </dl>
          </div>
        </div>
        <div className="card">
          <div className="card__header">
            <div className="card__title">Dinh dưỡng trên 100 {f.unit}</div>
          </div>
          <div className="card__body">
            <dl className="info-list">
              <dt>Năng lượng:</dt>
              <dd>{n(f.nutrition.kcal, 'kcal')}</dd>
              <dt>Chất đạm:</dt>
              <dd>{n(f.nutrition.protein, 'g')}</dd>
              <dt>Chất béo:</dt>
              <dd>{n(f.nutrition.lipid, 'g')}</dd>
              <dt>Tinh bột:</dt>
              <dd>{n(f.nutrition.glucid, 'g')}</dd>
            </dl>
          </div>
        </div>
      </div>
      <div className="card mt-16">
        <div className="card__header">
          <div className="card__title">Món ăn dùng thực phẩm này ({f.usedInDishes.length})</div>
        </div>
        <div className="card__body">
          {f.usedInDishes.length === 0 ? (
            <span className="muted">Chưa có món nào.</span>
          ) : (
            <div className="td-chips">
              {f.usedInDishes.map((d) => (
                <Link key={d.id} to={`/menu/dishes/${d.id}`} className="chip chip--blue">
                  {d.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      <HistoryCard history={f.history} />
      <div className="page-actions">
        <Link className="btn" to="/menu/foods">
          <ArrowLeft size={16} /> Quay lại danh sách
        </Link>
      </div>
      <ConfirmationModal
        open={confirm}
        danger
        title="Xóa thực phẩm"
        message={`Xóa thực phẩm "${f.name}"? Thực phẩm đang dùng trong món ăn sẽ không xóa được.`}
        confirmLabel="Xóa thực phẩm"
        onConfirm={remove}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}
