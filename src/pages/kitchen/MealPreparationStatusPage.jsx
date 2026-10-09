import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CookingPot } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useMealPreparations } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, EmptyState, ErrorState, LoadingState } from '@/components';
import { KbCampusFilter, KbDateFilter, KbSessionFilter } from '@/components/kitchen/KitchenFilters';
import { PreparationCard } from '@/components/kitchen/PreparationCard';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { todayInput } from '@/utils/format';
import '@/styles/modules/kitchen.css';

/** Screen #92 – Meal Preparation Status (UC 6.12): the Vice Principal follows the campus kitchen, read only. */
export default function MealPreparationStatusPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || todayInput();
  const [session, setSession] = useState('ALL');
  const [classId, setClassId] = useState('ALL');
  const campusId = user?.campusId;
  const { sessions, loading, error, reload } = useMealPreparations(campusId, date);

  const classes = useMemo(() => {
    const map = new Map();
    sessions.forEach((s) => s.classes.forEach((c) => map.set(c.classId, c.className)));
    return [...map.entries()];
  }, [sessions]);
  const visible = sessions.filter((s) => session === 'ALL' || s.session === session);

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.preparation)} />
      <h1 className="page__title">Tình trạng chế biến bữa ăn</h1>
      <div className="kb-toolbar">
        <KbDateFilter value={date} onChange={(d) => setParams({ date: d }, { replace: true })} />
        <KbSessionFilter value={session} onChange={setSession} withAll />
        <label className="date-filter">
          Lớp
          <select className="select" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="ALL">Tất cả lớp</option>
            {classes.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className="kb-toolbar__end">
          <KbCampusFilter campusId={campusId} canPick={false} />
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : visible.every((s) => !s.hasMenu) ? (
        <div className="card">
          <EmptyState
            icon={CookingPot}
            title="Không có dữ liệu cho ngày đã chọn"
            description="Ngày này không có bữa ăn theo thực đơn đã công bố. Chọn ngày khác."
          />
        </div>
      ) : (
        <div className="kb-sessions">
          {visible.map((s) => (
            <PreparationCard key={s.session} item={s} md={md} classId={classId} />
          ))}
        </div>
      )}
    </div>
  );
}
