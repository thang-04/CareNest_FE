import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Pencil, Trash2, AlertTriangle, ShieldAlert, ShieldCheck } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAllergyContext, useAllergyMenu, useMenuAccess, useMenuCatalog } from '@/hooks/menu-planning/useMenuPlanning';
import { useMasterData } from '@/hooks/useMasterData';
import { deleteAllergyMenu } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { AllergenChips, HistoryCard, RecordStatusBadge } from '@/components/menu-planning/MenuBadges';
import { MealsView } from '@/components/menu-planning/MealsView';
import { NutritionTable } from '@/components/menu-planning/NutritionTable';
import { applyReplacements, mealsTotals, priceOn, restrictedConflicts, sameAllergen } from '@/utils/menu-planning/menuCalculations';
import { allergyMenuCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { todayInput } from '@/utils/format';
import { ageGroupById } from '@/models/School';
import { ALLERGY_GROUP_LABELS, MEAL_SESSION_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

/** Screen #82 – one alternative menu. */
export default function AllergyMenuDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const { canManage } = useMenuAccess();
  const { catalog, loading: catLoading } = useMenuCatalog();
  const { item: a, loading, error, reload } = useAllergyMenu(id);
  const { rows: allergyRows } = useAllergyContext(a?.ageGroupId || '');
  const [confirm, setConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (loading || catLoading) return <LoadingState />;
  if (error || !a)
    return (
      <div className="page">
        <Breadcrumb items={allergyMenuCrumbs('Chi tiết thực đơn thay thế')} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  const base = catalog.menuById[a.baseMenuId];
  const effective = base ? applyReplacements(base.meals, a.replacements) : [];
  const conflicts = restrictedConflicts(effective, a.restrictions, catalog.dishById, catalog.foodById);
  const result = mealsTotals(effective, catalog.dishById, catalog.foodById, a.ageGroupId);
  const affected = allergyRows.filter((r) => a.restrictions.some((x) => sameAllergen(x, r.allergen)));
  const remove = async () => {
    try {
      await deleteAllergyMenu(id, user);
      toast.success('Đã xóa bản ghi.');
      navigate('/menu/allergy-menus');
    } catch (err) {
      setConfirm(false);
      setDeleteError(err.message);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={allergyMenuCrumbs(a.code)} />
      <div className="page__head">
        <div className="row" style={{ gap: 12 }}>
          <h1 className="page__title">{a.name}</h1>
          <RecordStatusBadge status={a.status} size="lg" />
        </div>
        {canManage && (
          <div className="row row--wrap td-actions">
            <button className="btn btn--outline-danger" onClick={() => setConfirm(true)}>
              <Trash2 size={16} /> Xóa
            </button>
            <Link className="btn btn--primary" to={`/menu/allergy-menus/${id}/edit`}>
              <Pencil size={16} /> Sửa thực đơn thay thế
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
      {conflicts.length > 0 ? (
        <div className="alert alert--danger mb-16">
          <ShieldAlert size={18} />
          <div>
            Phát hiện xung đột chế độ ăn: {conflicts.map((c) => `${c.allergen} trong ${c.dishes.map((d) => d.name).join(', ')}`).join('; ')}
            . Món ăn có thể đã đổi thành phần sau khi lập thực đơn này – hãy cập nhật món thay thế.
          </div>
        </div>
      ) : (
        <div className="alert alert--success mb-16">
          <ShieldCheck size={18} />
          <div>Thực đơn không chứa thành phần cần tránh ({a.restrictions.join(', ')}).</div>
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
              <dd className="fw-600">{a.code}</dd>
              <dt>Thực đơn gốc:</dt>
              <dd>{base ? <Link to={`/menu/menus/${base.id}`}>{`${base.code} · ${base.name}`}</Link> : 'Đã xóa'}</dd>
              <dt>Nhóm tuổi:</dt>
              <dd>{ageGroupById(a.ageGroupId)?.name}</dd>
              <dt>Loại nhóm:</dt>
              <dd>{ALLERGY_GROUP_LABELS[a.groupType]}</dd>
              <dt>Tránh:</dt>
              <dd>
                <AllergenChips allergens={a.restrictions} />
              </dd>
              <dt>Ghi chú:</dt>
              <dd>{a.note || '—'}</dd>
            </dl>
          </div>
        </div>
        <div className="card">
          <div className="card__header">
            <div className="card__title">Trẻ cần dùng thực đơn này</div>
          </div>
          <div className="card__body">
            {affected.length === 0 ? (
              <span className="muted">Hiện chưa có trẻ nào trong nhóm tuổi được ghi nhận dị ứng với các thành phần này.</span>
            ) : (
              <ul className="td-check-list">
                {affected.map((r) => (
                  <li key={r.allergen}>
                    <div>
                      <b>{r.allergen}</b>:{' '}
                      {r.classes
                        .filter((c) => c.ageGroupId === a.ageGroupId)
                        .map((c) => `${c.className} (${md.campusById(c.campusId)?.code || ''}) – ${c.count} trẻ`)
                        .join('; ')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <div className="card mt-16">
        <div className="card__header">
          <div className="card__title">Món được thay</div>
        </div>
        <div className="table-wrap" style={{ border: 'none' }}>
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Bữa</th>
                <th>Món gốc</th>
                <th aria-hidden="true" />
                <th>Món thay thế</th>
                <th className="right">Hệ số</th>
              </tr>
            </thead>
            <tbody>
              {a.replacements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    Không thay món nào.
                  </td>
                </tr>
              ) : (
                a.replacements.map((r) => (
                  <tr key={`${r.session}_${r.originalDishId}`}>
                    <td>{MEAL_SESSION_LABELS[r.session]}</td>
                    <td>{catalog.dishById[r.originalDishId]?.name || 'Món đã xóa'}</td>
                    <td>
                      <ArrowRight size={15} className="muted" />
                    </td>
                    <td className="fw-600">
                      {r.replacementDishId ? catalog.dishById[r.replacementDishId]?.name || 'Món đã xóa' : 'Bỏ món'}
                    </td>
                    <td className="right">{r.replacementDishId ? String(r.portion).replace('.', ',') : '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card mt-16">
        <div className="card__header">
          <div className="card__title">Thực đơn áp dụng và dinh dưỡng</div>
        </div>
        <div className="card__body">
          <MealsView
            meals={effective}
            catalog={catalog}
            linkDishes
            changedDishIds={a.replacements.map((r) => r.replacementDishId).filter(Boolean)}
          />
          <div className="mt-16">
            <NutritionTable
              result={result}
              ageGroupId={a.ageGroupId}
              price={priceOn(catalog.mealPrices, a.ageGroupId, todayInput())?.price}
            />
          </div>
        </div>
      </div>
      <HistoryCard history={a.history} />
      <div className="page-actions">
        <Link className="btn" to="/menu/allergy-menus">
          <ArrowLeft size={16} /> Quay lại danh sách
        </Link>
      </div>
      <ConfirmationModal
        open={confirm}
        danger
        title="Xóa thực đơn thay thế"
        message={`Xóa thực đơn thay thế "${a.code}"?`}
        confirmLabel="Xóa thực đơn thay thế"
        onConfirm={remove}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}
