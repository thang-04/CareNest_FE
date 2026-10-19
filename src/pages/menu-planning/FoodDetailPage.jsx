import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, AlertTriangle } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useFood, useMenuAccess, useMenuCatalog } from '@/hooks/menu-planning/useMenuPlanning';
import { deleteFood } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { AllergenChips, HistoryCard, RecordStatusBadge } from '@/components/menu-planning/MenuBadges';
import { NutrientBars } from '@/components/menu-planning/NutrientBars';
import { hasNutrition, ingredientQty } from '@/utils/menu-planning/menuCalculations';
import { activeAgeGroups } from '@/utils/menu-planning/nutritionSetup';
import { foodCrumbs } from '@/utils/menu-planning/breadcrumbs';
import {
  DISH_TYPE_LABELS,
  FOOD_GROUP_LABELS,
  FOOD_STORAGE_LABELS,
  FOOD_UNIT_LABELS,
  formatMoney,
} from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const n1 = (v) => (Math.round(v * 10) / 10).toLocaleString('vi-VN');

/**
 * Chi tiết thực phẩm (bố cục "bảng món dùng là chính"): dải thông tin ngắn; bảng định lượng của thực phẩm trong từng món
 * theo nhóm tuổi; bên cạnh là dinh dưỡng trong 100 g ăn được và quy đổi, đơn giá.
 */
export default function FoodDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { canManage } = useMenuAccess();
  const { catalog, loading: catLoading } = useMenuCatalog();
  const { item: f, loading, error, reload } = useFood(id);
  const [confirm, setConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (loading || catLoading) return <LoadingState />;
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

  const groups = activeAgeGroups(catalog.nutritionSetups);
  const nut = f.nutrition;
  // Định lượng của thực phẩm này trong từng món (một trẻ), theo công thức món
  const used = f.usedInDishes.map((u) => {
    const dish = catalog.dishById[u.id];
    const ings = (dish?.ingredients || []).filter((i) => i.foodId === f.id);
    return {
      ...u,
      type: DISH_TYPE_LABELS[dish?.type] || '—',
      qty: groups.map((g) => {
        const vals = ings.map((i) => ingredientQty(i, g.id));
        return vals.some((v) => v == null) ? null : vals.reduce((s, v) => s + v, 0);
      }),
    };
  });

  return (
    <div className="page">
      <Breadcrumb items={foodCrumbs(f.name)} />
      <div className="page__head">
        <div className="row td-title-row">
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
      {/* Trái: thông tin chung rồi định lượng trong món; phải: dinh dưỡng rồi lịch sử (cùng bố cục trang chi tiết món) */}
      <div className="td-split-aside">
        <div className="td-aside-stack">
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Thông tin chung</h2>
            </div>
            <div className="card__body td-food-info">
              <dl className="info-list">
                <dt>Mã</dt>
                <dd className="fw-600">{f.code}</dd>
                <dt>Nhóm</dt>
                <dd>{FOOD_GROUP_LABELS[f.group]}</dd>
                <dt>Bảo quản</dt>
                <dd>{FOOD_STORAGE_LABELS[f.storage] || '—'}</dd>
                <dt>Đơn vị định lượng</dt>
                <dd>{FOOD_UNIT_LABELS[f.unit]}</dd>
                <dt>Hay dùng</dt>
                <dd>{f.favorite ? 'Có' : 'Không'}</dd>
              </dl>
              <dl className="info-list">
                <dt>Đơn vị mua (ĐVT)</dt>
                <dd>{f.purchaseUnit}</dd>
                <dt>Quy đổi</dt>
                <dd>
                  {f.purchaseUnitSize.toLocaleString('vi-VN')} {f.unit} / {f.purchaseUnit}
                </dd>
                <dt>Tỷ lệ thải bỏ</dt>
                <dd>{f.wastePct ?? 0}%</dd>
                <dt>Đơn giá</dt>
                <dd className="fw-600">{f.unitPrice == null ? 'Chưa có' : `${formatMoney(f.unitPrice)} / ${f.purchaseUnit}`}</dd>
              </dl>
              <dl className="info-list td-food-info__full">
                <dt>Chất gây dị ứng</dt>
                <dd>
                  <AllergenChips allergens={f.allergens} empty="Không có" />
                </dd>
                <dt>Ghi chú</dt>
                <dd>{f.note || '—'}</dd>
              </dl>
            </div>
          </section>
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Định lượng trong từng món (một trẻ)</h2>
              <span className="text-sm muted">{used.length} món · sửa định lượng ở trang món</span>
            </div>
            {used.length === 0 ? (
              <div className="card__body muted">Chưa có món nào dùng thực phẩm này.</div>
            ) : (
              <div className="table-wrap td-card-table">
                <table className="table table--grid">
                  <thead>
                    <tr>
                      <th>Món ăn</th>
                      <th>Loại</th>
                      {groups.map((g) => (
                        <th key={g.id} className="right">
                          {g.shortName}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {used.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <Link to={`/menu/dishes/${u.id}`}>{u.name}</Link>
                        </td>
                        <td className="text-sm">{u.type}</td>
                        {u.qty.map((q, i) => (
                          <td key={groups[i].id} className="right nowrap">
                            {q == null ? <span className="td-warn">Chưa nhập</span> : `${n1(q)} ${f.unit}`}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
        <div className="td-aside-stack">
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Dinh dưỡng</h2>
            </div>
            <div className="card__body">
              {hasNutrition(f) ? (
                <NutrientBars values={nut} title={`Trong 100 ${f.unit} ăn được`} />
              ) : (
                <span className="td-warn">Chưa đủ số liệu dinh dưỡng.</span>
              )}
            </div>
          </section>
          <HistoryCard history={f.history} />
        </div>
      </div>
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
