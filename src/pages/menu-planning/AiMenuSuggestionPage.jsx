import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, Wand2, XCircle, PencilLine, AlertOctagon, Info } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAllergyContext, useMenuAccess, useMenuCatalog, useWeeklyMenus } from '@/hooks/menu-planning/useMenuPlanning';
import { dismissAiDraft, generateAiSuggestion } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { FormField } from '@/components/form/FormField';
import { LoadingState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import { useAiRun } from '@/hooks/useAiRun';
import { AiDraftLabel, AllergenChips, NoManageAccess } from '@/components/menu-planning/MenuBadges';
import { MealsView } from '@/components/menu-planning/MealsView';
import { NutritionTable } from '@/components/menu-planning/NutritionTable';
import { AllergenWarnings } from '@/components/menu-planning/AllergenWarnings';
import { WeekDaysView } from '@/components/menu-planning/WeekDaysView';
import { WeekChecks } from '@/components/menu-planning/WeekChecks';
import { mealsTotals, priceOn } from '@/utils/menu-planning/menuCalculations';
import { menuCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { todayInput } from '@/utils/format';
import { activeAgeGroups } from '@/utils/menu-planning/nutritionSetup';
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
  const { running: busy, run: runAi } = useAiRun();
  const [showResult, setShowResult] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { rows: allergyRows } = useAllergyContext(ageGroupId);
  const { items: sameGroup } = useWeeklyMenus({ ageGroupId: ageGroupId || '__none__' });

  const generate = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (!ageGroupId) return;
    setFailure(null);
    setDraft(null);
    try {
      const d = await runAi(() => generateAiSuggestion({ kind, ageGroupId, weekStart, avoidAllergens }, user));
      setDraft(d);
      setShowResult(true);
    } catch (err) {
      setFailure(err);
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

  const resultBody = draft && (
    <>
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
          <MealsView meals={draft.meals} catalog={catalog} ageGroupId={draft.ageGroupId} linkDishes />
          <div className="mt-16">
            <AllergenWarnings meals={draft.meals} catalog={catalog} ageGroupId={draft.ageGroupId} contextRows={allergyRows} />
            <NutritionTable result={dayResult} ageGroupId={draft.ageGroupId} norms={catalog.norms} price={draft.mealPrice} />
          </div>
        </>
      )}
    </>
  );
  const resultActions = (
    <>
      <button type="button" className="btn" onClick={dismiss}>
        <XCircle size={16} /> Bỏ qua gợi ý
      </button>
      <button type="button" className="btn btn--primary" onClick={() => navigate(usePath)}>
        <PencilLine size={16} /> Xem xét và chỉnh sửa trong biểu mẫu
      </button>
    </>
  );

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
                {activeAgeGroups(catalog.nutritionSetups).map((g) => (
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
              <span className="text-sm td-pt-2">
                {ageGroupId
                  ? `${formatMoney(priceOn(catalog.mealPrices, ageGroupId, kind === AI_DRAFT_KIND.WEEKLY ? weekStart : todayInput())?.price ?? null)} / trẻ / ngày`
                  : '—'}
              </span>
            </div>
          </div>
        </div>
        <div className="card__body row row--between td-card-foot">
          <Link className="btn" to={manualPath}>
            <PencilLine size={16} /> Lập thủ công
          </Link>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            <Wand2 size={16} /> Tạo gợi ý
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
            <div className="row gap-3">
              <div className="card__title">
                <Sparkles size={16} /> Kết quả gợi ý
              </div>
              <AiDraftLabel />
            </div>
          </div>
          <div className="card__body">{resultBody}</div>
          <div className="card__body row row--between td-card-foot">{resultActions}</div>
        </div>
      )}
      {/* AI xong ⇒ mở kết quả trong modal; đóng modal thì khối kết quả trên trang vẫn còn để xử lý sau (user chốt) */}
      <Modal
        open={!!draft && showResult}
        onClose={() => setShowResult(false)}
        size="xl"
        title="Kết quả gợi ý của AI"
        footer={<div className="row row--between td-card-foot w-full">{resultActions}</div>}
      >
        <div className="row gap-3 mb-12">
          <AiDraftLabel />
        </div>
        {resultBody}
      </Modal>
      {busy && <AiWorkingOverlay kind="cooking" text="Đang nấu gợi ý thực đơn…" />}
    </div>
  );
}
