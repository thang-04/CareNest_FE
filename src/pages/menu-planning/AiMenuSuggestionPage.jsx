import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, Wand2, XCircle, PencilLine, AlertOctagon, Info } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAllergyContext, useMenuAccess, useMenuCatalog, useWeeklyMenus } from '@/hooks/menu-planning/useMenuPlanning';
import { dismissAiDraft, generateAiSuggestion } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { FormField } from '@/components/form/FormField';
import { LoadingState, Spinner } from '@/components/ui/States';
import { AiDraftLabel, AllergenChips, NoManageAccess } from '@/components/menu-planning/MenuBadges';
import { MealsView } from '@/components/menu-planning/MealsView';
import { NutritionTable } from '@/components/menu-planning/NutritionTable';
import { AllergenWarnings } from '@/components/menu-planning/AllergenWarnings';
import { WeekDaysView } from '@/components/menu-planning/WeekDaysView';
import { WeekChecks } from '@/components/menu-planning/WeekChecks';
import { mealsTotals, priceOn } from '@/utils/menu-planning/menuCalculations';
import { menuCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { todayInput } from '@/utils/format';
import { AGE_GROUPS } from '@/models/School';
import { AI_DRAFT_KIND, WEEKLY_STATUS, addDays, formatMoney, mondayOf } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const KIND_LABELS = { WEEKLY: 'Sắp xếp thực đơn Thứ Hai – Thứ Sáu', DAILY: 'Kết hợp món cho một ngày' };

/**
 * Screen #83 – optional AI suggestion (UC 6.9). The result is a draft labelled "Bản nháp AI – cần người duyệt";
 * nothing is saved or published until the Vice Principal opens it in the menu form, edits and saves it.
 */
export default function AiMenuSuggestionPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const access = useMenuAccess();
  const { catalog, loading: catLoading } = useMenuCatalog();
  const [kind, setKind] = useState(params.get('kind') === AI_DRAFT_KIND.DAILY ? AI_DRAFT_KIND.DAILY : AI_DRAFT_KIND.WEEKLY);
  const [ageGroupId, setAgeGroupId] = useState(params.get('ageGroupId') || '');
  const [weekStart, setWeekStart] = useState(params.get('weekStart') || addDays(mondayOf(todayInput()), 7));
  const [avoidAllergens, setAvoidAllergens] = useState(true);
  const [draft, setDraft] = useState(null);
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { rows: allergyRows } = useAllergyContext(ageGroupId);
  const { items: sameGroup } = useWeeklyMenus({ ageGroupId: ageGroupId || '__none__' });

  const generate = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (!ageGroupId) return;
    setBusy(true);
    setFailure(null);
    setDraft(null);
    try {
      const d = await generateAiSuggestion({ kind, ageGroupId, weekStart, avoidAllergens }, user);
      setDraft(d);
      toast.info('Bản nháp AI đã sẵn sàng để bạn xem xét.');
    } catch (err) {
      setFailure(err);
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async () => {
    try {
      await dismissAiDraft(draft.id, user);
    } catch {
      /* Dismissing is best effort: the draft is never applied anyway. */
    }
    setDraft(null);
    toast.info('Đã bỏ qua gợi ý. Không có thay đổi nào được áp dụng.');
  };

  const manualPath = kind === AI_DRAFT_KIND.WEEKLY ? '/menu/weekly/new' : '/menu/menus/new';
  const usePath = draft && `${draft.kind === AI_DRAFT_KIND.WEEKLY ? '/menu/weekly/new' : '/menu/menus/new'}?aiDraftId=${draft.id}`;

  if (access.loading || catLoading) return <LoadingState />;
  if (!access.canManage)
    return (
      <div className="page">
        <Breadcrumb items={menuCrumbs('Gợi ý thực đơn bằng AI')} />
        <h1 className="page__title">Gợi ý thực đơn bằng AI</h1>
        <NoManageAccess />
      </div>
    );

  const previous =
    draft?.kind === AI_DRAFT_KIND.WEEKLY &&
    sameGroup.find((w) => w.weekStart === addDays(draft.weekStart, -7) && w.status === WEEKLY_STATUS.PUBLISHED);
  const dayResult =
    draft?.kind === AI_DRAFT_KIND.DAILY ? mealsTotals(draft.meals, catalog.dishById, catalog.foodById, draft.ageGroupId) : null;

  return (
    <div className="page">
      <Breadcrumb items={menuCrumbs('Gợi ý thực đơn bằng AI')} />
      <h1 className="page__title">Gợi ý thực đơn bằng AI</h1>
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Gợi ý chỉ là bản nháp để tham khảo. Năng lượng, dị ứng và chi phí được tính lại bằng quy tắc cố định; bạn quyết định dùng, sửa hay
          bỏ qua. Không có thực đơn nào tự động được lưu hay xuất bản.
        </div>
      </div>
      <form className="card wizard-card" onSubmit={generate} noValidate>
        <div className="card__header">
          <div className="card__title">Yêu cầu gợi ý</div>
        </div>
        <div className="card__body">
          <div className="tabs mb-16" role="tablist">
            {Object.entries(KIND_LABELS).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                className={`tab ${kind === k ? 'tab--active' : ''}`}
                onClick={() => {
                  setKind(k);
                  setDraft(null);
                  setFailure(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="td-form-grid">
            <FormField label="Nhóm tuổi" required error={submitted && !ageGroupId ? 'Trường này là bắt buộc.' : undefined}>
              <select className="select" value={ageGroupId} onChange={(e) => setAgeGroupId(e.target.value)}>
                <option value="">Chọn nhóm tuổi</option>
                {AGE_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </FormField>
            {kind === AI_DRAFT_KIND.WEEKLY ? (
              <FormField label="Tuần (Thứ Hai)" required hint="Ngày chọn được tự chuyển về Thứ Hai">
                <input
                  type="date"
                  className="input"
                  value={weekStart}
                  onChange={(e) => e.target.value && setWeekStart(mondayOf(e.target.value))}
                />
              </FormField>
            ) : (
              <div className="field">
                <span className="field__label">Ràng buộc dị ứng</span>
                <label className="checkbox">
                  <input type="checkbox" checked={avoidAllergens} onChange={(e) => setAvoidAllergens(e.target.checked)} /> Tránh các thành
                  phần trẻ trong nhóm tuổi bị dị ứng
                </label>
                {ageGroupId && (
                  <span className="field__hint">
                    {allergyRows.length
                      ? `Đã ghi nhận: ${allergyRows.map((r) => r.allergen).join(', ')}`
                      : 'Chưa ghi nhận dị ứng trong nhóm tuổi'}
                  </span>
                )}
              </div>
            )}
            <div className="field">
              <span className="field__label">Giá suất ăn áp dụng</span>
              <span className="text-sm" style={{ paddingTop: 8 }}>
                {ageGroupId
                  ? `${formatMoney(priceOn(catalog.mealPrices, ageGroupId, kind === AI_DRAFT_KIND.WEEKLY ? weekStart : todayInput())?.price ?? null)} / trẻ / ngày`
                  : '—'}
              </span>
            </div>
          </div>
        </div>
        <div className="card__body row row--between" style={{ borderTop: '1px solid var(--border)' }}>
          <Link className="btn" to={manualPath}>
            <PencilLine size={16} /> Lập thủ công
          </Link>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? <Spinner small /> : <Wand2 size={16} />} {busy ? 'Đang tạo gợi ý...' : 'Tạo gợi ý'}
          </button>
        </div>
      </form>

      {failure && (
        <div className="alert alert--danger mt-16" role="alert">
          <AlertOctagon size={18} />
          <div>
            {failure.status === 422 ? (
              <>Không tạo được gợi ý phù hợp: {failure.message} Hãy điều chỉnh đầu vào và thử lại.</>
            ) : (
              <>Dịch vụ AI hiện không khả dụng. Bạn có thể tiếp tục lập thủ công.</>
            )}{' '}
            <Link to={manualPath}>Lập thực đơn thủ công</Link>
          </div>
        </div>
      )}

      {draft && (
        <div className="card mt-16">
          <div className="card__header">
            <div className="row" style={{ gap: 12 }}>
              <div className="card__title">
                <Sparkles size={16} /> Kết quả gợi ý
              </div>
              <AiDraftLabel />
            </div>
          </div>
          <div className="card__body">
            {draft.generator === 'RULE_BASED_FALLBACK' && (
              <p className="text-sm muted mb-12">
                Gợi ý được tạo bằng quy tắc dự phòng đã duyệt (chưa phải mô hình AI đã được kiểm định), từ các{' '}
                {draft.kind === AI_DRAFT_KIND.WEEKLY ? 'thực đơn mẫu' : 'món ăn'} đang sử dụng.
              </p>
            )}
            {draft.kind === AI_DRAFT_KIND.WEEKLY ? (
              <>
                <WeekDaysView wm={draft} catalog={catalog} />
                <div className="subsection-title mt-16 mb-8">Kiểm tra quy tắc tuần</div>
                <WeekChecks wm={draft} catalog={catalog} previousDays={previous?.days || []} allergyRows={allergyRows} />
              </>
            ) : (
              <>
                {draft.restrictions?.length > 0 && (
                  <p className="text-sm mb-12">
                    Đã tránh: <AllergenChips allergens={draft.restrictions} />
                  </p>
                )}
                <MealsView meals={draft.meals} catalog={catalog} linkDishes />
                <div className="mt-16">
                  <AllergenWarnings meals={draft.meals} catalog={catalog} contextRows={allergyRows} />
                  <NutritionTable result={dayResult} ageGroupId={draft.ageGroupId} price={draft.mealPrice} />
                </div>
              </>
            )}
          </div>
          <div className="card__body row row--between" style={{ borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn" onClick={dismiss}>
              <XCircle size={16} /> Bỏ qua gợi ý
            </button>
            <button type="button" className="btn btn--primary" onClick={() => navigate(usePath)}>
              <PencilLine size={16} /> Xem xét và chỉnh sửa trong biểu mẫu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
