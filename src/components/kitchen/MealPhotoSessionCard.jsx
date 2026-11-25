import { EmptyState, ErrorState, LoadingState } from '@/components';
import { MealPhotoStatusBadge } from '@/components/kitchen/KitchenBadges';
import { useMealPhotoUrl } from '@/hooks/kitchen/useKitchenRecords';
import { MEAL_SESSION_LABELS, SAMPLE_DISPOSAL_LABELS, SAMPLE_STATUS_LABELS } from '@/models/kitchen/kitchenRecordConstants';
import { formatDate, formatDateTime, formatFileSize } from '@/utils/format';

function PhotoFrame({ photo, alt }) {
  const image = useMealPhotoUrl(photo.id);
  return (
    <div className="kr-photo__frame">
      {image.loading && <LoadingState text="Đang tải ảnh..." />}
      {image.error && <ErrorState error={image.error} />}
      {image.url && <img className="kr-photo__img" src={image.url} alt={alt} />}
    </div>
  );
}

const EMPTY_TEXT = {
  MISSING: ['Bếp chưa đăng ảnh', 'Đã quá khung giờ đăng ảnh của bữa này.'],
  PENDING: ['Chưa đến hạn đăng ảnh', 'Bếp còn trong khung giờ đăng ảnh của bữa này.'],
  NOT_EXPECTED: ['Không có bữa này', 'Ngày nghỉ, ngày chưa tới hoặc thực đơn không có bữa này.'],
};

/** Thẻ một bữa: ảnh, người đăng, đúng/trễ giờ, món theo thực đơn, số suất đã chốt, trạng thái lưu mẫu. */
export function MealPhotoSessionCard({ session, date }) {
  const label = MEAL_SESSION_LABELS[session.session] || session.session;
  const { photo } = session;
  const [emptyTitle, emptyText] = EMPTY_TEXT[session.status] || EMPTY_TEXT.NOT_EXPECTED;
  return (
    <section className="card" aria-label={label}>
      <div className="card__header">
        <h2 className="card__title">{label}</h2>
        <MealPhotoStatusBadge status={session.status} />
      </div>
      <div className="card__body kb-stack kb-stack--tight">
        {photo ? (
          <PhotoFrame photo={photo} alt={`Ảnh ${label.toLowerCase()} ngày ${formatDate(date)}`} />
        ) : (
          <EmptyState title={emptyTitle} description={emptyText} />
        )}
        {photo && (
          <dl className="kr-facts">
            <dt>Người đăng</dt>
            <dd>{photo.uploaderName || 'Không rõ'}</dd>
            <dt>Đăng lúc</dt>
            <dd>
              {formatDateTime(photo.uploadedAt)}
              {photo.onTime != null && (
                <span className={`chip ${photo.onTime ? 'chip--green' : 'chip--orange'} kr-facts__chip`}>
                  {photo.onTime ? 'Đúng khung giờ' : 'Ngoài khung giờ'}
                </span>
              )}
            </dd>
            <dt>Dung lượng</dt>
            <dd>{formatFileSize(photo.sizeBytes)}</dd>
          </dl>
        )}
        <dl className="kr-facts">
          <dt>Thực đơn</dt>
          <dd>{session.dishes.length ? session.dishes.join(', ') : 'Chưa có thực đơn đã công bố'}</dd>
          <dt>Số suất</dt>
          <dd>
            {session.servingsNormal == null
              ? 'Chưa chốt'
              : `${session.servingsNormal} thường${session.servingsSubstitute ? `, ${session.servingsSubstitute} thay thế` : ''}`}
          </dd>
          {session.sample && (
            <>
              <dt>Lưu mẫu</dt>
              <dd>
                {SAMPLE_STATUS_LABELS[session.sample.status] || session.sample.status}
                {session.sample.disposalStatus && session.sample.disposalStatus !== 'NONE'
                  ? ` · ${SAMPLE_DISPOSAL_LABELS[session.sample.disposalStatus] || session.sample.disposalStatus}`
                  : ''}
              </dd>
            </>
          )}
        </dl>
      </div>
    </section>
  );
}
