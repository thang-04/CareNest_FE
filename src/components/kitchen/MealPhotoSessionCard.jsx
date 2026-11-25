import { Camera } from '@/components/ui/icons';
import { ErrorState, LoadingState } from '@/components';
import { MealPhotoStatusBadge } from '@/components/kitchen/KitchenBadges';
import { useMealPhotoUrl } from '@/hooks/kitchen/useKitchenRecords';
import { MEAL_SESSION_LABELS, SAMPLE_DISPOSAL_LABELS, SAMPLE_STATUS_LABELS } from '@/models/kitchen/kitchenRecordConstants';
import { formatDate, formatTime } from '@/utils/format';

function PhotoFrame({ photo, alt }) {
  const image = useMealPhotoUrl(photo.id);
  return (
    <div className="kr-photo">
      {image.loading && <LoadingState text="Đang tải ảnh..." />}
      {image.error && <ErrorState error={image.error} />}
      {image.url && (
        <a className="kr-photo__link" href={image.url} target="_blank" rel="noreferrer" title="Mở ảnh lớn trong tab mới">
          <img className="kr-photo__img" src={image.url} alt={alt} />
        </a>
      )}
    </div>
  );
}

// Bữa chưa có ảnh: giữ khung 4:3 như bữa có ảnh để ba thẻ cao bằng nhau
const EMPTY_TEXT = {
  MISSING: 'Bếp chưa đăng ảnh',
  PENDING: 'Chưa đến hạn đăng ảnh',
  NOT_EXPECTED: 'Không có bữa này',
};

const sampleText = (sample) => {
  if (!sample) return null;
  const status = SAMPLE_STATUS_LABELS[sample.status] || sample.status;
  const disposal =
    sample.disposalStatus && sample.disposalStatus !== 'NONE'
      ? ` · ${SAMPLE_DISPOSAL_LABELS[sample.disposalStatus] || sample.disposalStatus}`
      : '';
  return `Mẫu: ${status}${disposal}`;
};

/**
 * Thẻ một bữa gồm 5 hàng (đầu thẻ, ảnh, người đăng, thực đơn, chip suất/mẫu). Các hàng là subgrid của `.kr-meals`
 * nên ba thẻ thẳng hàng với nhau dù nội dung dài ngắn khác nhau.
 */
export function MealPhotoSessionCard({ session, date }) {
  const label = MEAL_SESSION_LABELS[session.session] || session.session;
  const { photo } = session;
  const sample = sampleText(session.sample);
  const dishes = session.dishes.length ? session.dishes.join(', ') : 'Chưa có thực đơn đã công bố';
  return (
    <section className="card kr-meal" aria-label={label}>
      <div className="kr-meal__head">
        <h2 className="kr-meal__title">{label}</h2>
        <MealPhotoStatusBadge status={session.status} />
      </div>
      {photo ? (
        <PhotoFrame photo={photo} alt={`Ảnh ${label.toLowerCase()} ngày ${formatDate(date)}`} />
      ) : (
        <div className="kr-photo kr-photo--empty">
          <Camera size={28} aria-hidden="true" />
          <span>{EMPTY_TEXT[session.status] || EMPTY_TEXT.NOT_EXPECTED}</span>
        </div>
      )}
      <div className="kr-meal__who">
        {photo ? (
          <>
            <strong>{photo.uploaderName || 'Không rõ người đăng'}</strong>
            <span className="muted">· {formatTime(photo.uploadedAt)}</span>
            {photo.onTime != null && (
              <span className={`chip ${photo.onTime ? 'chip--green' : 'chip--orange'} kr-meal__ontime`}>
                {photo.onTime ? 'Đúng giờ' : 'Ngoài giờ'}
              </span>
            )}
          </>
        ) : (
          <span className="muted">Người đăng: —</span>
        )}
      </div>
      <p className="kr-meal__menu" title={dishes}>
        <strong>Thực đơn:</strong> {dishes}
      </p>
      <div className="kr-meal__chips">
        <span className="chip chip--gray">
          {session.servingsNormal == null
            ? 'Chưa chốt suất'
            : `${session.servingsNormal} thường${session.servingsSubstitute ? ` · ${session.servingsSubstitute} thay thế` : ''}`}
        </span>
        {sample && <span className="chip chip--gray">{sample}</span>}
      </div>
    </section>
  );
}
