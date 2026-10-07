import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Save, RotateCcw, Info, Scale, CopyPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAllergyContext, useMenuAccess, useMenuCatalog, useWeeklyMenu, useWeeklyMenus } from '@/hooks/menu-planning/useMenuPlanning';
import { saveDayAdjustment } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { NormStatusChip, WeeklyStatusBadge } from '@/components/menu-planning/MenuBadges';
import { MealEditor } from '@/components/menu-planning/MealEditor';
import { NutritionTable } from '@/components/menu-planning/NutritionTable';
import { AllergenWarnings } from '@/components/menu-planning/AllergenWarnings';
import { dayNormStatus } from '@/components/menu-planning/WeekDaysView';
import { compareToNorm, mealsTotals, normalizeMeals, priceOn } from '@/utils/menu-planning/menuCalculations';
import { validateMenu } from '@/utils/menu-planning/menuPlanningValidation';
import { canEditWeeklyMenu, canReplaceWeeklyMenu } from '@/utils/menu-planning/menuPlanningPermissions';
import { menuCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { formatDate, todayInput } from '@/utils/format';
import { AGE_GROUPS, ageGroupById } from '@/models/School';
import {
  MEAL_SESSION_LABELS,
  WEEKDAY_LABELS,
  WEEKLY_STATUS,
  mondayOf,
  sessionsOf,
  weekLabel,
} from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const clone = (v) => JSON.parse(JSON.stringify(v || []));
const num = (v) => (Number(v) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 });

/**
 * Screen #87 – nutrition of each day of a weekly menu against the age-group reference; the Vice Principal
 * (shared services) adjusts dishes or portions of a draft day and the values are recalculated (UC 6.11).
 */
