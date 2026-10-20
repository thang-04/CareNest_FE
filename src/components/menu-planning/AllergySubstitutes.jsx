import { useState } from 'react';
import { AlertTriangle, Pencil, Plus } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAllergyMenus } from '@/hooks/menu-planning/useMenuPlanning';
import { saveAllergyMenu } from '@/services/menu-planning/menuPlanningService';
import { SidePanel } from '@/components/ui/SidePanel';
import { FormField } from '@/components/form/FormField';
import { Spinner } from '@/components/ui/States';
import { dishAllergens, mealsAllergens, sameAllergen } from '@/utils/menu-planning/menuCalculations';
import { mealLabel } from '@/utils/menu-planning/nutritionSetup';
import { ALLERGENS, RECORD_STATUS } from '@/models/menu-planning/menuPlanningConstants';

/** Món cần thay vì chứa chất cần tránh: [{ session, dishId, name, type }]. */
const conflictsOf = (meals, restrictions, catalog) =>
  mealsAllergens(meals, catalog.dishById, catalog.foodById)
    .filter((a) => restrictions.some((r) => sameAllergen(r, a.allergen)))
    .flatMap((a) => a.dishes)
    .filter((d, i, all) => all.findIndex((x) => x.session === d.session && x.dishId === d.dishId) === i)
    .map((d) => ({ ...d, type: catalog.dishById[d.dishId]?.type }));

/**
 * Suất thay thế dị ứng của một thực đơn mẫu (thay cho màn "Thực đơn thay thế"): mỗi bản tránh một số chất,
 * món chứa chất đó được đổi sang món khác cùng loại hoặc bỏ. Số trẻ chỉ là số tổng hợp.
 */
