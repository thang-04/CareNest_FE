import { Link, useInRouterContext } from 'react-router-dom';
import { AlertOctagon, Construction, Lock, RefreshCw, SearchX } from '@/components/ui/icons';

/** Nội dung mặc định theo loại; trang gọi chỉ truyền thêm câu riêng khi cần. */
const KINDS = {
  404: { icon: SearchX, title: 'Không tìm thấy trang', description: 'Đường dẫn không tồn tại hoặc đã bị thay đổi.' },
  403: {
    icon: Lock,
    title: 'Bạn không có quyền truy cập',
    description: 'Chức năng hoặc dữ liệu này nằm ngoài phạm vi được phân quyền của bạn.',
  },
  500: {
    icon: AlertOctagon,
    title: 'Hệ thống gặp sự cố',
    description: 'Trang này chưa hiển thị được. Hãy tải lại trang; nếu vẫn lỗi, báo cho quản trị hệ thống.',
  },
  chunk: {
    icon: RefreshCw,
    title: 'Ứng dụng vừa được cập nhật',
    description: 'Trang chưa tải được phiên bản mới. Hãy tải lại trang để tiếp tục.',
  },
  'coming-soon': { icon: Construction, title: 'Chức năng đang phát triển', description: 'Màn hình này sẽ được bổ sung sau.' },
};

const reload = () => window.location.reload();

/** Ngoài router (ErrorBoundary ngoài cùng) không dùng được <Link> nên dùng thẻ a. */
function HomeLink({ className = 'btn' }) {
  const inRouter = useInRouterContext();
  return inRouter ? (
    <Link className={className} to="/">
      Về trang chủ
    </Link>
  ) : (
    <a className={className} href="/">
      Về trang chủ
    </a>
  );
}

/**
 * Trang/khối trạng thái chặn: 404, 403, 500, lỗi tải phiên bản mới (chunk), chức năng chưa làm.
 * Dùng icon (không dùng tranh) theo DESIGN.md §9. `bare`: đã nằm trong card thì không bọc card nữa.
 */
export function StatusPage({ kind = '404', title, description, action, bare = false }) {
  const preset = KINDS[kind] || KINDS[404];
  const Icon = preset.icon;
  const serverSide = kind === '500' || kind === 'chunk';
  const defaultAction = serverSide ? (
    <div className="row row--center">
      <button type="button" className="btn btn--primary" onClick={reload}>
        <RefreshCw size={16} /> Tải lại trang
      </button>
      <HomeLink />
    </div>
  ) : (
    <HomeLink className="btn btn--primary" />
  );
  const body = (
    <div className={`state${serverSide ? ' state--error' : ''}`} role={serverSide ? 'alert' : undefined}>
      <div className="state__icon">
        <Icon size={bare ? 28 : 40} />
      </div>
      <h2 className="state__title">{title || preset.title}</h2>
      <div className="state__desc">{description || preset.description}</div>
      {action === undefined ? defaultAction : action}
    </div>
  );
  // Cả trang: card phủ hết vùng nội dung, nội dung căn giữa (góp ý user 20/10: không để khối nhỏ trên đầu trang)
  return bare ? body : <div className="card status-page">{body}</div>;
}
