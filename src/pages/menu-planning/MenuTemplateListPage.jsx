import { Link } from 'react-router-dom';
import { NotebookPen, Plus } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { Breadcrumb, EmptyState } from '@/components';
import { TemplateListPanel } from '@/components/menu-planning/TemplateListPanel';
import { PERMISSIONS } from '@/models/bePermissions';
import { hasBePermission } from '@/utils/bePermissions';
import { templateCrumbs } from '@/utils/menu-planning/breadcrumbs';
import '@/styles/modules/menu-planning.css';

/** Mẫu thực đơn ngày (NUT-13): danh sách bên trái, chọn một mẫu để xem / sửa bên phải. */
export default function MenuTemplateListPage() {
  const { user } = useAuth();
  const canCreate = hasBePermission(user, PERMISSIONS.MENU_MANAGE);

  return (
    <div className="page">
      <Breadcrumb items={templateCrumbs()} />
      <TemplateHead canCreate={canCreate} />
      <div className="td-tpl-split">
        <TemplateListPanel />
        <section className="card">
          <EmptyState
            icon={NotebookPen}
            title="Chọn một mẫu để xem"
            description="Mỗi mẫu là món của một ngày cho một khối. Ở thực đơn tuần, chọn mẫu cho từng ngày để điền món nhanh."
            action={
              canCreate && (
                <Link className="btn btn--primary" to="/menu/templates/new">
                  <Plus size={16} /> Tạo mẫu ngày
                </Link>
              )
            }
          />
        </section>
      </div>
    </div>
  );
}

export function TemplateHead({ canCreate }) {
  return (
    <div className="page__head">
      <div>
        <h1 className="page__title">Mẫu thực đơn ngày</h1>
      </div>
      {canCreate && (
        <div className="page__actions">
          <Link className="btn btn--primary" to="/menu/templates/new">
            <Plus size={16} /> Tạo mẫu ngày
          </Link>
        </div>
      )}
    </div>
  );
}
