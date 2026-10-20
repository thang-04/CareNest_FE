import { Link } from 'react-router-dom';
import { StatusPage } from '@/components/ui/StatusPage';
import { Breadcrumb } from '@/components/ui/Breadcrumb';

/** Placeholder for menu items of other modules (not part of this task). */
export default function ComingSoonPage() {
  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Chức năng đang phát triển' }]} />
      <h1 className="page__title">Chức năng đang phát triển</h1>
      <StatusPage
        kind="coming-soon"
        title="Chức năng này chưa được triển khai"
        description="Màn hình thuộc module khác của hệ thống, sẽ được bổ sung sau."
        action={
          <Link className="btn btn--primary" to="/">
            Về trang chủ
          </Link>
        }
      />
    </div>
  );
}
