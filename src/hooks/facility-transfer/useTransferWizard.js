import { useCallback, useMemo, useState } from 'react';
import { TRANSFER_TYPES, TRANSFER_TYPE_LOCATION_TYPES } from '@/models/facility-transfer/transferConstants';
import { createTransferItem } from '@/models/facility-transfer/FacilityTransferItem';
import {
  validateGeneralInfo,
  validateCreatorSignature,
  validateItems,
  validateAssignees,
  hasErrors,
} from '@/utils/facility-transfer/transferValidation';

export const WIZARD_STEPS = ['Thông tin chung', 'Chọn tài sản', 'Chọn người thực hiện', 'Xác nhận và gửi'];

/**
 * State machine of the 4-step wizard. Used for creating, editing a draft and
 * revising a transfer (the old data is preloaded in `initialForm`).
 */
export function useTransferWizard({ initialForm, md }) {
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [availableById, setAvailableById] = useState({});
  const [maxReached, setMaxReached] = useState(initialForm.id ? 3 : 0);

  const suggestedUserId = useCallback((locationId) => md.locationById(locationId)?.managerUserId || null, [md]);

  const clearError = (keys) =>
    setErrors((e) => {
      const next = { ...e };
      keys.forEach((k) => delete next[k]);
      return next;
    });

  /** Updates fields and applies dependent changes (campus -> rooms -> items -> people). */
  const update = useCallback(
    (patch) => {
      setForm((prev) => {
        const next = { ...prev, ...patch };
        const allowed = TRANSFER_TYPE_LOCATION_TYPES[next.type];
        const fitsType = (locId) => !locId || allowed.includes(md.locationById(locId)?.type);

        if (next.type !== TRANSFER_TYPES.INTER_CAMPUS) next.toCampusId = next.fromCampusId;
        else if ('type' in patch && prev.type !== TRANSFER_TYPES.INTER_CAMPUS && next.toCampusId === next.fromCampusId)
          next.toCampusId = '';

        if (md.locationById(next.fromLocationId)?.campusId !== next.fromCampusId || !fitsType(next.fromLocationId))
          next.fromLocationId = '';
        if (md.locationById(next.toLocationId)?.campusId !== next.toCampusId || !fitsType(next.toLocationId)) next.toLocationId = '';

        // Assets only exist at the sending location: changing it empties the selection.
        if (next.fromLocationId !== prev.fromLocationId) next.items = [];

        // Handover / receiver are always the people in charge of the two rooms (SRS UC 7.5).
        next.handoverPickMode = 'SUGGESTED';
        next.receiverPickMode = 'SUGGESTED';
        next.handoverUserId = suggestedUserId(next.fromLocationId);
        next.receiverUserId = suggestedUserId(next.toLocationId);
        return next;
      });
      clearError(Object.keys(patch).concat(patch.creatorSignatureUrl ? ['creatorSignature'] : []));
    },
    [md, suggestedUserId],
  );

  /* ----- Items (step 2) ----- */
  const toggleAsset = useCallback((asset, checked) => {
    setForm((prev) => ({
      ...prev,
      items: checked
        ? [...prev.items, createTransferItem(asset, Math.min(1, asset.availableQuantity))]
        : prev.items.filter((i) => i.assetId !== asset.id),
    }));
    clearError(['items', `item_${asset.id}`]);
  }, []);

  const updateItem = useCallback((assetId, patch) => {
    setForm((prev) => ({ ...prev, items: prev.items.map((i) => (i.assetId === assetId ? { ...i, ...patch } : i)) }));
    clearError([`item_${assetId}`]);
  }, []);

  const clearItems = useCallback(() => setForm((prev) => ({ ...prev, items: [] })), []);

  /* ----- Validation & navigation ----- */
  const validateStep = useCallback(
    (index, current = form) => {
      if (index === 0) return { ...validateGeneralInfo(current), ...validateCreatorSignature(current) };
      if (index === 1) return validateItems(current.items, availableById);
      if (index === 2) return validateAssignees(current);
      return {
        ...validateGeneralInfo(current),
        ...validateCreatorSignature(current),
        ...validateItems(current.items, availableById),
        ...validateAssignees(current),
      };
    },
    [form, availableById],
  );

  /** Returns the first invalid step index or -1. */
  const findInvalidStep = useCallback(() => {
    for (let i = 0; i < 3; i += 1) {
      if (hasErrors(validateStep(i))) return i;
    }
    return -1;
  }, [validateStep]);

  const next = useCallback(() => {
    const stepErrors = validateStep(step);
    setErrors(stepErrors);
    if (hasErrors(stepErrors)) return false;
    const target = Math.min(step + 1, 3);
    setStep(target);
    setMaxReached((m) => Math.max(m, target));
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  }, [step, validateStep]);

  const back = useCallback(() => {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const goTo = useCallback(
    (target) => {
      if (target <= maxReached || target < step) {
        setErrors({});
        setStep(target);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [maxReached, step],
  );

  const totals = useMemo(
    () => ({ count: form.items.length, quantity: form.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0) }),
    [form.items],
  );

  return {
    form,
    step,
    errors,
    setErrors,
    maxReached,
    update,
    toggleAsset,
    updateItem,
    clearItems,
    next,
    back,
    goTo,
    validateStep,
    findInvalidStep,
    setAvailableById,
    availableById,
    totals,
    setStep,
  };
}
