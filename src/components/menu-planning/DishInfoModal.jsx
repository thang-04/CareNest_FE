import { Link } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { AllergenChips } from '@/components/menu-planning/MenuBadges';
import { useDish } from '@/hooks/menu-planning/useMenuPlanning';
import { AGE_GROUPS } from '@/models/School';
import { DISH_TYPE_LABELS } from '@/models/menu-planning/menuPlanningConstants';

const num = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 1 }));
const NUTRIENTS = [
  ['kcal', 'Năng lượng (kcal)'],
  ['protein', 'Đạm (g)'],
  ['lipid', 'Béo (g)'],
  ['glucid', 'Bột đường (g)'],
];

/**
 * Xem nhanh một món từ lưới kế hoạch tuần: loại món, chất gây dị ứng, gam/1 trẻ của từng thực phẩm theo nhóm tuổi và
 * dinh dưỡng một suất. Số dinh dưỡng lấy nguyên `nutritionByAgeGroup` BE trả (NUT-24), màn không tự cộng.
 */
export function DishInfoModal({ dishId, fallbackName, onClose }) {
  const { item: dish, loading, error, reload } = useDish(dishId);
  const nutrition = dish?.nutritionByAgeGroup || [];
  // Chỉ hiện nhóm tuổi món có định lượng hoặc có số dinh dưỡng
  const groups = AGE_GROUPS.filter(
    (g) => nutrition.some((n) => n.ageGroupId === g.id) || (dish?.ingredients || []).some((r) => r.portions?.[g.id] != null),
  );
  const nutritionOf = (groupId) => nutrition.find((n) => n.ageGroupId === groupId) || {};

  return (
    <Modal
      open
      size="lg"
      title={dish?.name || fallbackName || 'Thông tin món'}
      onClose={onClose}
      footer={
        <>
          {dish && (
            <Link className="btn" to={`/menu/dishes/${dish.id}`}>
              Mở trang món
            </Link>
          )}
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Đóng
          </button>
        </>
      }
    >
      {loading ? (
        <LoadingState />
      ) : error || !dish ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="td-dish-info">
          <dl className="td-dish-info__meta">
            <div>
              <dt>Loại món</dt>
              <dd>{DISH_TYPE_LABELS[dish.type] || dish.type || '—'}</dd>
            </div>
            <div>
              <dt>Chất gây dị ứng</dt>
              <dd>
                <AllergenChips allergens={dish.allergens} empty="Không có" />
              </dd>
            </div>
          </dl>
          {groups.length === 0 ? (
            <p className="muted">Món chưa có định lượng cho nhóm tuổi nào.</p>
          ) : (
            <div className="table-wrap">
              <table className="table table--grid">
                <thead>
                  <tr>
                    <th scope="col">Thực phẩm (g / 1 trẻ)</th>
                    {groups.map((g) => (
                      <th key={g.id} scope="col" className="num">
                        {g.shortName}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dish.ingredients.map((r) => (
                    <tr key={r.foodId}>
                      <td>{r.foodName || `Thực phẩm #${r.foodId}`}</td>
                      {groups.map((g) => (
                        <td key={g.id} className="num">
                          {num(r.portions?.[g.id])}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {NUTRIENTS.map(([key, label]) => (
                    <tr key={key} className="td-dish-info__total">
                      <th scope="row">{label}</th>
                      {groups.map((g) => (
                        <td key={g.id} className="num">
                          {num(nutritionOf(g.id)[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
