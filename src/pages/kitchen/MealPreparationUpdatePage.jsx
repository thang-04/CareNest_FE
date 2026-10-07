import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, CookingPot, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useMealPreparations } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, ConfirmationModal, ErrorState, FormField, LoadingState, Spinner } from '@/components';
import { KbDateFilter, KbSessionFilter } from '@/components/kitchen/KitchenFilters';
import { PreparationCard } from '@/components/kitchen/PreparationCard';
import { updateMealPreparation } from '@/services/kitchen/kitchenService';
import { validatePreparationUpdate } from '@/utils/kitchen/kitchenValidation';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { todayInput } from '@/utils/format';
import { MEAL_SESSION_LABELS, NOTE_MAX, PREP_STATUS, PREP_STATUS_LABELS, PREP_STATUS_ORDER } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

const HINTS = {
  WAITING: 'Đã nhận thông tin, chờ bắt đầu nấu.',
  COOKING: 'Bếp đang chế biến bữa ăn.',
  READY_FOR_HANDOVER: 'Suất ăn đã sẵn sàng, giáo viên được báo số suất cần nhận.',
};

/** Screen #98 – Meal Preparation Update (UC 6.17): the kitchen moves the status forward (Waiting → Cooking → Ready for handover). */
export default function MealPreparationUpdatePage() {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') || todayInput();
  const [session, setSession] = useState(params.get('session') || 'LUNCH');
  const campusId = user?.campusId;
  const { sessions, loading, error, reload } = useMealPreparations(campusId, date);
  const item = sessions.find((s) => s.session === session);
  const current = item?.record?.status || null;
  const ready = item?.hasMenu && item?.mealCountStatus === 'CONFIRMED';

  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  // Suggest the next step whenever the selected meal or its current status changes.
  useEffect(() => {
    const at = current ? PREP_STATUS_ORDER.indexOf(current) : -1;
    setStatus(PREP_STATUS_ORDER[Math.min(at + 1, PREP_STATUS_ORDER.length - 1)]);
    setNote('');
    setErrors({});
  }, [current, session, date]);

  const payload = { date, session, status, note };
  const openConfirm = () => {
    const found = validatePreparationUpdate(payload, current, todayInput());
    setErrors(found);
    if (Object.keys(found).length === 0) setConfirming(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateMealPreparation(payload, user);
      toast.success('Đã cập nhật trạng thái chế biến.');
      setConfirming(false);
      reload({ silent: true });
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message || 'Không lưu được thay đổi. Vui lòng thử lại.', 'Không cập nhật được');
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  const currentIndex = current ? PREP_STATUS_ORDER.indexOf(current) : -1;
  const done = current === PREP_STATUS.READY_FOR_HANDOVER;

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.preparationUpdate)} />
      <h1 className="page__title">Cập nhật tình trạng chế biến</h1>
      <div className="kb-toolbar">
        <KbDateFilter value={date} onChange={(d) => setParams({ date: d }, { replace: true })} />
        <KbSessionFilter value={session} onChange={setSession} />
        <div className="kb-toolbar__end">
          <Link className="btn" to={`/kitchen/meal-count?date=${date}`}>
            Xem số suất ăn
          </Link>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !item ? null : (
        <div className="split-2">
          <div className="card">
            <div className="card__header">
              <div className="card__title">{MEAL_SESSION_LABELS[session]} – trạng thái mới</div>
            </div>
            <div className="card__body stack">
              {!ready ? (
                <div className="alert alert--warning">
                  <Info size={18} />
                  <div>
                    {!item.hasMenu
                      ? 'Bữa này không có thực đơn đã công bố.'
                      : 'Số suất ăn của bữa này chưa được Phó hiệu trưởng xác nhận. Chỉ cập nhật chế biến theo số suất đã xác nhận.'}
                  </div>
                </div>
              ) : date > todayInput() ? (
                <div className="muted">Chỉ cập nhật cho hôm nay hoặc ngày đã qua.</div>
              ) : (
                <>
                  <div role="radiogroup" aria-label="Trạng thái chế biến" className="kb-prep-options">
                    {PREP_STATUS_ORDER.map((s, i) => {
                      const disabled = i < currentIndex;
                      return (
                        <label
                          key={s}
                          className={`kb-prep-option ${status === s ? 'kb-prep-option--active' : ''} ${disabled ? 'kb-prep-option--disabled' : ''}`}
                        >
                          <input
                            type="radio"
                            className="cb"
                            name="kb-prep-status"
                            value={s}
                            checked={status === s}
                            disabled={disabled}
                            onChange={() => {
                              setStatus(s);
                              setErrors({});
                            }}
                          />
                          <span>
                            <span className="fw-600">{PREP_STATUS_LABELS[s]}</span>
                            {i === currentIndex && (
                              <span className="chip chip--teal" style={{ marginLeft: 6 }}>
                                Hiện tại
                              </span>
                            )}
                            <span className="muted text-xs" style={{ display: 'block' }}>
                              {HINTS[s]}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {errors.status && <div className="field__error">{errors.status}</div>}
                  <p className="muted text-xs">Trạng thái chỉ chuyển tiếp, không quay lại bước trước.</p>
                  <FormField label="Ghi chú vận hành" error={errors.note} hint={`Tối đa ${NOTE_MAX} ký tự`}>
                    <textarea className="textarea" rows={3} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} />
                  </FormField>
                  <div className="page-actions" style={{ marginTop: 0 }}>
                    <Link className="btn" to="/kitchen/meal-count">
                      <ArrowLeft size={16} /> Quay lại
                    </Link>
                    <button className="btn btn--primary" onClick={openConfirm} disabled={saving}>
                      {saving ? <Spinner small /> : done ? <Check size={16} /> : <CookingPot size={16} />} Cập nhật trạng thái
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <PreparationCard item={item} md={md} />
        </div>
      )}

      <ConfirmationModal
        open={confirming}
        title={`Chuyển sang "${PREP_STATUS_LABELS[status] || ''}"?`}
        message={
          status === PREP_STATUS.READY_FOR_HANDOVER && current !== status
            ? 'Phó hiệu trưởng và giáo viên các lớp sẽ được thông báo số suất cần nhận. Trạng thái không quay lại được.'
            : 'Phó hiệu trưởng sẽ được thông báo. Trạng thái không quay lại được.'
        }
        confirmLabel="Cập nhật trạng thái"
        onConfirm={save}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
