import { Link } from 'react-router-dom';
import { Lock, SearchX, ArrowLeft } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/ui/States';

/** Load failure of a child page: 403 (MSG10), 404, or a retryable error (MSG30). */
export function ChildAccessState({ error, onRetry }) {
  const back = (
    <Link className="btn" to="/children">
      <ArrowLeft size={16} /> Về danh sách trẻ
    </Link>
  );
  if (error?.status === 403)
    return (
      <div className="card">
        <EmptyState
          icon={Lock}
          title="Bạn không có quyền xem hồ sơ này"
          description="Hồ sơ trẻ chỉ hiển thị trong phạm vi lớp hoặc điểm trường được phân công."
          action={back}
        />
      </div>
    );
  if (error?.status === 404)
    return (
      <div className="card">
        <EmptyState
          icon={SearchX}
          title="Không tìm thấy hồ sơ trẻ"
          description="Hồ sơ có thể đã bị chuyển hoặc đường dẫn không đúng."
          action={back}
        />
      </div>
    );
  return (
    <div className="card">
      <ErrorState error={error} onRetry={onRetry} />
    </div>
  );
}
