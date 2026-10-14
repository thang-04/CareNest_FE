import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SearchX, AlertOctagon, Lock, RefreshCw, Home, ArrowLeft, ShieldAlert, ChevronDown, ChevronRight } from '@/components/ui/icons';
import { Logo } from '@/components/brand/Logo';
import { SCHOOL_NAME } from '@/config/app';
import '@/styles/modules/error-page.css';

/**
 * Cấu hình nội dung mặc định cho từng loại trạng thái lỗi theo chuẩn CareNest.
 * Văn phong lịch sự, đúng mực sư phạm mầm non ("bạn"), nút là động từ hành động cụ thể.
 */
const CONFIGS = {
  404: {
    title: 'Không tìm thấy trang',
    description: 'Đường dẫn bạn truy cập không tồn tại hoặc đã được thay đổi. Vui lòng kiểm tra lại địa chỉ hoặc quay về trang chủ.',
    icon: SearchX,
    primaryText: 'Về trang chủ',
    secondaryText: 'Quay lại',
  },
  500: {
    title: 'Đã có lỗi xảy ra',
    description: 'Hệ thống gặp sự cố trong quá trình xử lý yêu cầu. Dữ liệu của bạn luôn an toàn, vui lòng thử lại hoặc tải lại trang.',
    icon: AlertOctagon,
    primaryText: 'Tải lại trang',
    secondaryText: 'Thử lại',
  },
  403: {
    title: 'Không có quyền truy cập',
    description: 'Tài khoản của bạn chưa được cấp quyền để xem nội dung này. Vui lòng liên hệ Ban Giám hiệu nếu bạn cần hỗ trợ.',
    icon: Lock,
    primaryText: 'Về trang chủ',
    secondaryText: 'Quay lại',
  },
  offline: {
    title: 'Mất kết nối mạng',
    description: 'Không thể kết nối đến máy chủ CareNest. Vui lòng kiểm tra lại kết nối mạng Internet trên thiết bị của bạn.',
    icon: ShieldAlert,
    primaryText: 'Tải lại trang',
    secondaryText: 'Thử lại',
  },
};

/**
 * Component hiển thị thông báo lỗi / trang không tìm thấy dùng chung cho CareNest Web.
 * Thiết kế đơn giản, tinh tế, đúng nhận diện thương hiệu của dự án.
 */
export function ErrorScreen({
  type = '404',
  title,
  description,
  icon: CustomIcon,
  primaryAction,
  secondaryAction,
  error,
  errorInfo,
  onRetry,
  standalone = false,
  className = '',
}) {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);

  const normalizedType = String(type).toLowerCase();
  const config = CONFIGS[normalizedType] || CONFIGS['500'];

  const displayTitle = title ?? config.title;
  const displayDesc = description ?? config.description;
  const IconComponent = CustomIcon || config.icon;

  const handleReload = () => {
    window.location.reload();
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const renderPrimary = () => {
    if (primaryAction) return primaryAction;

    if (normalizedType === '500' || normalizedType === 'offline') {
      return (
        <button type="button" className="btn btn--primary" onClick={handleReload}>
          <RefreshCw size={16} />
          {config.primaryText}
        </button>
      );
    }

    return (
      <Link to="/" className="btn btn--primary">
        <Home size={16} />
        {config.primaryText}
      </Link>
    );
  };

  const renderSecondary = () => {
    if (secondaryAction) return secondaryAction;

    if (onRetry) {
      return (
        <button type="button" className="btn" onClick={onRetry}>
          <RefreshCw size={16} />
          {config.secondaryText}
        </button>
      );
    }

    return (
      <button type="button" className="btn" onClick={handleBack}>
        <ArrowLeft size={16} />
        {config.secondaryText}
      </button>
    );
  };

  const errorMessage = error?.message || (typeof error === 'string' ? error : null);
  const errorStack = error?.stack || errorInfo?.componentStack || null;

  const content = (
    <div className={`error-view error-view--${normalizedType} ${className}`}>
      <div className="error-view__icon" aria-hidden="true">
        <IconComponent size={32} />
      </div>

      <h1 className="error-view__title">{displayTitle}</h1>
      <p className="error-view__desc">{displayDesc}</p>

      <div className="error-view__actions">
        {renderPrimary()}
        {renderSecondary()}
      </div>

      {/* Khối chi tiết kỹ thuật gập mở gọn gàng khi có lỗi */}
      {(errorMessage || errorStack) && (
        <div className="error-view__details">
          <button
            type="button"
            className="error-view__details-summary"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
          >
            {showDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>Chi tiết lỗi kỹ thuật</span>
          </button>

          {showDetails && (
            <pre className="error-view__code-trace">
              {errorMessage && `Lỗi: ${errorMessage}\n\n`}
              {errorStack && `Stack trace:\n${errorStack}`}
            </pre>
          )}
        </div>
      )}
    </div>
  );

  // Chế độ toàn màn hình (Standalone) khi gặp sự cố cấp Root hoặc ngoài layout
  if (standalone) {
    return (
      <div className="error-standalone" role="alert" aria-live="assertive">
        <header className="error-standalone__header">
          <Logo size={42} />
        </header>

        <main className="error-standalone__main">
          <div className="card">{content}</div>
        </main>

        <footer className="error-standalone__footer">
          <span>{SCHOOL_NAME} • Hệ thống Quản trị CareNest</span>
        </footer>
      </div>
    );
  }

  // Chế độ hiển thị trong Card chuẩn của CareNest
  return (
    <div className="card error-card" role="alert" aria-live="assertive">
      {content}
    </div>
  );
}

export default ErrorScreen;
