import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { Breadcrumb } from '@/components';
import { TemplateCards } from '@/components/menu-planning/TemplateCards';
import { TemplatePreviewModal } from '@/components/menu-planning/TemplatePreviewModal';
import { PERMISSIONS } from '@/models/bePermissions';
import { hasBePermission } from '@/utils/bePermissions';
import { templateCrumbs } from '@/utils/menu-planning/breadcrumbs';
import '@/styles/modules/menu-planning.css';

/** Mẫu thực đơn ngày (NUT-13): lưới thẻ giữa trang, bấm một mẫu mở modal xem đủ bữa, món, thành phần. */
export default function MenuTemplateListPage() {
  const { user } = useAuth();
  const canCreate = hasBePermission(user, PERMISSIONS.MENU_MANAGE);
  const [openId, setOpenId] = useState(null);

  return (
    <div className="page td-sections">
      <Breadcrumb items={templateCrumbs()} />
      <TemplateHead canCreate={canCreate} />
      <TemplateCards canCreate={canCreate} onOpen={setOpenId} />
      {openId && <TemplatePreviewModal id={openId} onClose={() => setOpenId(null)} />}
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
