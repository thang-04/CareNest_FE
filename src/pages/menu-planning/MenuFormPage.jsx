import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAllergyContext, useMenuAccess, useMenuCatalog, useSampleMenu, useSampleMenus } from '@/hooks/menu-planning/useMenuPlanning';
import { getAiDraft, saveSampleMenu } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { FormField } from '@/components/form/FormField';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { AiDraftLabel, NoManageAccess } from '@/components/menu-planning/MenuBadges';
import { MealEditor } from '@/components/menu-planning/MealEditor';
import { NutritionTable } from '@/components/menu-planning/NutritionTable';
import { AllergenWarnings } from '@/components/menu-planning/AllergenWarnings';
import { mealsTotals, normalizeMeals, priceOn } from '@/utils/menu-planning/menuCalculations';
import { validateMenu, hasErrors } from '@/utils/menu-planning/menuPlanningValidation';
import { sampleMenuCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { todayInput } from '@/utils/format';
import { AGE_GROUPS } from '@/models/School';
import { RECORD_STATUS_LABELS, sessionsOf } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const EMPTY = { name: '', ageGroupId: '', note: '', status: 'ACTIVE', meals: [] };

/**
 * Screen #78 – the Vice Principal (shared services) selects or adjusts the dishes and portions of each meal;
 * the nutrition of the day is recalculated live and unmet references are flagged (UC 6.6, GBR-MENU-02/03).
 */
export default function MenuFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const access = useMenuAccess();
  const { catalog, loading: catLoading } = useMenuCatalog({ live: false });
  const { item, loading, error, reload } = useSampleMenu(id, { live: false });
  const { items: others } = useSampleMenus({});
  const [form, setForm] = useState(EMPTY);
  const [aiDraft, setAiDraft] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const { rows: allergyRows } = useAllergyContext(form.ageGroupId);
  const aiDraftId = params.get('aiDraftId');

  useEffect(() => {
    if (item) setForm({ name: item.name, ageGroupId: item.ageGroupId, note: item.note, status: item.status, meals: item.meals });
  }, [item]);

  useEffect(() => {
    if (id || !aiDraftId) return;
    getAiDraft(aiDraftId, user)
      .then((d) => {
        setAiDraft(d);
        setForm((f) => ({ ...f, ageGroupId: d.ageGroupId, meals: d.meals, name: f.name || 'Thực đơn từ gợi ý AI' }));
      })
      .catch((err) => toast.error(err.message, 'Không mở được bản nháp AI'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiDraftId, id]);

  const sessions = form.ageGroupId ? sessionsOf(form.ageGroupId) : [];
  const errors = { ...validateMenu({ ...form, id }, others), ...serverErrors };
  const show = (k) => (submitted ? errors[k] : undefined);
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setServerErrors({});
  };
  const changeAgeGroup = (ag) => {
    setServerErrors({});
    setForm((f) => ({ ...f, ageGroupId: ag, meals: ag ? normalizeMeals(f.meals, sessionsOf(ag)) : f.meals }));
  };
  const result = form.ageGroupId ? mealsTotals(form.meals, catalog.dishById, catalog.foodById, form.ageGroupId) : null;
  const price = form.ageGroupId ? priceOn(catalog.mealPrices, form.ageGroupId, todayInput())?.price : null;
  const title = id ? 'Sửa thực đơn mẫu' : 'Tạo thực đơn mẫu';

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (hasErrors(errors)) return;
    setBusy(true);
    try {
      const saved = await saveSampleMenu(id, { ...form, aiDraftId: aiDraft?.id }, user);
      toast.success('Lưu thay đổi thành công.');
      navigate(`/menu/menus/${saved.id}`);
    } catch (err) {
      if (err.details) setServerErrors(err.details);
      toast.error(err.message, 'Không lưu được thay đổi');
    } finally {
      setBusy(false);
    }
  };

  if (access.loading || loading || catLoading) return <LoadingState />;
  if (!access.canManage)
    return (
      <div className="page">
        <Breadcrumb items={sampleMenuCrumbs(title)} />
        <h1 className="page__title">{title}</h1>
        <NoManageAccess />
      </div>
    );
  if (id && error)
    return (
      <div className="page">
        <Breadcrumb items={sampleMenuCrumbs(title)} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={sampleMenuCrumbs(title)} />
      <div className="page__head">
        <div className="row" style={{ gap: 12 }}>
          <h1 className="page__title">{id ? `Sửa thực đơn ${item?.code || ''}` : title}</h1>
          {aiDraft && <AiDraftLabel />}
        </div>
        {!id && (
          <Link
            className="btn btn--outline-primary"
            to={`/menu/ai-suggestion?kind=DAILY${form.ageGroupId ? `&ageGroupId=${form.ageGroupId}` : ''}`}
          >
            <Sparkles size={16} /> Gợi ý bằng AI
          </Link>
        )}
      </div>
      {aiDraft && (
        <div className="alert alert--purple mb-16">
          <Sparkles size={18} />
          <div>
            Các món dưới đây do dịch vụ gợi ý tạo ra và <b>chưa có hiệu lực</b>. Hãy xem lại từng món, khẩu phần và cảnh báo dị ứng, chỉnh
            sửa nếu cần rồi bấm <b>Lưu thực đơn</b>.
          </div>
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <div className="card wizard-card">
          <div className="card__header">
            <div className="card__title">Thông tin thực đơn</div>
          </div>
          <div className="card__body td-form-grid">
            <FormField label="Tên thực đơn" required error={show('name')}>
              <input className="input" value={form.name} maxLength={120} onChange={(e) => set('name', e.target.value)} />
            </FormField>
            <FormField
              label="Nhóm tuổi"
              required
              error={show('ageGroupId')}
              hint={id ? 'Không đổi nhóm tuổi của thực đơn đã tạo' : undefined}
            >
              <select className="select" value={form.ageGroupId} onChange={(e) => changeAgeGroup(e.target.value)} disabled={!!id}>
                <option value="">Chọn nhóm tuổi</option>
                {AGE_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Trạng thái" required>
              <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {Object.entries(RECORD_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Ghi chú" className="td-span-all">
              <input className="input" value={form.note} maxLength={300} onChange={(e) => set('note', e.target.value)} />
            </FormField>
          </div>
        </div>

        <div className="card wizard-card mt-16">
          <div className="card__header">
            <div className="card__title">Món ăn theo bữa</div>
          </div>
          <div className="card__body">
            {form.ageGroupId ? (
              <MealEditor
                meals={form.meals}
                sessions={sessions}
                onChange={(meals) => set('meals', meals)}
                catalog={catalog}
                ageGroupId={form.ageGroupId}
                errors={submitted ? errors : {}}
              />
            ) : (
              <div className="muted">Chọn nhóm tuổi để biết số bữa trong ngày.</div>
            )}
          </div>
        </div>

        {result && (
          <div className="card mt-16">
            <div className="card__header">
              <div className="card__title">Dinh dưỡng trong ngày (tự tính)</div>
            </div>
            <div className="card__body">
              <AllergenWarnings meals={form.meals} catalog={catalog} contextRows={allergyRows} />
              <NutritionTable result={result} ageGroupId={form.ageGroupId} price={price} />
            </div>
          </div>
        )}

        <div className="page-actions">
          <button type="button" className="btn" onClick={() => navigate(id ? `/menu/menus/${id}` : '/menu/menus')}>
            <ArrowLeft size={16} /> Hủy
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? <Spinner small /> : <Save size={16} />} Lưu thực đơn
          </button>
        </div>
      </form>
    </div>
  );
}
