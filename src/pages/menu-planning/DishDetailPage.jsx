import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Bowl, Copy, Pencil, Trash2 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDish, useMenuAccess, useMenuCatalog } from '@/hooks/menu-planning/useMenuPlanning';
import { deleteDish } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { AllergenChips, DishStatusBadge, HistoryCard } from '@/components/menu-planning/MenuBadges';
import { NutrientBars } from '@/components/menu-planning/NutrientBars';
import { dishAllergens, ingredientBreakdown, ingredientQty } from '@/utils/menu-planning/menuCalculations';
import { activeAgeGroups } from '@/utils/menu-planning/nutritionSetup';
import { dishCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { DISH_TYPE_LABELS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const n1 = (v) => (Math.round(v * 10) / 10).toLocaleString('vi-VN');

/**
 * Chi tiết món ăn (bố cục "hồ sơ bên trái cố định"): hồ sơ món + dinh dưỡng một suất bên trái;
 * bảng hàm lượng từng thành phần theo nhóm tuổi đang chọn, dùng trong, lịch sử bên phải.
 */
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
  const [picked, setPicked] = useState('');

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

  const groups = activeAgeGroups(catalog.nutritionSetups);
  const ag = groups.find((g) => g.id === picked) || groups.find((g) => g.id === 'ag-4') || groups[0];
  const { rows, total } = ingredientBreakdown(d, catalog.foodById, ag?.id);
  const noData = rows.some((r) => r.qty != null && r.noNutrition);
  // Thành phần chưa nhập định lượng ở nhóm tuổi đang áp dụng
  const gaps = d.ingredients
    .map((ing) => ({
      name: catalog.foodById[ing.foodId]?.name || 'Thực phẩm đã xóa',
      groups: groups.filter((g) => ingredientQty(ing, g.id) == null).map((g) => g.shortName),
    }))
    .filter((x) => x.groups.length);

  return (
    <div className="page">
      <Breadcrumb items={dishCrumbs(d.name)} />
      {deleteError && (
        <div className="alert alert--danger mb-16">
          <AlertTriangle size={18} />
          <div>{deleteError}</div>
        </div>
      )}
      <div className="td-profile">
        <aside className="card td-profile__side">
          <div className="card__body td-profile__body">
            <span className="td-profile__icon" aria-hidden="true">
              <Bowl size={22} />
            </span>
            <h1 className="td-profile__name">{d.name}</h1>
            <DishStatusBadge status={d.status} />
            <dl className="info-list">
              <dt>Mã</dt>
              <dd className="fw-600">{d.code}</dd>
              <dt>Loại</dt>
              <dd>{DISH_TYPE_LABELS[d.type]}</dd>
              <dt>Chứa</dt>
              <dd>
                <AllergenChips allergens={dishAllergens(d, catalog.foodById)} empty="Không có chất gây dị ứng" />
              </dd>
            </dl>
            {d.description && <p className="text-sm muted td-flat">{d.description}</p>}
            {ag && (
              <>
                <NutrientBars values={total} title={`Một suất ${ag.shortName}`} missing={noData} />
                <div className="td-profile__cost">
                  <span className="muted">Chi phí một suất</span>
                  <b>{formatMoney(total.cost)}</b>
                </div>
              </>
            )}
            {canManage && (
              <div className="td-profile__acts">
                <Link className="btn btn--primary" to={`/menu/dishes/${id}/edit`}>
                  <Pencil size={16} /> Sửa món ăn
                </Link>
                <Link className="btn" to={`/menu/dishes/new?from=${id}`}>
                  <Copy size={16} /> Nhân bản
                </Link>
                <button type="button" className="btn btn--outline-danger" onClick={() => setConfirm(true)}>
                  <Trash2 size={16} /> Xóa
                </button>
              </div>
            )}
          </div>
        </aside>

        <div className="td-stack">
          {gaps.length > 0 && (
            <div className="alert alert--warning">
              <AlertTriangle size={18} />
              <div>
                {gaps.map((g) => `${g.name} chưa nhập định lượng cho ${g.groups.join(', ')}`).join('; ')}. Thực đơn của nhóm đó dùng món này
                sẽ tính thiếu.
              </div>
            </div>
          )}
          <section className="card">
            <div className="card__header td-wrap-head">
              <h2 className="card__title">Hàm lượng từng thành phần</h2>
              <div className="tabs tabs--pill" role="tablist" aria-label="Nhóm tuổi">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    role="tab"
                    aria-selected={g.id === ag?.id}
                    className={`tab ${g.id === ag?.id ? 'tab--active' : ''}`}
                    onClick={() => setPicked(g.id)}
                  >
                    {g.shortName}
                  </button>
                ))}
              </div>
            </div>
            <div className="table-wrap td-card-table">
              <table className="table table--grid td-hl">
                <thead>
                  <tr>
                    <th>Thành phần</th>
                    <th>ĐVT</th>
                    <th className="money">Đơn giá</th>
                    <th className="num">Thải bỏ</th>
                    <th className="num">Lượng ăn 1 trẻ</th>
                    <th className="num">kcal</th>
                    <th className="num">Đạm (g)</th>
                    <th className="num">Béo (g)</th>
                    <th className="num">Tinh bột (g)</th>
                    <th className="money">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="td-hl__total">
                    <td>Tổng</td>
                    <td colSpan={3} />
                    <td className="num nowrap">{n1(total.qty)}</td>
                    <td className="num">{n1(total.kcal)}</td>
                    <td className="num">{n1(total.protein)}</td>
                    <td className="num">{n1(total.lipid)}</td>
                    <td className="num">{n1(total.glucid)}</td>
                    <td className="money nowrap">{formatMoney(total.cost)}</td>
                  </tr>
                  {rows.map((r) => (
                    <tr key={r.foodId}>
                      <td>
                        {r.food ? <Link to={`/menu/foods/${r.food.id}`}>{r.food.name}</Link> : 'Thực phẩm đã xóa'}{' '}
                        <AllergenChips allergens={r.food?.allergens} empty="" />
                      </td>
                      <td className="text-sm">{r.food?.purchaseUnit || '—'}</td>
                      <td className="money nowrap">{r.food?.unitPrice == null ? '—' : formatMoney(r.food.unitPrice)}</td>
                      <td className="num">{r.food ? `${r.food.wastePct ?? 0}%` : '—'}</td>
                      {r.qty == null ? (
                        <>
                          <td className="num">
                            <span className="td-warn">Chưa nhập</span>
                          </td>
                          <td colSpan={5} className="muted text-sm">
                            Chưa tính được
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="num nowrap">
                            {n1(r.qty)} {r.food?.unit || 'g'}
                          </td>
                          {r.noNutrition ? (
                            <td colSpan={4} className="td-warn text-sm">
                              Chưa có số liệu dinh dưỡng
                            </td>
                          ) : (
                            <>
                              <td className="num">{n1(r.kcal)}</td>
                              <td className="num">{n1(r.protein)}</td>
                              <td className="num">{n1(r.lipid)}</td>
                              <td className="num">{n1(r.glucid)}</td>
                            </>
                          )}
                          <td className="money nowrap">{formatMoney(Math.round(r.cost))}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Dùng trong thực đơn mẫu</h2>
              <span className="chip chip--gray">{d.usedInMenus.length}</span>
            </div>
            <div className="card__body">
              {d.usedInMenus.length === 0 ? (
                <span className="muted">Chưa có thực đơn mẫu nào.</span>
              ) : (
                <span className="td-chips">
                  {d.usedInMenus.map((m) => (
                    <Link key={m.id} to={`/menu/menus/${m.id}`} className="chip chip--blue">
                      {m.name}
                    </Link>
                  ))}
                </span>
              )}
            </div>
          </section>
          <HistoryCard history={d.history} />
        </div>
      </div>
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
