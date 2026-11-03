import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Copy, Pencil, Trash2 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDish, useCatalogAccess, useCatalogLookups } from '@/hooks/menu-planning/useMenuPlanning';
import { deleteDish } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Tabs } from '@/components/ui/Tabs';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { AllergenChips, DishStatusBadge, HistoryCard } from '@/components/menu-planning/MenuBadges';
import { DishPortionTable } from '@/components/menu-planning/DishPortionTable';
import { dishAllergens, ingredientBreakdown, ingredientQty } from '@/utils/menu-planning/menuCalculations';
import { activeAgeGroups } from '@/utils/menu-planning/nutritionSetup';
import { dishCrumbs } from '@/utils/menu-planning/breadcrumbs';
import {
  DISH_TYPE_LABELS,
  FOOD_ORIGIN_LABELS,
  MICRONUTRIENT_GROUPS,
  MICRONUTRIENT_LABELS,
  MICRONUTRIENT_UNITS,
  formatMoney,
} from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const n1 = (v) => (typeof v === 'number' ? (Math.round(v * 10) / 10).toLocaleString('vi-VN') : '—');
const n2 = (v) => (typeof v === 'number' ? v.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : '—');

const PORTION_VIEWS = [
  { key: 'energy', label: 'Năng lượng và P : L : G' },
  { key: 'micro', label: 'Khoáng chất và vitamin' },
];
// Bảng thành phần tách theo nhóm cột để không tràn ngang: định lượng & chi phí, năng lượng, khoáng chất, vitamin
const INGREDIENT_VIEWS = [
  { key: 'portion', label: 'Định lượng và chi phí' },
  { key: 'energy', label: 'Năng lượng' },
  ...MICRONUTRIENT_GROUPS.map((g) => ({ key: g.key, label: g.label, items: g.items })),
];
const ENERGY_COLS = [
  ['animalProtein', 'Đạm ĐV (g)'],
  ['plantProtein', 'Đạm TV (g)'],
  ['animalLipid', 'Béo ĐV (g)'],
  ['plantLipid', 'Béo TV (g)'],
  ['glucid', 'Tinh bột (g)'],
  ['kcal', 'Năng lượng (kcal)'],
];

/**
 * Chi tiết món ăn: thông tin chung; dinh dưỡng một suất theo nhóm tuổi (năng lượng, P : L : G so chuẩn — tham khảo; khoáng chất,
 * vitamin); hàm lượng từng thành phần theo nhóm tuổi đang chọn, chia nhóm cột; dùng trong thực đơn mẫu, lịch sử.
 */
