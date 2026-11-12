import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { ClipboardList } from '@/components/ui/icons';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState, SkeletonRows } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { PickupOutcomeBadge, PickupPerson, VerificationBadge } from '@/components/pickup/PickupBadges';
import { usePickupChild, usePickupResults } from '@/hooks/pickup/usePickups';
import { VERIFICATION } from '@/models/pickup/pickupConstants';
import { pickupCrumbs } from '@/utils/pickup/breadcrumbs';
import { formatDate, formatDateTime, todayInput } from '@/utils/format';
import '@/styles/modules/pickup.css';

/** Today's results of the teacher's classes (shown when no child is selected). */
function ResultList() {
  const today = todayInput();
  const { results, loading, error, reload } = usePickupResults(today);
  return (
    <div className="card">
      <div className="card__header">
        <div className="card__title">Kết quả trả trẻ ngày {formatDate(today)}</div>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="table-wrap dt-table-wrap">
          <table className="table table--grid">
            <thead>
              <tr>
                <th>Trẻ</th>
                <th>Lớp</th>
                <th>Người đón</th>
                <th>Xác minh</th>
                <th>Kết quả</th>
                <th>Ghi nhận lúc</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={4} cols={6} />
              ) : results.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={ClipboardList}
                      title="Chưa có kết quả trả trẻ hôm nay"
                      description="Chọn trẻ trong danh sách đón trẻ để xác minh người đón."
                      action={
                        <Link className="btn btn--primary" to="/pickup">
                          Mở danh sách đón trẻ
                        </Link>
                      }
                    />
                  </td>
                </tr>
              ) : (
                results.map((r) => (
                  <tr key={r.id}>
                    <td className="fw-600">{r.childName}</td>
                    <td>{r.className}</td>
                    <td>
                      <PickupPerson pickup={r} />
                    </td>
                    <td className="center">
                      <VerificationBadge status={r.verification} />
                    </td>
                    <td className="center">
                      <PickupOutcomeBadge status={r.outcome} />
                      {r.note && <div className="text-xs muted mt-8 dt-note">{r.note}</div>}
                    </td>
                    <td className="nowrap text-sm">{formatDateTime(r.recordedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Link cũ của form ghi kết quả (?childId&verification): từ 2026-10-24 ghi nhận trong modal của danh sách Đón trẻ
 * ⇒ chuyển về đúng lớp, mở modal Trả trẻ (khớp ảnh) hoặc Gọi phụ huynh.
 */
function LegacyResultRedirect({ childId, verification }) {
  const { context, loading, error, reload } = usePickupChild(childId, { live: false });
  if (loading) return <LoadingState />;
  const modal = verification === VERIFICATION.PHOTO_MATCH ? 'verify' : 'call';
  if (context) return <Navigate replace to={`/pickup?classId=${context.classId}&${modal}=${childId}`} />;
  return (
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
  );
}

/** #101 Pickup Result (UC 3.16): kết quả trả trẻ hôm nay; ghi nhận nằm ở modal của danh sách Đón trẻ. */
export default function PickupResultPage() {
  const [params] = useSearchParams();
  const childId = params.get('childId');
  const title = 'Kết quả trả trẻ';
  return (
    <div className="page">
      <Breadcrumb items={pickupCrumbs(title)} />
      <h1 className="page__title">{title}</h1>
      {childId ? <LegacyResultRedirect childId={childId} verification={params.get('verification')} /> : <ResultList />}
    </div>
  );
}
