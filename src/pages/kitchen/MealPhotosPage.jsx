import { Link, useSearchParams } from 'react-router-dom';
import { Clock } from '@/components/ui/icons';
import { Breadcrumb, EmptyState, ErrorState, LoadingState } from '@/components';
import { WeekPicker } from '@/components/form/WeekPicker';
import { KbCampusFilter } from '@/components/kitchen/KitchenFilters';
import { MealPhotoInspections } from '@/components/kitchen/MealPhotoInspections';
import { MealPhotoSessionCard } from '@/components/kitchen/MealPhotoSessionCard';
import { MealPhotoWeekStrip } from '@/components/kitchen/MealPhotoWeekStrip';
import { useAuth } from '@/contexts/AuthContext';
import { useStockCampus } from '@/hooks/kitchen/useDryStock';
import { useMealPhotoWeek } from '@/hooks/kitchen/useKitchenRecords';
import { KITCHEN_RECORD_PAGES, PHOTO_WINDOWS_SETTING_PATH } from '@/models/kitchen/kitchenRecordConstants';
import { isPrincipal } from '@/utils/kitchen/kitchenPermissions';
import { bySession } from '@/utils/kitchen/kitchenRecords';
import { kitchenCrumbs } from '@/utils/kitchen/breadcrumbs';
import { formatWeekdayDate, isIsoDate, todayInput } from '@/utils/format';
import { addDays, mondayOf } from '@/utils/week';
import '@/styles/modules/kitchen.css';
import '@/styles/modules/kitchen-records.css';

// Số ngày từ thứ Hai tới ngày đang xem (0–6)
const daysSinceMonday = (iso) => Math.round((new Date(`${iso}T00:00:00`) - new Date(`${mondayOf(iso)}T00:00:00`)) / 86400000);

/**
 * Ảnh bữa ăn (`/kitchen/meal-photos`): xem cả tuần của một điểm trường. Dải ngày cho biết ngày nào đủ hoặc thiếu ảnh, thẻ từng
 * bữa kèm người đăng, thực đơn, số suất, lưu mẫu; biên bản kiểm thực của ngày ở cuối. Trạng thái do BE tính.
 */
export default function MealPhotosPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const campus = useStockCampus();
  const today = todayInput();
  const date = isIsoDate(params.get('date')) ? params.get('date') : today;
  const weekStart = mondayOf(date);
  const week = useMealPhotoWeek(campus.campusId, weekStart);

  const setDate = (next) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('date', next);
        return p;
      },
      { replace: true },
    );
  // Đổi tuần: giữ cùng thứ trong tuần mới để dải ngày không nhảy về thứ Hai
  const setWeek = (nextMonday) => setDate(addDays(nextMonday, Math.min(4, daysSinceMonday(date))));

  const days = week.data?.days || [];
  // Thứ Bảy, Chủ nhật nằm ngoài dải 5 ngày: chọn thứ Sáu để vẫn có ngày đang xem
  const selected = days.find((d) => d.date === date) || days[days.length - 1];
  // Chỉ đếm trạng thái BE đã tính để hiển thị tiêu đề ngày
  const expectedSessions = (selected?.sessions || []).filter((s) => s.status !== 'NOT_EXPECTED');
  const expectedCount = expectedSessions.length;
  const postedCount = expectedSessions.filter((s) => s.status === 'POSTED').length;

  let body;
  if (campus.error) body = <ErrorState error={campus.error} onRetry={campus.reload} />;
  else if (campus.loading) body = <LoadingState />;
  else if (!campus.campusId)
    body = <EmptyState title="Chưa có điểm trường" description="Tài khoản chưa được gán điểm trường để xem ảnh bữa ăn." />;
  else if (week.error) body = <ErrorState error={week.error} onRetry={week.reload} />;
  else if (week.loading || !week.data) body = <LoadingState />;
  else if (!selected)
    body = (
      <section className="card">
        <EmptyState title="Chưa có dữ liệu tuần này" description="Chọn tuần khác để xem ảnh bữa ăn." />
      </section>
    );
  else
    body = (
      <>
        <MealPhotoWeekStrip days={days} value={selected.date} onChange={setDate} />
        <div className="kr-daybar">
          <h2 className="kr-daybar__title">{formatWeekdayDate(selected.date)}</h2>
          {selected.dayOff ? (
            <span className="muted">Ngày nghỉ</span>
          ) : (
            <span className="muted">
              {postedCount}/{expectedCount} bữa có ảnh
            </span>
          )}
        </div>
        <div className="kr-meals">
          {[...selected.sessions].sort(bySession).map((session) => (
            <MealPhotoSessionCard key={session.session} session={session} date={selected.date} />
          ))}
        </div>
        <MealPhotoInspections inspections={selected.inspections} />
      </>
    );

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_RECORD_PAGES.mealPhotos)} />
      <h1 className="page__title">Ảnh bữa ăn</h1>
      <div className="kb-toolbar kb-toolbar--center">
        <WeekPicker value={weekStart} onChange={setWeek} thisWeek={mondayOf(today)} />
        {campus.campusId && <KbCampusFilter campusId={campus.campusId} onChange={campus.setCampusId} canPick={campus.canPick} />}
        <div className="kb-toolbar__end">
          {isPrincipal(user) && (
            <Link className="btn" to={PHOTO_WINDOWS_SETTING_PATH}>
              <Clock size={16} /> Giờ đăng ảnh
            </Link>
          )}
        </div>
      </div>
      <div className="kb-stack">{body}</div>
    </div>
  );
}
