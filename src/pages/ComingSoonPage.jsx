import { Link } from 'react-router-dom';
import { Construction } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/States';
import { Breadcrumb } from '@/components/ui/Breadcrumb';

/** Placeholder for menu items of other modules (not part of this task). */
export default function ComingSoonPage() {
  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Chức năng đang phát triển' }]} />
      <h1 className="page__title">Chức năng đang phát triển</h1>
      <div className="card">
        <EmptyState
          icon={Construction}
          title="Chức năng này chưa được triển khai"
          description="Màn hình thuộc module khác của hệ thống, sẽ được bổ sung sau. Các module đang dùng được: Luân chuyển tài sản, Kiểm kê tài sản."
          action={
            <Link className="btn btn--primary" to="/facility/transfers">
              Mở Luân chuyển tài sản
            </Link>
          }
        />
      </div>
    </div>
  );
}
