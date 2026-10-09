import { Link } from 'react-router-dom';
import { SearchX } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/States';
import { Breadcrumb } from '@/components/ui/Breadcrumb';

export default function NotFoundPage() {
  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Không tìm thấy trang' }]} />
      <h1 className="page__title">Không tìm thấy trang</h1>
      <div className="card">
        <EmptyState
          icon={SearchX}
          title="Không tìm thấy trang"
          description="Đường dẫn không tồn tại hoặc đã bị thay đổi."
          action={
            <Link className="btn btn--primary" to="/">
              Về trang chủ
            </Link>
          }
        />
      </div>
    </div>
  );
}
