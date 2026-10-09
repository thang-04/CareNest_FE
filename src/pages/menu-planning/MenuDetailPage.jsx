import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Trash2, AlertTriangle } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAllergyContext, useMenuAccess, useMenuCatalog, useSampleMenu } from '@/hooks/menu-planning/useMenuPlanning';
import { deleteSampleMenu } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { HistoryCard, RecordStatusBadge, WeeklyStatusBadge } from '@/components/menu-planning/MenuBadges';
import { MealsView } from '@/components/menu-planning/MealsView';
import { NutritionTable } from '@/components/menu-planning/NutritionTable';
import { AllergenWarnings } from '@/components/menu-planning/AllergenWarnings';
import { mealsTotals, priceOn } from '@/utils/menu-planning/menuCalculations';
import { sampleMenuCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { todayInput } from '@/utils/format';
import { ageGroupById } from '@/models/School';
import { ALLERGY_GROUP_LABELS, weekLabel } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

/** Screen #79 – one sample daily menu with its nutrition and alternative menus. */
export default function MenuDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { canManage } = useMenuAccess();
  const { catalog, loading: catLoading } = useMenuCatalog();
  const { item: m, loading, error, reload } = useSampleMenu(id);
  const { rows: allergyRows } = useAllergyContext(m?.ageGroupId);
  const [confirm, setConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  if (loading || catLoading) return <LoadingState />;
  if (error || !m)
    return (
      <div className="page">
        <Breadcrumb items={sampleMenuCrumbs('Chi tiết thực đơn')} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  const result = mealsTotals(m.meals, catalog.dishById, catalog.foodById, m.ageGroupId);
  const price = priceOn(catalog.mealPrices, m.ageGroupId, todayInput())?.price;
  const remove = async () => {
    try {
      await deleteSampleMenu(id, user);
      toast.success('Đã xóa bản ghi.');
      navigate('/menu/menus');
    } catch (err) {
      setConfirm(false);
      setDeleteError(err.message);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={sampleMenuCrumbs(m.code)} />
      <div className="page__head">
        <div className="row" style={{ gap: 12 }}>
          <h1 className="page__title">{m.name}</h1>
          <RecordStatusBadge status={m.status} size="lg" />
        </div>
        {canManage && (
          <div className="row row--wrap td-actions">
            <button className="btn btn--outline-danger" onClick={() => setConfirm(true)}>
              <Trash2 size={16} /> Xóa
            </button>
            <Link className="btn" to={`/menu/allergy-menus/new?baseMenuId=${id}`}>
              <Plus size={16} /> Tạo thực đơn thay thế
            </Link>
            <Link className="btn btn--primary" to={`/menu/menus/${id}/edit`}>
              <Pencil size={16} /> Sửa thực đơn
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
      <div className="card">
        <div className="card__header">
          <div className="card__title">
            {m.code} · {ageGroupById(m.ageGroupId)?.name}
          </div>
        </div>
        <div className="card__body">
          {m.note && <p className="mb-12">{m.note}</p>}
          <MealsView meals={m.meals} catalog={catalog} linkDishes />
        </div>
      </div>
      <div className="card mt-16">
        <div className="card__header">
          <div className="card__title">Dinh dưỡng trong ngày</div>
        </div>
        <div className="card__body">
          <AllergenWarnings
            meals={m.meals}
            catalog={catalog}
            contextRows={allergyRows}
            allergyMenus={m.allergyMenus}
            baseMenuId={m.id}
            canCreate={canManage}
          />
          <NutritionTable result={result} ageGroupId={m.ageGroupId} price={price} />
        </div>
      </div>
      <div className="td-split mt-16">
        <div className="card">
          <div className="card__header">
            <div className="card__title">Thực đơn thay thế ({m.allergyMenus.length})</div>
          </div>
          <div className="card__body">
            {m.allergyMenus.length === 0 ? (
              <span className="muted">Chưa có thực đơn thay thế cho thực đơn này.</span>
            ) : (
              <ul className="td-check-list">
                {m.allergyMenus.map((a) => (
                  <li key={a.id}>
                    <div>
                      <Link to={`/menu/allergy-menus/${a.id}`} className="fw-600">
                        {a.code}
                      </Link>{' '}
                      · {a.name}
                      <div className="text-sm muted">
                        {ALLERGY_GROUP_LABELS[a.groupType]} · tránh {a.restrictions.join(', ')}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card__header">
            <div className="card__title">Dùng trong thực đơn tuần ({m.usedInWeeks.length})</div>
          </div>
          <div className="card__body">
            {m.usedInWeeks.length === 0 ? (
              <span className="muted">Chưa được xếp vào tuần nào.</span>
            ) : (
              <ul className="td-check-list">
                {m.usedInWeeks.map((w) => (
                  <li key={w.id}>
                    <Link to={`/menu/weekly/${w.id}`}>
                      {w.code} · tuần {weekLabel(w.weekStart)}
                      {w.version > 1 ? ` · phiên bản ${w.version}` : ''}
                    </Link>
                    <WeeklyStatusBadge status={w.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      <HistoryCard history={m.history} />
      <div className="page-actions">
        <Link className="btn" to="/menu/menus">
          <ArrowLeft size={16} /> Quay lại danh sách
        </Link>
      </div>
      <ConfirmationModal
        open={confirm}
        danger
        title="Xóa thực đơn mẫu"
        message={`Xóa thực đơn "${m.name}"? Thực đơn đã xếp vào tuần hoặc có thực đơn thay thế sẽ không xóa được.`}
        confirmLabel="Xóa thực đơn"
        onConfirm={remove}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}
