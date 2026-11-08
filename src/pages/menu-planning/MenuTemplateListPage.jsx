import { useState } from 'react';
import { Plus } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { Breadcrumb } from '@/components';
import { TemplateCards } from '@/components/menu-planning/TemplateCards';
import { TemplateKindModal } from '@/components/menu-planning/TemplateKindModal';
import { TemplatePreviewModal } from '@/components/menu-planning/TemplatePreviewModal';
import { PERMISSIONS } from '@/models/bePermissions';
import { hasBePermission } from '@/utils/bePermissions';
import { templateCrumbs } from '@/utils/menu-planning/breadcrumbs';
import '@/styles/modules/menu-planning.css';

/** Mẫu thực đơn (NUT-13): lưới thẻ giữa trang, bấm một mẫu mở modal xem đủ bữa, món, thành phần. */
export default function MenuTemplateListPage() {
  const { user } = useAuth();
  const canCreate = hasBePermission(user, PERMISSIONS.MENU_MANAGE);
  const [openId, setOpenId] = useState(null);

  return (
    <div className="page td-sections">
      <Breadcrumb items={templateCrumbs()} />
      <h1 className="page__title">Mẫu thực đơn</h1>
      <TemplateCards canCreate={canCreate} onOpen={setOpenId} />
      {openId && <TemplatePreviewModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

export function TemplateHead({ canCreate }) {
  const [choosing, setChoosing] = useState(false);
  return (
    <div className="page__head">
      <div>
        <h1 className="page__title">Mẫu thực đơn</h1>
      </div>
      {canCreate && (
        <div className="page__actions">
          <button type="button" className="btn btn--primary" onClick={() => setChoosing(true)}>
            <Plus size={16} /> Tạo mẫu
          </button>
        </div>
      )}
      {choosing && <TemplateKindModal onClose={() => setChoosing(false)} />}
    </div>
  );
}
