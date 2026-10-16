import { Link } from 'react-router-dom';
import { Lock, SearchX, ArrowLeft } from '@/components/ui/icons';
import { EmptyState, ErrorState } from '@/components/ui/States';

const CHILD_TEXT = {
  forbiddenTitle: 'Bạn không có quyền xem hồ sơ này',
  forbiddenDescription: 'Hồ sơ trẻ chỉ hiển thị trong phạm vi lớp hoặc điểm trường được phân công.',
  notFoundTitle: 'Không tìm thấy hồ sơ trẻ',
  notFoundDescription: 'Hồ sơ có thể đã bị chuyển hoặc đường dẫn không đúng.',
  backTo: '/children',
  backLabel: 'Về danh sách trẻ',
};

/** Load failure of a child page: 403 (MSG10), 404, or a retryable error (MSG30). `text` đổi câu chữ cho trang khác của module. */
export function ChildAccessState({ error, onRetry, text }) {
  const t = { ...CHILD_TEXT, ...text };
  const back = (
    <Link className="btn" to={t.backTo}>
      <ArrowLeft size={16} /> {t.backLabel}
    </Link>
  );
  if (error?.status === 403)
    return (
      <div className="card">
        <EmptyState icon={Lock} title={t.forbiddenTitle} description={t.forbiddenDescription} action={back} />
      </div>
    );
  if (error?.status === 404)
    return (
      <div className="card">
        <EmptyState icon={SearchX} title={t.notFoundTitle} description={t.notFoundDescription} action={back} />
      </div>
    );
  return (
    <div className="card">
      <ErrorState error={error} onRetry={onRetry} />
    </div>
  );
}

/** Câu chữ 403/404 cho trang đợt khám. */
export const HEALTH_CHECK_ACCESS_TEXT = {
  forbiddenTitle: 'Bạn không có quyền xem đợt khám này',
  forbiddenDescription: 'Đợt khám chỉ hiển thị trong phạm vi điểm trường hoặc lớp được phân công.',
  notFoundTitle: 'Không tìm thấy đợt khám',
  notFoundDescription: 'Đợt khám có thể đã bị hủy, ngoài phạm vi của bạn, hoặc đường dẫn không đúng.',
  backTo: '/children/health-checks',
  backLabel: 'Về danh sách đợt khám',
};
