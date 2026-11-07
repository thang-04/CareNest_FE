import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from '@/components/ui/icons';
import { useCatalogAccess } from '@/hooks/menu-planning/useMenuPlanning';
import { useFoodForm } from '@/hooks/menu-planning/useFoodForm';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { NoManageAccess } from '@/components/menu-planning/MenuBadges';
import { FoodEditor } from '@/components/menu-planning/FoodEditor';
import { foodCrumbs } from '@/utils/menu-planning/breadcrumbs';
import '@/styles/modules/menu-planning.css';

/** Screen #70 – the Vice Principal (shared services) creates or edits a food item (UC 6.4). Danh sách mở cùng form trong modal. */
export default function FoodFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const access = useCatalogAccess();
  const f = useFoodForm(id, { onSaved: (saved) => navigate(`/menu/foods/${saved.id}`) });
  const title = id ? 'Sửa thực phẩm' : 'Thêm thực phẩm';

  if (access.loading || f.loading) return <LoadingState />;
  if (!access.canManage)
    return (
      <div className="page">
        <Breadcrumb items={foodCrumbs(title)} />
        <h1 className="page__title">{title}</h1>
        <NoManageAccess />
      </div>
    );
  if (id && f.error)
    return (
      <div className="page">
        <Breadcrumb items={foodCrumbs(title)} />
        <ErrorState error={f.error} onRetry={f.reload} />
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={foodCrumbs(title)} />
      <h1 className="page__title">{id ? `Sửa thực phẩm ${f.item?.code || ''}` : title}</h1>
      <form onSubmit={f.submit} noValidate className="card td-food-page">
        <div className="page-actions page-actions--top">
          <button type="button" className="btn" onClick={() => navigate(id ? `/menu/foods/${id}` : '/menu/foods')}>
            <ArrowLeft size={16} /> Hủy
          </button>
          <button type="submit" className="btn btn--primary" disabled={f.busy}>
            {f.busy ? <Spinner small /> : <Save size={16} />} Lưu thực phẩm
          </button>
        </div>
        <FoodEditor f={f} />
      </form>
    </div>
  );
}