export default function DishDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { canManage, softDelete } = useCatalogAccess();
  const { catalog, loading: catLoading } = useCatalogLookups();
  const { item: d, loading, error, reload } = useDish(id);
  const [confirm, setConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [picked, setPicked] = useState('');
  const [portionView, setPortionView] = useState('energy');
  const [ingredientView, setIngredientView] = useState('portion');

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
      toast.success(softDelete ? 'Đã chuyển sang Ngừng sử dụng.' : 'Đã xóa bản ghi.');
      navigate('/menu/dishes');
    } catch (err) {
      setConfirm(false);
      setDeleteError(err.message);
    }
  };

  const groups = activeAgeGroups(catalog.nutritionSetups);
  const ag = groups.find((g) => g.id === picked) || groups.find((g) => g.id === 'ag-4') || groups[0];
  const { rows, total } = ingredientBreakdown(d, catalog.foodById, ag?.id);
  // Thiếu số liệu dinh dưỡng hoặc nguồn gốc ⇒ món chưa đủ dữ liệu cân đối
  const noData = rows.some((r) => r.qty != null && (r.noNutrition || r.noOrigin));
  // Thành phần chưa nhập định lượng ở nhóm tuổi đang áp dụng
  const gaps = d.ingredients
    .map((ing) => ({
      name: catalog.foodById[ing.foodId]?.name || 'Thực phẩm đã xóa',
      groups: groups.filter((g) => ingredientQty(ing, g.id) == null).map((g) => g.shortName),
    }))
    .filter((x) => x.groups.length);
  const view = INGREDIENT_VIEWS.find((v) => v.key === ingredientView);
  const microCols = view.items || [];
  // Số cột sau "Thành phần" của từng nhóm cột (để ô "chưa nhập định lượng" trải hết hàng)
  const restCols = view.key === 'portion' ? 6 : 1 + (view.key === 'energy' ? ENERGY_COLS.length : microCols.length);

  return (
    <div className="page">
      <Breadcrumb items={dishCrumbs(d.name)} />
      <div className="page__head">
        <div className="row td-title-row">
          <h1 className="page__title">{d.name}</h1>
          <DishStatusBadge status={d.status} />
        </div>
        {canManage && (
          <div className="row row--wrap td-actions">
            {!(softDelete && d.status === 'INACTIVE') && (
              <button type="button" className="btn btn--outline-danger" onClick={() => setConfirm(true)}>
                <Trash2 size={16} /> {softDelete ? 'Ngừng sử dụng' : 'Xóa'}
              </button>
            )}
            <Link className="btn" to={`/menu/dishes/new?from=${id}`}>
              <Copy size={16} /> Nhân bản
            </Link>
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

      <div className="td-stack">
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">Thông tin chung</h2>
          </div>
          <div className="card__body td-food-info">
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
            <dl className="info-list">
              <dt>Mô tả</dt>
              <dd>{d.description || '—'}</dd>
              {ag && (
                <>
                  <dt>Một suất {ag.shortName}</dt>
                  <dd className="fw-600">
                    {n1(total.kcal)} kcal · {formatMoney(total.cost)}
                  </dd>
                </>
              )}
            </dl>
          </div>
        </section>

        <section className="card">
          <div className="card__header td-wrap-head">
            <h2 className="card__title">Dinh dưỡng và chi phí một suất theo nhóm tuổi</h2>
            <Tabs variant="pill" ariaLabel="Nhóm chỉ số" items={PORTION_VIEWS} value={portionView} onChange={setPortionView} />
          </div>
          <DishPortionTable dish={d} foodById={catalog.foodById} groups={groups} norms={catalog.norms} view={portionView} />
        </section>

        {gaps.length > 0 && (
          <div className="alert alert--warning">
            <AlertTriangle size={18} />
            <div>
              {gaps.map((g) => `${g.name} chưa nhập định lượng cho ${g.groups.join(', ')}`).join('; ')}. Thực đơn của nhóm đó dùng món này
              sẽ tính thiếu.
            </div>
          </div>
        )}
        {noData && (
          <div className="alert alert--warning">
            <AlertTriangle size={18} />
            <div>Một số thực phẩm chưa có số liệu dinh dưỡng hoặc nguồn gốc; con số có thể thấp hơn thực tế, chưa đánh giá.</div>
          </div>
        )}

        <section className="card">
          <div className="card__header td-wrap-head">
            <h2 className="card__title">Hàm lượng từng thành phần</h2>
            <Tabs
              variant="pill"
              ariaLabel="Nhóm tuổi"
              items={groups.map((g) => ({ key: g.id, label: g.shortName }))}
              value={ag?.id}
              onChange={setPicked}
            />
          </div>
          <div className="td-card-tabs">
            <Tabs variant="pill" ariaLabel="Nhóm cột" items={INGREDIENT_VIEWS} value={ingredientView} onChange={setIngredientView} />
          </div>
          <div className="table-wrap td-card-table">
            <table className="table table--grid td-hl">
              <thead>
                <tr>
                  <th className="td-sticky-first">Thành phần</th>
                  {view.key === 'portion' ? (
                    <>
                      <th>Đơn vị mua</th>
                      <th className="money">Đơn giá</th>
                      <th className="num">Thải bỏ</th>
                      <th className="num">Lượng ăn 1 trẻ</th>
                      <th className="num">Lượng mua 1 trẻ</th>
                      <th className="money">Thành tiền</th>
                    </>
                  ) : (
                    <>
                      <th className="num">Lượng ăn 1 trẻ</th>
                      {view.key === 'energy'
                        ? ENERGY_COLS.map(([k, label]) => (
                            <th key={k} className="num">
                              {label}
                            </th>
                          ))
                        : microCols.map((k) => (
                            <th key={k} className="num">
                              {MICRONUTRIENT_LABELS[k]} ({MICRONUTRIENT_UNITS[k]})
                            </th>
                          ))}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr className="td-hl__total">
                  <td className="td-sticky-first">Tổng một suất</td>
                  {view.key === 'portion' ? (
                    <>
                      <td colSpan={3} />
                      <td className="num nowrap">{n1(total.qty)}</td>
                      <td />
                      <td className="money nowrap">{formatMoney(total.cost)}</td>
                    </>
                  ) : (
                    <>
                      <td className="num nowrap">{n1(total.qty)}</td>
                      {view.key === 'energy'
                        ? ENERGY_COLS.map(([k]) => (
                            <td key={k} className="num">
                              {n1(total[k])}
                            </td>
                          ))
                        : microCols.map((k) => (
                            <td key={k} className="num">
                              {total[k] == null ? <span className="td-warn">Chưa đủ</span> : n2(total[k])}
                            </td>
                          ))}
                    </>
                  )}
                </tr>
                {rows.map((r) => (
                  <tr key={r.foodId}>
                    <td className="td-sticky-first">
                      {r.food ? <Link to={`/menu/foods/${r.food.id}`}>{r.food.name}</Link> : 'Thực phẩm đã xóa'}{' '}
                      <AllergenChips allergens={r.food?.allergens} empty="" />
                      {r.food && (
                        <div className="text-xs muted">
                          {r.noOrigin ? <span className="td-warn">Chưa có nguồn gốc</span> : FOOD_ORIGIN_LABELS[r.food.origin]}
                        </div>
                      )}
                    </td>
                    {view.key === 'portion' ? (
                      <>
                        <td className="text-sm">{r.food?.purchaseUnit || '—'}</td>
                        <td className="money nowrap">{r.food?.unitPrice == null ? '—' : formatMoney(r.food.unitPrice)}</td>
                        <td className="num">{r.food ? `${r.food.wastePct ?? 0}%` : '—'}</td>
                        <td className="num nowrap">
                          {r.qty == null ? <span className="td-warn">Chưa nhập</span> : `${n1(r.qty)} ${r.food?.unit || 'g'}`}
                        </td>
                        <td className="num nowrap">{r.qty == null ? '—' : `${n1(r.purchaseQty)} ${r.food?.unit || 'g'}`}</td>
                        <td className="money nowrap">{r.qty == null ? '—' : formatMoney(Math.round(r.cost))}</td>
                      </>
                    ) : r.qty == null ? (
                      <td colSpan={restCols} className="muted text-sm">
                        <span className="td-warn">Chưa nhập định lượng</span> · chưa tính được
                      </td>
                    ) : (
                      <>
                        <td className="num nowrap">
                          {n1(r.qty)} {r.food?.unit || 'g'}
                        </td>
                        {view.key === 'energy' ? (
                          r.noNutrition ? (
                            <td colSpan={ENERGY_COLS.length} className="td-warn text-sm">
                              Chưa có số liệu dinh dưỡng
                            </td>
                          ) : (
                            ENERGY_COLS.map(([k]) => (
                              <td key={k} className="num">
                                {r.noOrigin && k.startsWith('animal') ? (
                                  <span className="td-warn text-xs">chưa rõ nguồn gốc</span>
                                ) : (
                                  n1(r[k])
                                )}
                              </td>
                            ))
                          )
                        ) : (
                          microCols.map((k) => (
                            <td key={k} className="num">
                              {r[k] == null ? <span className="muted">Chưa có</span> : n2(r[k])}
                            </td>
                          ))
                        )}
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="td-split-aside">
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
        title={softDelete ? 'Ngừng sử dụng món ăn' : 'Xóa món ăn'}
        message={
          softDelete
            ? `Chuyển món "${d.name}" sang Ngừng sử dụng? Thực đơn đã có giữ nguyên; thực đơn mới không chọn được món này.`
            : `Xóa món "${d.name}"? Món đã nằm trong thực đơn sẽ không xóa được.`
        }
        confirmLabel={softDelete ? 'Ngừng sử dụng' : 'Xóa món ăn'}
        onConfirm={remove}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}
