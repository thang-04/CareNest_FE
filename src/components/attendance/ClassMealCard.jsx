import { ErrorState, LoadingState, StatusBadge } from '@/components';
import { Lock } from '@/components/ui/icons';
import { classMealRows } from '@/utils/attendance/classMealCount';

/**
 * Suất ăn lớp hôm nay (giáo viên): mỗi bữa số suất thường, suất thay thế và trạng thái xác nhận của sổ điểm trường. Số do BE
 * trả (`GET /meal-counts/class`), không tên trẻ.
 */
export function ClassMealCard({ data, loading, error, onRetry }) {
  const rows = classMealRows(data);
  // BE đang chạy chưa có endpoint (404) ⇒ ẩn thẻ thay vì báo lỗi trên màn điểm danh
  if (error?.status === 404) return null;
  let body;
  if (error) body = <ErrorState error={error} onRetry={onRetry} />;
  else if (loading && !data) body = <LoadingState />;
  else if (!rows.length)
    body = (
      <span className="muted text-sm">
        {data && !data.schoolDay ? 'Hôm nay không phải ngày học.' : 'Chưa có số suất, số suất có sau khi điểm danh.'}
      </span>
    );
  else
    body = (
      <ul className="dd-meal-card__list">
        {rows.map((row) => (
          <li key={row.session} className="dd-meal-card__item">
            <span className="dd-meal-card__session">{row.title}:</span>
            <span className="dd-meal-card__count">
              <b>{row.normal}</b> suất thường
              {row.substitute > 0 && (
                <>
                  {' · '}
                  <b>{row.substitute}</b> suất thay thế
                </>
              )}
            </span>
            <span className="dd-meal-card__status">
              {row.locked && <Lock size={14} aria-hidden="true" />}
              <StatusBadge tone={row.tone} label={row.status} />
            </span>
          </li>
        ))}
      </ul>
    );
  return (
    // Gọn một hàng: tiêu đề và từng bữa (số suất, trạng thái) nằm ngang để bảng điểm danh có nhiều chỗ hơn
    <section className="card dd-meal-card" aria-labelledby="class-meal-title">
      <h2 className="dd-meal-card__title" id="class-meal-title">
        Suất ăn lớp hôm nay
      </h2>
      <div className="dd-meal-card__body">{body}</div>
    </section>
  );
}