export function AllergySubstitutes({ menu, catalog, allergyRows, canManage }) {
  const { user } = useAuth();
  const toast = useToast();
  const { items, reload } = useAllergyMenus({ baseMenuId: menu?.id || '__none__' });
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const label = (session) => mealLabel(catalog.nutritionSetups, menu?.ageGroupId, session);
  const dishName = (id) => catalog.dishById[id]?.name || 'Món đã xóa';

  const startNew = () => setEditing({ id: null, name: '', restrictions: [], picks: {} });
  const startEdit = (a) =>
    setEditing({
      id: a.id,
      name: a.name,
      restrictions: a.restrictions,
      picks: Object.fromEntries(a.replacements.map((r) => [`${r.session}|${r.originalDishId}`, r.replacementDishId || ''])),
    });
  const conflicts = editing ? conflictsOf(menu.meals, editing.restrictions, catalog) : [];
  const options = (c) =>
    catalog.dishes.filter(
      (d) =>
        d.status === RECORD_STATUS.ACTIVE &&
        d.type === c.type &&
        d.id !== c.dishId &&
        !dishAllergens(d, catalog.foodById).some((a) => editing.restrictions.some((r) => sameAllergen(r, a))),
    );
  const toggleRestriction = (a) =>
    setEditing((e) => ({
      ...e,
      restrictions: e.restrictions.some((r) => sameAllergen(r, a))
        ? e.restrictions.filter((r) => !sameAllergen(r, a))
        : [...e.restrictions, a],
    }));

  const save = async () => {
    setSaving(true);
    try {
      await saveAllergyMenu(
        editing.id,
        {
          name: editing.name.trim() || `Suất thay thế – ${editing.restrictions.join(', ')}`,
          baseMenuId: menu.id,
          ageGroupId: menu.ageGroupId,
          groupType: 'ALLERGY',
          restrictions: editing.restrictions,
          replacements: conflicts.map((c) => {
            const pick = editing.picks[`${c.session}|${c.dishId}`] || '';
            return { session: c.session, originalDishId: c.dishId, replacementDishId: pick || null, portion: 1 };
          }),
          note: '',
          status: RECORD_STATUS.ACTIVE,
        },
        user,
      );
      toast.success('Đã lưu suất thay thế.');
      setEditing(null);
      reload();
    } catch (err) {
      toast.error(err, 'Chưa lưu được');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">
          <AlertTriangle size={18} /> Suất thay thế dị ứng
        </h2>
        {canManage && menu?.id && (
          <button type="button" className="btn btn--sm" onClick={startNew}>
            <Plus size={15} /> Thêm suất thay thế
          </button>
        )}
      </div>
      <div className="card__body">
        {!menu?.id ? (
          <p className="muted text-sm td-flat">Lưu thực đơn trước, sau đó thêm suất thay thế cho trẻ dị ứng.</p>
        ) : items.length ? (
          <ul className="td-subs">
            {items.map((a) => (
              <li key={a.id}>
                <div className="td-grow">
                  <b>{a.name}</b>{' '}
                  {a.restrictions.map((r) => (
                    <span key={r} className="chip chip--red">
                      {r}
                    </span>
                  ))}
                  <div className="text-sm muted">
                    {a.replacements.length
                      ? a.replacements
                          .map(
                            (r) =>
                              `${label(r.session)}: ${dishName(r.originalDishId)} → ${r.replacementDishId ? dishName(r.replacementDishId) : 'bỏ món'}`,
                          )
                          .join(' · ')
                      : 'Không có món cần đổi'}
                  </div>
                </div>
                {canManage && (
                  <button type="button" className="icon-btn" aria-label={`Sửa ${a.name}`} onClick={() => startEdit(a)}>
                    <Pencil size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted text-sm td-flat">
            Chưa có suất thay thế.
            {allergyRows.length > 0 && ` Nhóm này có trẻ dị ứng: ${allergyRows.map((r) => `${r.allergen} (${r.childCount})`).join(', ')}.`}
          </p>
        )}
      </div>

      <SidePanel
        open={!!editing}
        title={editing?.id ? 'Sửa suất thay thế' : 'Thêm suất thay thế'}
        onClose={() => setEditing(null)}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setEditing(null)} disabled={saving}>
              Hủy
            </button>
            <button type="button" className="btn btn--primary" onClick={save} disabled={saving || !conflicts.length}>
              {saving && <Spinner small />} Lưu
            </button>
          </>
        }
      >
        {editing && (
          <div className="td-subs-editor">
            <FormField label="Tên suất thay thế" hint="Để trống thì đặt theo chất cần tránh">
              <input
                className="input"
                maxLength={100}
                value={editing.name}
                onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))}
              />
            </FormField>
            <div className="field">
              <span className="field__label">Chất cần tránh</span>
              <div className="td-allergen-pick">
                {ALLERGENS.map((a) => {
                  const kids = allergyRows.find((r) => sameAllergen(r.allergen, a))?.childCount;
                  return (
                    <label key={a}>
                      <input
                        type="checkbox"
                        checked={editing.restrictions.some((r) => sameAllergen(r, a))}
                        onChange={() => toggleRestriction(a)}
                      />
                      {a}
                      {kids ? ` · ${kids} trẻ` : ''}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="field">
              <span className="field__label">Món cần đổi</span>
              {conflicts.length ? (
                <div className="table-wrap">
                  <table className="table table--grid table--compact">
                    <thead>
                      <tr>
                        <th className="cell--fixed">Bữa</th>
                        <th className="cell--fixed">Món có chất cần tránh</th>
                        <th>Đổi thành</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conflicts.map((c) => {
                        const k = `${c.session}|${c.dishId}`;
                        return (
                          <tr key={k}>
                            <td className="cell--fixed">{label(c.session)}</td>
                            <td className="cell--fixed">{c.name}</td>
                            <td>
                              <select
                                className="select"
                                value={editing.picks[k] || ''}
                                onChange={(e) => setEditing((x) => ({ ...x, picks: { ...x.picks, [k]: e.target.value } }))}
                              >
                                <option value="">Bỏ món</option>
                                {options(c).map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted text-sm td-flat">
                  {editing.restrictions.length ? 'Thực đơn không có món chứa chất đã chọn.' : 'Chọn chất cần tránh để xem món cần đổi.'}
                </p>
              )}
            </div>
          </div>
        )}
      </SidePanel>
    </section>
  );
}
