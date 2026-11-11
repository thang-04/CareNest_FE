import { MENU_AI_FALLBACK_LABELS, MENU_AI_SOURCE_LABELS, MENU_AI_STATUS } from '@/models/menu-planning/menuPlanningConstants';
import { sameDay } from '@/utils/menu-planning/menuTemplateGrid';

/** Nháp còn chờ duyệt (mới dùng/bỏ được); BE vẫn kiểm lại trạng thái. */
export const isPendingDraft = (draft) => draft?.status === MENU_AI_STATUS.PENDING_REVIEW;

/**
 * Nháp có món nhưng chưa đạt định mức (BE: feasible=false, NUT-09): dùng làm điểm bắt đầu để sửa tay, tuần chưa công bố
 * được. BE cũ không trả feasible ⇒ coi như đạt.
 */
export const isUnmetDraft = (draft) => isPendingDraft(draft) && draft.feasible === false;

/** "AI gợi ý" hoặc "Theo quy tắc · <lý do>" để người duyệt biết vì sao không dùng bản AI. */
export const sourceText = (draft) => {
  if (!draft?.source) return '';
  const source = MENU_AI_SOURCE_LABELS[draft.source] || draft.source;
  const why = draft.fallbackReason ? MENU_AI_FALLBACK_LABELS[draft.fallbackReason] || draft.fallbackReason : '';
  return why ? `${source} · ${why}` : source;
};

/** Món đã lưu của khối trong tuần để chọn món cần thay: [{ key, date, session, dishId, dishName }]. */
export const fixOptions = (plan, block) =>
  (plan?.days || [])
    .filter((day) => !day.off)
    .flatMap((day) =>
      (day.items || [])
        .filter((item) => item.block === block)
        .map((item) => ({
          key: `${day.date}|${item.session}|${item.dishId}`,
          date: day.date,
          session: item.session,
          dishId: String(item.dishId),
          dishName: item.dishName || '',
        })),
    );

/** Món của nháp mẫu ngày thành món của ngày đang sửa trong form mẫu (thay toàn bộ món ngày đó). */
export const fillTemplateDay = (items, day, draft) => {
  const picked = (draft?.days?.[0]?.items || []).map((item) => ({
    ...(day || {}),
    session: item.session,
    dishId: String(item.dishId),
    dishName: item.dishName || '',
    dishType: item.dishType || '',
  }));
  return [...items.filter((item) => !sameDay(item, day)), ...picked];
};
