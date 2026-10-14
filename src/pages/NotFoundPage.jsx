import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ErrorScreen } from '@/components/ui/ErrorScreen';

/**
 * Trang 404 — Không tìm thấy đường dẫn hoặc trang không tồn tại.
 * Thiết kế đơn giản, tinh tế, đồng bộ với CareNest Design System v3.1.
 */
export default function NotFoundPage() {
  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Không tìm thấy trang' }]} />
      <ErrorScreen type="404" />
    </div>
  );
}
