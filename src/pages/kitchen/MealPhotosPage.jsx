import { Link, useSearchParams } from 'react-router-dom';
import { Clock } from '@/components/ui/icons';
import { Breadcrumb, EmptyState, ErrorState, LoadingState } from '@/components';
import { KbCampusFilter, KbDateFilter } from '@/components/kitchen/KitchenFilters';
import { useStockCampus } from '@/hooks/kitchen/useDryStock';
import { useMealPhotos, useMealPhotoUrl } from '@/hooks/kitchen/useKitchenRecords';
import { KITCHEN_RECORD_PAGES, MEAL_SESSION_LABELS } from '@/models/kitchen/kitchenRecordConstants';
import { bySession } from '@/utils/kitchen/kitchenRecords';
import { kitchenCrumbs } from '@/utils/kitchen/breadcrumbs';
import { formatDate, formatDateTime, formatFileSize, isIsoDate, todayInput } from '@/utils/format';
import '@/styles/modules/kitchen.css';
import '@/styles/modules/kitchen-records.css';

function PhotoCard({ photo }) {
  const image = useMealPhotoUrl(photo.id);
  const label = MEAL_SESSION_LABELS[photo.session] || photo.session;
  return (
    <section className="card" aria-label={label}>
      <div className="card__header">
        <h2 className="card__title">{label}</h2>
      </div>
      <div className="card__body kb-stack kb-stack--tight">
        <div className="kr-photo__frame">
          {image.loading && <LoadingState text="Đang tải ảnh..." />}
          {image.error && <ErrorState error={image.error} />}
          {image.url && <img className="kr-photo__img" src={image.url} alt={`Ảnh ${label.toLowerCase()} ngày ${formatDate(photo.date)}`} />}
        </div>
        <p className="text-xs muted">
          Đăng lúc {formatDateTime(photo.uploadedAt)} · {formatFileSize(photo.sizeBytes)}
        </p>
      </div>
    </section>
  );
}

/** Ảnh bữa ăn (`/kitchen/meal-photos`): ảnh bếp đăng theo điểm trường và ngày, tải nội dung qua client có token. */
export default function MealPhotosPage() {
  const [params, setParams] = useSearchParams();
  const campus = useStockCampus();
  const date = isIsoDate(params.get('date')) ? params.get('date') : todayInput();
  const photos = useMealPhotos(campus.campusId, date);

  const setDate = (next) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('date', next);
        return p;
      },
      { replace: true },
    );

  let body;
  if (campus.error) body = <ErrorState error={campus.error} onRetry={campus.reload} />;
  else if (campus.loading) body = <LoadingState />;
  else if (!campus.campusId)
    body = <EmptyState title="Chưa có điểm trường" description="Tài khoản chưa được gán điểm trường để xem ảnh bữa ăn." />;
  else if (photos.error) body = <ErrorState error={photos.error} onRetry={photos.reload} />;
  else if (photos.loading || !photos.data) body = <LoadingState />;
  else if (!photos.data.length)
    body = (
      <section className="card">
        <EmptyState title="Chưa có ảnh bữa ăn" description={`Bếp chưa đăng ảnh nào cho ngày ${formatDate(date)}.`} />
      </section>
    );
  else
    body = (
      <div className="kr-photos">
        {[...photos.data].sort(bySession).map((photo) => (
          <PhotoCard key={photo.id} photo={photo} />
        ))}
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_RECORD_PAGES.mealPhotos)} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Ảnh bữa ăn</h1>
        </div>
      </div>
      <div className="kb-toolbar">
        <KbDateFilter value={date} onChange={setDate} />
        {campus.campusId && <KbCampusFilter campusId={campus.campusId} onChange={campus.setCampusId} canPick={campus.canPick} />}
        <div className="kb-toolbar__end">
          <Link className="btn" to={KITCHEN_RECORD_PAGES.photoWindows.to}>
            <Clock size={16} /> Khung giờ đăng ảnh
          </Link>
        </div>
      </div>
      {body}
    </div>
  );
}
