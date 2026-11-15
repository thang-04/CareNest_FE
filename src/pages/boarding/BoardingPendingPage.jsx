import { Link } from 'react-router-dom';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { StatusPage } from '@/components/ui/StatusPage';

const CONTENT = {
  inspection: {
    title: 'Kiểm thực ba bước',
    description: 'Biểu mẫu kiểm thực ba bước chưa lưu vào hệ thống. Chưa dùng màn này để kiểm thử ký hoặc đối chiếu vận hành.',
    links: [
      { to: '/kitchen/fresh-receipts', label: 'Kiểm nhận hàng tươi' },
      { to: '/kitchen/food-samples', label: 'Lưu mẫu thực phẩm' },
    ],
  },
  allergy: {
    title: 'Món thay thế dị ứng',
    description: 'Màn tạo món thay thế chưa có dữ liệu hệ thống. Chưa dùng bản lưu trên trình duyệt để kiểm thử suất thay thế.',
    links: [{ to: '/menu/weekly', label: 'Xem kế hoạch tuần' }],
  },
  suggestion: {
    title: 'Gợi ý thực đơn',
    description: 'Gợi ý thực đơn chưa nối dữ liệu hệ thống. Chưa dùng bản nháp tại đây để lập hoặc công bố thực đơn.',
    links: [{ to: '/menu/weekly', label: 'Xem kế hoạch tuần' }],
  },
};

export default function BoardingPendingPage({ feature }) {
  const { title, description, links } = CONTENT[feature];
  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: title }]} />
      <h1 className="page__title">{title}</h1>
      <StatusPage
        kind="coming-soon"
        title="Chưa có dữ liệu hệ thống"
        description={description}
        action={
          <div className="row row--center">
            {links.map(({ to, label }, index) => (
              <Link key={to} className={`btn${index === 0 ? ' btn--primary' : ''}`} to={to}>
                {label}
              </Link>
            ))}
          </div>
        }
      />
    </div>
  );
}
