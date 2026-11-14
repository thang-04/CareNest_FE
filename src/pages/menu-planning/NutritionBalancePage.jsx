import { useEffect, useMemo, useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { Link, useSearchParams } from 'react-router-dom';
import { Save, RotateCcw, Info, Scale, CopyPlus } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  useAllergyContext,
  useCatalogAccess,
  useMenuAccess,
  useMenuCatalog,
  useWeeklyMenu,
  useWeeklyMenus,
} from '@/hooks/menu-planning/useMenuPlanning';
import { menuDishesSavable, saveDayAdjustment, saveDish } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { NormStatusChip, WeeklyStatusBadge } from '@/components/menu-planning/MenuBadges';
import { DayNutritionTable } from '@/components/menu-planning/DayNutritionTable';
import { MealEditor } from '@/components/menu-planning/MealEditor';
import { NutritionTable } from '@/components/menu-planning/NutritionTable';
import { AllergenWarnings } from '@/components/menu-planning/AllergenWarnings';
import {
  badPortionQty as badQty,
  compareToNorm,
  ingredientBreakdown,
  ingredientQty,
  mealsTotals,
  normalizeMeals,
  overallNormStatus,
  priceOn,
  withPortionDraft as withDraftQty,
} from '@/utils/menu-planning/menuCalculations';
import { validateMenu } from '@/utils/menu-planning/menuPlanningValidation';
import { canEditWeeklyMenu, canReplaceWeeklyMenu } from '@/utils/menu-planning/menuPlanningPermissions';
import { menuCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { formatDate, todayInput } from '@/utils/format';
import { AGE_GROUPS, ageGroupById } from '@/models/School';
import { FOOD_ORIGIN_LABELS, WEEKDAY_LABELS, WEEKLY_STATUS, mondayOf, weekLabel } from '@/models/menu-planning/menuPlanningConstants';
import { mealCodesOf, mealLabel, mealsOf, normScopeMeals } from '@/utils/menu-planning/nutritionSetup';
import { isDemoModule } from '@/services/demoSource';
import DayBalancePage from '@/pages/menu-planning/DayBalancePage';
import '@/styles/modules/menu-planning.css';

const clone = (v) => JSON.parse(JSON.stringify(v || []));
const num = (v) => (Number(v) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 });

/**
 * Screen #87 – nutrition of each day of a weekly menu against the age-group reference; the Vice Principal
 * (shared services) adjusts dishes or portions of a draft day and the values are recalculated (UC 6.11).
 * Định lượng từng thực phẩm của món đang xem sửa thử được ngay trên màn (chỉ tính ở trình duyệt); lưu vào món khi bấm lưu.
 */