export default function NutritionBalancePage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const access = useMenuAccess();
  const { catalog, loading: catLoading } = useMenuCatalog();
  const [ageGroupId, setAgeGroupId] = useState(params.get('ageGroupId') || '');
  const { items: weeks, loading: weeksLoading } = useWeeklyMenus({ ageGroupId });
  const candidates = useMemo(() => weeks.filter((w) => w.status !== WEEKLY_STATUS.REPLACED), [weeks]);
  const weeklyMenuId = params.get('weeklyMenuId') || '';
  const { item: wm, loading, error, reload } = useWeeklyMenu(weeklyMenuId, { live: false });
  const [date, setDate] = useState(params.get('date') || '');
  const [meals, setMeals] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const { rows: allergyRows } = useAllergyContext(wm?.ageGroupId || '');

  // Default: the coming draft, else this week's published menu.
  useEffect(() => {
    if (weeklyMenuId || weeksLoading || !candidates.length) return;
    const thisWeek = mondayOf(todayInput());
    const pick =
      candidates.find((w) => w.status === WEEKLY_STATUS.DRAFT && w.weekStart >= thisWeek) ||
      candidates.find((w) => w.weekStart === thisWeek) ||
      candidates[0];
    setParams({ weeklyMenuId: pick.id }, { replace: true });
  }, [weeklyMenuId, weeksLoading, candidates, setParams]);

  useEffect(() => {
    if (!wm) return;
    if (!ageGroupId) setAgeGroupId(wm.ageGroupId);
    const day = wm.days.find((d) => d.date === date && !d.holiday) || wm.days.find((d) => !d.holiday);
    if (day) {
      setDate(day.date);
      setMeals(clone(day.meals));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wm]);

  const selectDay = (d) => {
    setDate(d.date);
    setMeals(clone(d.meals));
    setSaveError('');
  };
  const chooseWeek = (id) => {
    setDate('');
    setParams(id ? { weeklyMenuId: id } : {});
  };

  const accessData = { sharedService: access.sharedService };
  const editable = wm && canEditWeeklyMenu(wm, user, accessData);
  const savedDay = wm?.days.find((d) => d.date === date);
  const dirty =
    savedDay &&
    JSON.stringify(normalizeMeals(meals, sessionsOf(wm.ageGroupId))) !==
      JSON.stringify(normalizeMeals(savedDay.meals, sessionsOf(wm.ageGroupId)));
  const result = wm && savedDay ? mealsTotals(meals, catalog.dishById, catalog.foodById, wm.ageGroupId) : null;
  const errors = wm ? validateMenu({ name: 'x', ageGroupId: wm.ageGroupId, meals: normalizeMeals(meals, sessionsOf(wm.ageGroupId)) }) : {};

  const save = async () => {
    setBusy(true);
    setSaveError('');
    try {
      await saveDayAdjustment(wm.id, date, meals, user);
      toast.success('Lưu thay đổi thành công.');
      await reload({ silent: true });
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (access.loading || catLoading) return <LoadingState />;

  return (
    <div className="page">
      <Breadcrumb items={menuCrumbs('Cân đối dinh dưỡng')} />
      <h1 className="page__title">Cân đối dinh dưỡng thực đơn ngày</h1>
      <div className="card">
        <div className="filter-bar">
          <select
            className="select"
            value={ageGroupId}
            onChange={(e) => {
              setAgeGroupId(e.target.value);
              chooseWeek('');
            }}
            aria-label="Nhóm tuổi"
          >
            <option value="">Tất cả nhóm tuổi</option>
            {AGE_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ minWidth: 320 }}
            value={weeklyMenuId}
            onChange={(e) => chooseWeek(e.target.value)}
            aria-label="Thực đơn tuần"
          >
            <option value="">Chọn thực đơn tuần</option>
            {candidates.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} · {weekLabel(w.weekStart)} · {ageGroupById(w.ageGroupId)?.shortName} ·{' '}
                {w.status === WEEKLY_STATUS.DRAFT ? 'Bản nháp' : 'Đã xuất bản'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!weeklyMenuId ? (
        <div className="card mt-16">
          <EmptyState
            icon={Scale}
            title="Chọn một thực đơn tuần"
            description="Chọn nhóm tuổi và thực đơn tuần để xem dinh dưỡng từng ngày so với định mức."
            action={
              <Link className="btn" to="/menu/weekly">
                Mở danh sách thực đơn tuần
              </Link>
            }
          />
        </div>
      ) : loading ? (
        <LoadingState />
      ) : error || !wm ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <div className="row mt-16 mb-12" style={{ gap: 12 }}>
            <div className="section-title" style={{ margin: 0 }}>
              <Link to={`/menu/weekly/${wm.id}`}>{wm.code}</Link> · {ageGroupById(wm.ageGroupId)?.name} · tuần {weekLabel(wm.weekStart)}
            </div>
            <WeeklyStatusBadge status={wm.status} />
          </div>
          <div className="td-week-cards" role="tablist" aria-label="Ngày trong tuần">
            {wm.days.map((d, i) => {
              const r = d.holiday
                ? null
                : mealsTotals(d.date === date ? meals : d.meals, catalog.dishById, catalog.foodById, wm.ageGroupId);
              const status = r ? dayNormStatus(compareToNorm(r.totals, wm.ageGroupId, r.missing.length > 0)) : null;
              return (
                <button
                  key={d.date}
                  type="button"
                  role="tab"
                  aria-selected={d.date === date}
                  className={`td-day-card ${d.date === date ? 'td-day-card--active' : ''}`}
                  disabled={d.holiday}
                  onClick={() => selectDay(d)}
                >
                  <span className="fw-600">
                    {WEEKDAY_LABELS[i]} · {formatDate(d.date)}
                  </span>
                  {d.holiday ? (
                    <span className="muted text-sm">Nghỉ: {d.note}</span>
                  ) : (
                    <>
                      <span className="td-kv">
                        <span>Năng lượng</span>
                        <b>{num(r.totals.kcal)} kcal</b>
                      </span>
                      <span className="td-kv">
                        <span>Đạm / Béo / Bột</span>
                        <span>
                          {num(r.totals.protein)} / {num(r.totals.lipid)} / {num(r.totals.glucid)} g
                        </span>
                      </span>
                      <NormStatusChip status={status} />
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {!editable && (
            <div className="alert alert--info mt-16">
              <Info size={18} />
              <div>
                {wm.status === WEEKLY_STATUS.DRAFT
                  ? 'Bạn chỉ xem được số liệu; điều chỉnh do Phó hiệu trưởng phụ trách dịch vụ chung thực hiện.'
                  : 'Thực đơn đã xuất bản nên không điều chỉnh trực tiếp. Bạn có thể thử thay món, khẩu phần để xem số liệu; muốn áp dụng hãy tạo phiên bản thay thế.'}{' '}
                {canReplaceWeeklyMenu(wm, user, accessData) && (
                  <Link to={`/menu/weekly/${wm.id}`}>
                    <CopyPlus size={14} /> Mở thực đơn để tạo phiên bản thay thế
                  </Link>
                )}
              </div>
            </div>
          )}

          {savedDay && (
            <div className="td-split mt-16">
              <div className="card">
                <div className="card__header">
                  <div className="card__title">
                    Món và khẩu phần – {WEEKDAY_LABELS[wm.days.indexOf(savedDay)]} {formatDate(date)}
                  </div>
                </div>
                <div className="card__body">
                  <MealEditor
                    meals={meals}
                    sessions={sessionsOf(wm.ageGroupId)}
                    onChange={setMeals}
                    catalog={catalog}
                    ageGroupId={wm.ageGroupId}
                    errors={errors}
                    disabled={!access.canManage}
                  />
                </div>
              </div>
              <div className="card">
                <div className="card__header">
                  <div className="card__title">Kết quả tính lại</div>
                  {dirty && <span className="chip chip--orange">Chưa lưu</span>}
                </div>
                <div className="card__body">
                  <AllergenWarnings meals={meals} catalog={catalog} contextRows={allergyRows} />
                  <NutritionTable
                    result={result}
                    ageGroupId={wm.ageGroupId}
                    price={priceOn(catalog.mealPrices, wm.ageGroupId, date)?.price}
                  />
                  <div className="table-wrap mt-12">
                    <table className="table table--compact">
                      <thead>
                        <tr>
                          <th>Bữa</th>
                          <th className="right">Năng lượng</th>
                          <th className="right">Đạm / Béo / Bột (g)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(result.bySession).map(([s, t]) => (
                          <tr key={s}>
                            <td>{MEAL_SESSION_LABELS[s]}</td>
                            <td className="right">{num(t.kcal)} kcal</td>
                            <td className="right">
                              {num(t.protein)} / {num(t.lipid)} / {num(t.glucid)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {saveError && (
            <div className="alert alert--danger mt-16">
              <Info size={18} />
              <div>Không lưu được thay đổi: {saveError}</div>
            </div>
          )}
          {editable && savedDay && (
            <div className="page-actions">
              <button type="button" className="btn" disabled={!dirty || busy} onClick={() => selectDay(savedDay)}>
                <RotateCcw size={16} /> Khôi phục số liệu đã lưu
              </button>
              <button type="button" className="btn btn--primary" disabled={!dirty || busy || Object.keys(errors).length > 0} onClick={save}>
                {busy ? <Spinner small /> : <Save size={16} />} Lưu điều chỉnh
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
