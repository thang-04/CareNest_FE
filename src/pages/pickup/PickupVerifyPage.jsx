import { Link, Navigate, useParams } from 'react-router-dom';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { usePickupChild } from '@/hooks/pickup/usePickups';
import { pickupCrumbs } from '@/utils/pickup/breadcrumbs';

/** Đường dẫn cũ của bước xác minh: nay xác minh trong modal của danh sách Đón trẻ (2026-10-23) ⇒ chuyển về đúng lớp, mở modal. */
export default function PickupVerifyPage() {
  const { childId } = useParams();
  const { context, loading, error, reload } = usePickupChild(childId, { live: false });

  if (loading) return <LoadingState />;
  if (context) return <Navigate replace to={`/pickup?classId=${context.classId}&verify=${childId}`} />;
  const title = 'Xác minh người đón';
  return (
    <div className="page">
      <Breadcrumb items={pickupCrumbs(title)} />
      <h1 className="page__title">{title}</h1>
      <div className="card">
        {error && (error.status === 404 || error.status === 403) ? (
          <StatusPage
            bare
            kind={String(error.status)}
            title="Không tìm thấy trẻ"
            description={error.message}
            action={
              <Link className="btn" to="/pickup">
                Quay lại danh sách
              </Link>
            }
          />
        ) : (
          <ErrorState error={error} onRetry={reload} />
        )}
      </div>
    </div>
  );
}