function LegacyNutritionBalance() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const access = useMenuAccess();
  const catalogAccess = useCatalogAccess();
  const { catalog: savedCatalog, loading: catLoading, reload: reloadCatalog } = useMenuCatalog();
  const [ageGroupId, setAgeGroupId] = useState(params.get('ageGroupId') || '');
  const { items: weeks, loading: weeksLoading } = useWeeklyMenus({ ageGroupId });
  const candidates = useMemo(() => weeks.filter((w) => w.status !== WEEKLY_STATUS.REPLACED), [weeks]);
  const weeklyMenuId = params.get('weeklyMenuId') || '';
  const { item: wm, loading, error, reload } = useWeeklyMenu(weeklyMenuId, { live: false });
  const [date, setDate] = useState(params.get('date') || '');
  const [meals, setMeals] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  // Định lượng thử: { [dishId]: { [foodId]: chuỗi g/trẻ } } cho nhóm tuổi của thực đơn tuần
  const [qtyDrafts, setQtyDrafts] = useState({});
  const [reviewDishId, setReviewDishId] = useState('');
  const [dishBusy, setDishBusy] = useState(false);
  const [view, setView] = useState('meals');
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
    setQtyDrafts({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wm]);

  // Danh mục dùng để tính: món có định lượng thử thay cho món đã lưu (thẻ ngày, bảng cân đối đổi ngay)
  const catalog = useMemo(() => {
    const ids = Object.keys(qtyDrafts).filter((id) => savedCatalog.dishById[id]);
    if (!wm || !ids.length) return savedCatalog;
    const dishById = { ...savedCatalog.dishById };
    ids.forEach((id) => (dishById[id] = withDraftQty(dishById[id], qtyDrafts[id], wm.ageGroupId)));
    return { ...savedCatalog, dishById };
  }, [savedCatalog, qtyDrafts, wm]);

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
    JSON.stringify(normalizeMeals(meals, mealCodesOf(catalog.nutritionSetups, wm.ageGroupId))) !==
      JSON.stringify(normalizeMeals(savedDay.meals, mealCodesOf(catalog.nutritionSetups, wm.ageGroupId)));
  const result =
    wm && savedDay
      ? mealsTotals(normScopeMeals(meals, catalog.nutritionSetups, wm.ageGroupId), catalog.dishById, catalog.foodById, wm.ageGroupId)
      : null;
  // Tóm tắt ngày đang sửa (theo món chưa lưu) cho đầu thẻ chi tiết
  const liveRows = result ? compareToNorm(result.totals, wm.ageGroupId, result.missing.length > 0, catalog.norms) : [];
  const liveKcal = liveRows.find((r) => r.key === 'kcal');
  const live = result ? { kcal: result.totals.kcal, attainment: liveKcal?.attainment, status: overallNormStatus(liveRows) } : null;
  const errors = wm
    ? validateMenu(
        { name: 'x', ageGroupId: wm.ageGroupId, meals: normalizeMeals(meals, mealCodesOf(catalog.nutritionSetups, wm.ageGroupId)) },
        [],
        mealsOf(catalog.nutritionSetups, wm.ageGroupId),
      )
    : {};

  // Món của ngày đang xem để sửa thử định lượng
  const dayDishIds = [...new Set(meals.flatMap((m) => (m.items || []).map((i) => i.dishId)).filter((id) => savedCatalog.dishById[id]))];
  const reviewId = dayDishIds.includes(reviewDishId) ? reviewDishId : dayDishIds[0] || '';
  const reviewDish = reviewId ? catalog.dishById[reviewId] : null;
  const reviewDraft = qtyDrafts[reviewId] || {};
  const reviewBreakdown = reviewDish && wm ? ingredientBreakdown(reviewDish, catalog.foodById, wm.ageGroupId) : null;
  const reviewDirty = Object.keys(reviewDraft).length > 0;
  const reviewInvalid = Object.values(reviewDraft).some(badQty);
  const canSaveDish = catalogAccess.canManage && menuDishesSavable();

  const setQty = (foodId, value) =>
    setQtyDrafts((all) => {
      const saved = savedCatalog.dishById[reviewId]?.ingredients.find((i) => i.foodId === foodId);
      const before = ingredientQty(saved, wm.ageGroupId);
      const d = { ...(all[reviewId] || {}) };
      // Trả về đúng số đã lưu thì không còn là thay đổi
      if (String(before ?? '') === value) delete d[foodId];
      else d[foodId] = value;
      const next = { ...all, [reviewId]: d };
      if (!Object.keys(d).length) delete next[reviewId];
      return next;
    });
  const resetDish = () =>
    setQtyDrafts((all) => {
      const { [reviewId]: _drop, ...rest } = all;
      return rest;
    });

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

  const saveDishQty = async () => {
    const dish = savedCatalog.dishById[reviewId];
    setDishBusy(true);
    try {
      await saveDish(reviewId, withDraftQty(dish, reviewDraft, wm.ageGroupId), user);
      toast.success(`Đã lưu định lượng món ${dish.name}.`);
      resetDish();
      await reloadCatalog({ silent: true });
    } catch (err) {
      toast.error(err, 'Không lưu được định lượng');
    } finally {
      setDishBusy(false);
    }
  };

  if (access.loading || catLoading) return <LoadingState />;

  return (
    <div className="page">
      <Breadcrumb items={menuCrumbs('Cân đối dinh dưỡng')} />
      <h1 className="page__title">Cân đối khẩu phần thực đơn ngày</h1>
      {/* Thanh chọn cùng kiểu Thực đơn tuần: tab nhóm tuổi + chọn thực đơn tuần */}
      <div className="td-week-toolbar">
        <Tabs
          variant="pill"
          items={[{ id: '', shortName: 'Tất cả' }, ...AGE_GROUPS].map((g) => ({ key: g.id, label: g.shortName }))}
          value={ageGroupId}
          onChange={(id) => {
            setAgeGroupId(id);
            chooseWeek('');
          }}
          ariaLabel="Nhóm tuổi"
        />
        <div className="td-week-picker">
          <select
            className="select td-week-menu-select"
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
        <div className="card">
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
          <div className="row td-week-bar">
            <div className="row td-week-status">
              <WeeklyStatusBadge status={wm.status} />
              <span className="text-sm muted">
                <Link to={`/menu/weekly/${wm.id}`}>{wm.code}</Link> · {ageGroupById(wm.ageGroupId)?.name} · tuần {weekLabel(wm.weekStart)}
              </span>
            </div>
          </div>
          <DayNutritionTable wm={wm} catalog={catalog} date={date} meals={meals} onSelect={selectDay} />

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
            <section className="card mt-16">
              <div className="card__header td-wrap-head">
                <h2 className="card__title">
                  {WEEKDAY_LABELS[wm.days.indexOf(savedDay)]} {formatDate(date)}
                </h2>
                {/* Tóm tắt luôn hiện dù đang ở tab nào: sửa món ở tab này, số liệu đổi ngay ở đây */}
                <div className="td-day-live">
                  {live && (
                    <>
                      <span className="td-tag td-tag--orange">{num(live.kcal)} kcal</span>
                      {live.attainment != null && <span className="text-sm muted">{live.attainment}% định mức</span>}
                      <NormStatusChip status={live.status} />
                    </>
                  )}
                  {(dirty || Object.keys(qtyDrafts).length > 0) && <span className="chip chip--orange">Chưa lưu</span>}
                  {editable && (
                    <>
                      <button type="button" className="btn" disabled={!dirty || busy} onClick={() => selectDay(savedDay)}>
                        <RotateCcw size={16} /> Khôi phục
                      </button>
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={!dirty || busy || Object.keys(errors).length > 0}
                        onClick={save}
                      >
                        {busy ? <Spinner small /> : <Save size={16} />} Lưu điều chỉnh
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="td-day-tabs">
                <div className="tabs" role="tablist" aria-label="Nội dung ngày">
                  {[
                    ['meals', 'Món và khẩu phần'],
                    ['result', 'Kết quả tính lại'],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={view === key}
                      className={`tab ${view === key ? 'tab--active' : ''}`}
                      onClick={() => setView(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card__body" role="tabpanel">
                {view === 'meals' ? (
                  <MealEditor
                    meals={meals}
                    sessions={mealCodesOf(catalog.nutritionSetups, wm.ageGroupId)}
                    onChange={setMeals}
                    catalog={catalog}
                    ageGroupId={wm.ageGroupId}
                    errors={errors}
                    disabled={!access.canManage}
                  />
                ) : (
                  <>
                    <AllergenWarnings meals={meals} catalog={catalog} ageGroupId={wm.ageGroupId} contextRows={allergyRows} />
                    <NutritionTable
                      result={result}
                      ageGroupId={wm.ageGroupId}
                      norms={catalog.norms}
                      setups={catalog.nutritionSetups}
                      price={priceOn(catalog.mealPrices, wm.ageGroupId, date)?.price}
                    />
                    <div className="table-wrap mt-12">
                      <table className="table table--grid table--compact">
                        <thead>
                          <tr>
                            <th>Bữa</th>
                            <th className="num">Năng lượng</th>
                            <th className="num td-col-p">Đạm ĐV / TV (g)</th>
                            <th className="num td-col-l">Béo ĐV / TV (g)</th>
                            <th className="num td-col-g">Tinh bột (g)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(result.bySession).map(([s, t]) => (
                            <tr key={s}>
                              <td>{mealLabel(catalog.nutritionSetups, wm.ageGroupId, s)}</td>
                              <td className="num">{num(t.kcal)} kcal</td>
                              <td className="num">
                                {num(t.animalProtein)} / {num(t.plantProtein)}
                              </td>
                              <td className="num">
                                {num(t.animalLipid)} / {num(t.plantLipid)}
                              </td>
                              <td className="num">{num(t.glucid)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {savedDay && reviewBreakdown && (
            <section className="card mt-16">
              <div className="card__header td-wrap-head">
                <h2 className="card__title">Định lượng món đang xem (g / trẻ · {ageGroupById(wm.ageGroupId)?.shortName})</h2>
                <select className="select" value={reviewId} aria-label="Món đang xem" onChange={(e) => setReviewDishId(e.target.value)}>
                  {dayDishIds.map((id) => (
                    <option key={id} value={id}>
                      {savedCatalog.dishById[id].name}
                      {qtyDrafts[id] ? ' (đang sửa thử)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="card__body">
                <p className="text-sm muted td-flat mb-8">
                  Sửa thử định lượng để xem ngay kết quả cân đối (chưa lưu). Lưu định lượng sẽ đổi món ở mọi thực đơn dùng món này.
                </p>
                <div className="table-wrap">
                  <table className="table table--grid table--compact">
                    <thead>
                      <tr>
                        <th>Thực phẩm</th>
                        <th>Nguồn gốc</th>
                        <th className="num">Định lượng (g/trẻ)</th>
                        <th className="num">Đạm ĐV</th>
                        <th className="num">Đạm TV</th>
                        <th className="num">Béo ĐV</th>
                        <th className="num">Béo TV</th>
                        <th className="num">Tinh bột</th>
                        <th className="num">kcal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviewBreakdown.rows.map((r) => {
                        const draft = reviewDraft[r.foodId];
                        const value = draft !== undefined ? draft : r.qty == null ? '' : String(r.qty);
                        const missingData = r.noNutrition || r.noOrigin;
                        return (
                          <tr key={r.foodId}>
                            <td>{r.food?.name || 'Thực phẩm đã xóa'}</td>
                            <td>{FOOD_ORIGIN_LABELS[r.food?.origin] || <span className="td-warn">Chưa có</span>}</td>
                            <td className="num">
                              <input
                                className={`input td-qty ${badQty(value) ? 'is-invalid' : ''}`}
                                inputMode="decimal"
                                value={value}
                                aria-label={`Định lượng ${r.food?.name || ''}`}
                                onChange={(e) => setQty(r.foodId, e.target.value.replace(',', '.'))}
                              />
                            </td>
                            {missingData && r.qty != null ? (
                              <td colSpan={6} className="td-warn text-sm">
                                {r.noNutrition ? 'Chưa có số liệu dinh dưỡng' : 'Chưa có nguồn gốc'} – chưa đủ dữ liệu
                              </td>
                            ) : (
                              <>
                                <td className="num">{num(r.animalProtein)}</td>
                                <td className="num">{num(r.plantProtein)}</td>
                                <td className="num">{num(r.animalLipid)}</td>
                                <td className="num">{num(r.plantLipid)}</td>
                                <td className="num">{num(r.glucid)}</td>
                                <td className="num">{num(r.kcal)}</td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2}>Một suất</td>
                        <td className="num">{num(reviewBreakdown.total.qty)}</td>
                        <td className="num">{num(reviewBreakdown.total.animalProtein)}</td>
                        <td className="num">{num(reviewBreakdown.total.plantProtein)}</td>
                        <td className="num">{num(reviewBreakdown.total.animalLipid)}</td>
                        <td className="num">{num(reviewBreakdown.total.plantLipid)}</td>
                        <td className="num">{num(reviewBreakdown.total.glucid)}</td>
                        <td className="num">{num(reviewBreakdown.total.kcal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {reviewInvalid && <span className="field__error">Định lượng từ 0 đến 1000 g; ô sai không được tính.</span>}
                {!canSaveDish && reviewDirty && (
                  <p className="text-sm muted mt-8">
                    {catalogAccess.canManage
                      ? 'Thực đơn tuần còn dữ liệu demo nên chưa lưu định lượng ở đây được; hãy sửa ở danh mục Món ăn.'
                      : 'Bạn chỉ sửa thử để xem số liệu; lưu định lượng món do người được giao quản lý danh mục thực hiện.'}
                  </p>
                )}
                <div className="row mt-12">
                  <button type="button" className="btn" disabled={!reviewDirty || dishBusy} onClick={resetDish}>
                    <RotateCcw size={16} /> Bỏ định lượng thử
                  </button>
                  {canSaveDish && (
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={!reviewDirty || reviewInvalid || dishBusy}
                      onClick={saveDishQty}
                    >
                      {dishBusy ? <Spinner small /> : <Save size={16} />} Lưu định lượng vào món
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {saveError && (
            <div className="alert alert--danger mt-16">
              <Info size={18} />
              <div>Không lưu được thay đổi: {saveError}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Nối BE kế hoạch tuần ⇒ cân đối trên dữ liệu thật (dùng chung nội dung modal Sửa ngày); chế độ mock giữ màn demo cũ
export default function NutritionBalancePage() {
  return isDemoModule('meal-plan') ? <LegacyNutritionBalance /> : <DayBalancePage />;
}
