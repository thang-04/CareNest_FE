import { useState } from 'react';
import { Plus } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { Button, PageHeader } from '@/components';
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
      <PageHeader crumbs={templateCrumbs()} title="Mẫu thực đơn" readOnly={!canCreate} />
      <TemplateCards canCreate={canCreate} onOpen={setOpenId} />
      {openId && <TemplatePreviewModal id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

/** Đầu màn sửa mẫu: readOnly khi BE không cho sửa mẫu đang mở (`canEdit=false`). */
export function TemplateHead({ crumbs, canCreate, readOnly = false }) {
  const [choosing, setChoosing] = useState(false);
  return (
    <>
      <PageHeader
        crumbs={crumbs}
        title="Mẫu thực đơn"
        readOnly={readOnly}
        actions={
          canCreate && (
            <div className="page__actions">
              <Button variant="primary" icon={Plus} onClick={() => setChoosing(true)}>
                Tạo mẫu
              </Button>
            </div>
          )
        }
      />
      {choosing && <TemplateKindModal onClose={() => setChoosing(false)} />}
    </>
  );
}
