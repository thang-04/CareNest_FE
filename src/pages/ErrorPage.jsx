import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ErrorScreen } from '@/components/ui/ErrorScreen';

/**
 * Trang lỗi hệ thống 500 — Dùng hiển thị khi xảy ra sự cố nghiêm trọng hoặc điều hướng lỗi.
 */
export default function ErrorPage({ error, errorInfo, onRetry }) {
  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Sự cố hệ thống' }]} />
      <ErrorScreen type="500" error={error} errorInfo={errorInfo} onRetry={onRetry} />
    </div>
  );
}
