import { Lock } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/States';

/** Shown when the signed-in role may not use a configuration screen (DESIGN.md §9). */
export function ScNoAccess({ description = 'Chức năng này chỉ dành cho vai trò được phân quyền theo ma trận quyền của nhà trường.' }) {
  return (
    <div className="card">
      <EmptyState icon={Lock} title="Bạn không có quyền truy cập" description={description} />
    </div>
  );
}
