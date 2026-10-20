import { StatusPage } from '@/components/ui/StatusPage';
import { Breadcrumb } from '@/components/ui/Breadcrumb';

export default function NotFoundPage() {
  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Không tìm thấy trang' }]} />
      <h1 className="page__title">Không tìm thấy trang</h1>
      <StatusPage kind="404" />
    </div>
  );
}
